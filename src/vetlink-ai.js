/**
 * vetlink-ai.js
 * VetLink AI inference engine — 11-class multi-species skin disease classifier
 * Model: MobileNetV3Large (97.33% test accuracy)
 *
 * NOTE: tf and tflite are loaded as global variables via CDN scripts in index.html.
 * Do NOT import them as npm modules — they are not bundled.
 */

let model       = null
let classLabels = []
let isLoading   = false

// Species → expected classes (informational, not used for filtering)
export const SPECIES_CLASSES = {
  Canine: ['Healthy', 'Hotspots', 'Mange', 'Pyoderma', 'Ringworm'],
  Feline: ['Healthy', 'Hotspots', 'Mange', 'Pyoderma', 'Ringworm'],
  Avian:  ['Avian Fowl Pox', 'Bird_Healthy', 'Scaly Face Scaly Leg Mite (Knemidocoptes)'],
  Rabbit: ['Rabbit Mange', 'Rabbit Ringworm', 'Rabbit_Healthy'],
}

// Human-readable display labels for the UI
export const CLASS_DISPLAY = {
  'Avian Fowl Pox':                            'Avian Fowl Pox',
  'Bird_Healthy':                              'Healthy (Bird)',
  'Healthy':                                   'Healthy',
  'Hotspots':                                  'Hot Spots',
  'Mange':                                     'Mange',
  'Pyoderma':                                  'Pyoderma',
  'Rabbit Mange':                              'Mange (Rabbit)',
  'Rabbit Ringworm':                           'Ringworm (Rabbit)',
  'Rabbit_Healthy':                            'Healthy (Rabbit)',
  'Ringworm':                                  'Ringworm',
  'Scaly Face Scaly Leg Mite (Knemidocoptes)': 'Scaly Face / Leg Mite',
}

// Brief clinical description per class (shown in AdminApproval)
export const CLASS_DESCRIPTIONS = {
  'Avian Fowl Pox':        'Viral infection causing wart-like lesions on skin and beak.',
  'Bird_Healthy':           'No disease detected. Skin and feathers appear healthy.',
  'Healthy':                'No disease detected. Skin appears healthy.',
  'Hotspots':               'Acute moist dermatitis. Likely caused by allergies or self-trauma.',
  'Mange':                  'Mite infestation causing intense itching, hair loss, and skin crusting.',
  'Pyoderma':               'Bacterial skin infection with papules, pustules, or crusts.',
  'Rabbit Mange':           'Mite-caused condition with hair loss and skin crusting in rabbits.',
  'Rabbit Ringworm':        'Fungal infection causing circular bald patches in rabbits.',
  'Rabbit_Healthy':         'No disease detected. Fur and skin appear healthy.',
  'Ringworm':               'Fungal skin infection causing circular, scaly lesions.',
  'Scaly Face Scaly Leg Mite (Knemidocoptes)':
    'Mite infestation causing crusty, scaly beak and legs in birds.',
}

/**
 * Wait for the CDN scripts to be available on window.
 * The scripts are loaded before React, so this should resolve instantly.
 */
function waitForTF(maxWaitMs = 10000) {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (window.tf && window.tflite) {
        resolve({ tf: window.tf, tflite: window.tflite })
      } else {
        reject(new Error(
          'TensorFlow.js did not load. Check your internet connection — ' +
          'the AI model requires CDN scripts on first load.'
        ))
      }
    }
    // Give scripts a moment if they haven't finished yet
    if (window.tf && window.tflite) {
      resolve({ tf: window.tf, tflite: window.tflite })
    } else {
      setTimeout(check, maxWaitMs)
    }
  })
}

/**
 * Load the TFLite model and label map.
 * Call once on app startup; safe to call multiple times (cached).
 */
export async function loadVetLinkModel() {
  if (model) return model
  if (isLoading) {
    while (isLoading) {
      await new Promise((res) => setTimeout(res, 100))
    }
    return model
  }

  isLoading = true
  try {
    const { tf, tflite } = await waitForTF()
    await tf.ready()

    // Set WASM path for the TFLite runtime (alpha.9 contains the required wasm binaries)
    tflite.setWasmPath(
      'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.9/dist/'
    )

    // 1. Fetch label map
    const labelResponse = await fetch('/models/vetlink_labels_v2.json')
    if (!labelResponse.ok) throw new Error('Could not load label map')
    const labelMap = await labelResponse.json()

    // { "0": "Avian Fowl Pox", ... } → ["Avian Fowl Pox", ...]
    classLabels = Object.keys(labelMap)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((key) => labelMap[key])

    // 2. Explicitly fetch model file as ArrayBuffer (avoids relative path resolution bugs in worker)
    const modelResponse = await fetch('/models/vetlink_model_v2.tflite')
    if (!modelResponse.ok) throw new Error(`Could not fetch model: HTTP ${modelResponse.status}`)
    const modelBuffer = await modelResponse.arrayBuffer()
    console.log('[VetLink AI] Model buffer fetched successfully:', modelBuffer.byteLength, 'bytes')

    // 3. Load model from ArrayBuffer with numThreads: 1 to ensure instant, deadlock-free execution
    model = await tflite.loadTFLiteModel(modelBuffer, {
      numThreads: 1,
    })

    console.log('[VetLink AI] ✅ Model initialized with single-thread WASM. Classes:', classLabels)
    return model
  } finally {
    isLoading = false
  }
}

/**
 * Preprocess an image element for MobileNetV3Large.
 * The model was exported with include_preprocessing=True (Node 0: MUL 1/127.5, Node 1: ADD -1),
 * so it expects float32 pixels in [0, 255].
 * Output: float32 Tensor4D [1, 224, 224, 3]
 */
function preprocessImage(imageElement) {
  const tf = window.tf
  return tf.tidy(() => {
    let t = tf.browser.fromPixels(imageElement)    // [H, W, 3] in [0, 255]
    t = tf.image.resizeBilinear(t, [224, 224])     // [224, 224, 3]
    t = t.toFloat()                                // float32 [0, 255]
    return t.expandDims(0)                          // [1, 224, 224, 3]
  })
}

import { generateGradCAM } from './gradcam'

/**
 * Run AI inference on an image element with species-aware diagnostic support.
 * As detailed in Chapter 3 (Page 40) of the Capstone paper, VetLink enforces
 * species-aware gating across 4 domestic animal species (Canine, Feline, Avian, Rabbit)
 * so that clinically impossible cross-species diagnoses (e.g. canine Pyoderma in a rabbit)
 * are eliminated.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} imageElement
 * @param {string} species - 'Canine' | 'Feline' | 'Avian' | 'Rabbit'
 * @returns {Promise<{ label, displayLabel, confidence, percent, description, top3, gradcam }>}
 */
function imageToBase64(imageElement) {
  try {
    const canvas = document.createElement('canvas')
    canvas.width  = 224
    canvas.height = 224
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imageElement, 0, 0, 224, 224)
    return canvas.toDataURL('image/jpeg', 0.95)
  } catch (err) {
    console.warn('[VetLink AI] Failed to convert image to base64:', err)
    return null
  }
}

/**
 * Run AI inference on an image element with species-aware diagnostic support.
 * As detailed in Chapter 3 (Page 40) of the Capstone paper, VetLink enforces
 * species-aware gating across 4 domestic animal species (Canine, Feline, Avian, Rabbit)
 * so that clinically impossible cross-species diagnoses (e.g. canine Pyoderma in a rabbit)
 * are eliminated.
 *
 * Primary execution: Native TFLite via FastAPI endpoint (/api/ai/predict) in 0.04s.
 * Edge fallback: In-browser WASM runner via @tensorflow/tfjs-tflite.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} imageElement
 * @param {string} species - 'Canine' | 'Feline' | 'Avian' | 'Rabbit'
 * @returns {Promise<{ label, displayLabel, confidence, percent, description, top3, gradcam }>}
 */
export async function predict(imageElement, species = 'Canine') {
  console.time('[VetLink AI] Inference Time')

  // 1. PRIMARY PATH: High-speed native TFLite inference via backend
  const b64 = imageToBase64(imageElement)
  if (b64) {
    const candidateEndpoints = ['/api/ai/predict', 'http://localhost:8000/api/ai/predict']
    for (const endpoint of candidateEndpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: b64, species }),
        })
        if (res.ok) {
          const data = await res.json()
          console.timeEnd('[VetLink AI] Inference Time')
          console.log(`[VetLink AI] Native TFLite result: ${data.label} (${data.percent})`)

          // Generate Grad-CAM 3-panel visualization (matching Colab Cell 8)
          const gradcam = await generateGradCAM(imageElement)

          return {
            label:        data.label,
            displayLabel: data.displayLabel || CLASS_DISPLAY[data.label] || data.label,
            confidence:   data.confidence,
            percent:      data.percent || `${(data.confidence * 100).toFixed(1)}%`,
            description:  CLASS_DESCRIPTIONS[data.label] || '',
            top3:         data.top3 || [],
            gradcam,
            engine:       'backend',
          }
        }
      } catch (err) {
        // Continue to fallback
      }
    }
  }

  // 2. FALLBACK PATH: Client-side in-browser WASM inference
  console.warn('[VetLink AI] Backend unreachable; attempting client-side WASM inference...')
  if (!model) await loadVetLinkModel()

  const tf          = window.tf
  const inputTensor = preprocessImage(imageElement)

  let outputTensor = null
  let rawOutput    = null

  try {
    rawOutput = model.predict(inputTensor)

    if (rawOutput instanceof tf.Tensor) {
      outputTensor = rawOutput
    } else if (rawOutput && typeof rawOutput === 'object') {
      const keys = Object.keys(rawOutput)
      if (keys.length === 0) throw new Error('TFLite model returned empty outputs')
      outputTensor = rawOutput[keys[0]]
    } else {
      throw new Error(`Unexpected TFLite model output: ${typeof rawOutput}`)
    }

    const rawData = outputTensor.dataSync ? outputTensor.dataSync() : await outputTensor.data()
    console.timeEnd('[VetLink AI] Inference Time')
    const probabilities = Array.from(rawData)

    // Allowed classes for the selected patient species
    const allowedClasses = SPECIES_CLASSES[species] || classLabels

    // Filter candidates to the selected species and normalize
    const candidateList = classLabels
      .map((label, idx) => ({ label, prob: probabilities[idx] || 0 }))
      .filter((item) => allowedClasses.includes(item.label))

    const sumProb = candidateList.reduce((acc, cur) => acc + cur.prob, 0) || 1
    const classScores = candidateList
      .map((item) => ({
        label: item.label,
        confidence: item.prob / sumProb,
      }))
      .sort((a, b) => b.confidence - a.confidence)

    const topItem  = classScores[0] || { label: 'Unknown', confidence: 0 }
    const topLabel = topItem.label
    const topConf  = topItem.confidence

    const top3 = classScores.slice(0, 3).map((item) => ({
      label:   item.label,
      display: CLASS_DISPLAY[item.label] || item.label,
      confidence: item.confidence,
    }))

    // Generate Grad-CAM 3-panel visualization (Original, Heatmap, Overlay)
    const gradcam = await generateGradCAM(imageElement)

    const maxP = Math.max(...probabilities)
    const minP = Math.min(...probabilities)
    const isUniform = (maxP - minP) < 0.05

    return {
      label:        topLabel,
      displayLabel: CLASS_DISPLAY[topLabel] || topLabel,
      confidence:   topConf,
      percent:      `${(topConf * 100).toFixed(1)}%`,
      description:  CLASS_DESCRIPTIONS[topLabel] || '',
      top3,
      gradcam,
      engine:       'wasm',
      isUniform,
    }
  } finally {
    inputTensor.dispose()
    if (outputTensor && typeof outputTensor.dispose === 'function') {
      outputTensor.dispose()
    }
    if (rawOutput && typeof rawOutput === 'object' && !(rawOutput instanceof tf.Tensor)) {
      Object.values(rawOutput).forEach((t) => {
        if (t && typeof t.dispose === 'function' && t !== outputTensor) {
          t.dispose()
        }
      })
    }
  }
}

/**
 * Load a File into an HTMLImageElement, ready for inference.
 * Uses FileReader data URL and img.decode() to ensure full pixel availability.
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = async () => {
        try {
          if (typeof img.decode === 'function') {
            await img.decode()
          }
        } catch (_) {
          // Decode error fallback, can still be read by canvas/fromPixels
        }
        resolve(img)
      }
      img.onerror = () => reject(new Error('Failed to load image element'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Evaluates image sharpness using the industry-standard Laplacian Operator Variance (∇²).
 * Replicates OpenCV's cv2.Laplacian(img, cv2.CV_64F).var() in client-side JavaScript.
 * - Sharp / In-Focus photos exhibit strong high-frequency edge peaks (variance >= 45).
 * - Blurry / Out-of-focus photos smear out edges, dropping variance near zero (< 45).
 *
 * @param {HTMLImageElement|HTMLCanvasElement} imgElement
 * @returns {{ isSharp: boolean, score: number, message: string }}
 */
export function checkImageSharpness(imgElement) {
  try {
    const canvas = document.createElement('canvas')
    const size = 224
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgElement, 0, 0, size, size)
    const imgData = ctx.getImageData(0, 0, size, size)
    const d = imgData.data

    // 1. Grayscale luminance buffer
    const gray = new Float32Array(size * size)
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    }

    // 2. 3x3 Discrete Laplacian Kernel:
    //    [ 0,  1,  0 ]
    //    [ 1, -4,  1 ]
    //    [ 0,  1,  0 ]
    let sum = 0
    let sumSq = 0
    let count = 0

    for (let y = 1; y < size - 1; y++) {
      const rowIdx = y * size
      for (let x = 1; x < size - 1; x++) {
        const center = gray[rowIdx + x]
        const up     = gray[(y - 1) * size + x]
        const down   = gray[(y + 1) * size + x]
        const left   = gray[rowIdx + (x - 1)]
        const right  = gray[rowIdx + (x + 1)]

        const lap = up + down + left + right - 4.0 * center
        sum += lap
        sumSq += lap * lap
        count++
      }
    }

    // 3. Variance = E[X²] - (E[X])²
    const mean = sum / (count || 1)
    const variance = Math.round(((sumSq / (count || 1)) - mean * mean) * 10) / 10

    // Threshold: Focused clinical skin/fur textures score ≥ 45. Blurry or out-of-focus shots score < 45.
    const isSharp = variance >= 45

    return {
      isSharp,
      score: variance,
      message: isSharp
        ? 'Image sharpness is optimal for clinical AI inference.'
        : `Image appears blurry or out of focus (Laplacian sharpness: ${variance}, recommended ≥ 45). Blurry images smear fine crust and pustule textures, which can cause the AI to mistakenly classify skin lesions as "Healthy". Please hold steady and refocus closely on the lesion.`,
    }
  } catch (err) {
    console.warn('[VetLink AI] Sharpness check error:', err)
    return { isSharp: true, score: 100, message: 'Sharpness check bypassed.' }
  }
}


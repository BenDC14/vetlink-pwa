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
    // Wait for ongoing load to finish
    await new Promise((res) => setTimeout(res, 200))
    return model
  }

  isLoading = true
  try {
    const { tflite } = await waitForTF()

    // Set WASM path for the TFLite runtime
    tflite.setWasmPath(
      'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/'
    )

    // Load label map from /public/models/
    const labelResponse = await fetch('/models/vetlink_labels_v2.json')
    if (!labelResponse.ok) throw new Error('Could not load label map')
    const labelMap = await labelResponse.json()

    // { "0": "Avian Fowl Pox", ... } → ["Avian Fowl Pox", ...]
    classLabels = Object.keys(labelMap)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((key) => labelMap[key])

    // Load TFLite model from /public/models/
    model = await tflite.loadTFLiteModel('/models/vetlink_model_v2.tflite')

    console.log('[VetLink AI] ✅ Model loaded. Classes:', classLabels)
    return model
  } finally {
    isLoading = false
  }
}

/**
 * Preprocess an image element for MobileNetV3Large.
 * Output: float32 Tensor4D [1, 224, 224, 3], values in [-1, 1]
 */
function preprocessImage(imageElement) {
  const tf = window.tf
  return tf.tidy(() => {
    let t = tf.browser.fromPixels(imageElement)    // [H, W, 3]
    t = tf.image.resizeBilinear(t, [224, 224])     // [224, 224, 3]
    t = t.toFloat()
    t = t.div(127.5).sub(1.0)                      // scale to [-1, 1]
    return t.expandDims(0)                          // [1, 224, 224, 3]
  })
}

/**
 * Run AI inference on an image element.
 * @param {HTMLImageElement|HTMLCanvasElement} imageElement
 * @returns {{ label, displayLabel, confidence, percent, description, top3 }}
 */
export async function predict(imageElement) {
  if (!model) await loadVetLinkModel()

  const tf          = window.tf
  const inputTensor = preprocessImage(imageElement)

  let outputTensor
  try {
    outputTensor = model.predict(inputTensor)
  } finally {
    inputTensor.dispose()
  }

  const probabilities = Array.from(await outputTensor.data())
  outputTensor.dispose()

  // Top prediction
  const topIndex = probabilities.indexOf(Math.max(...probabilities))
  const topLabel = classLabels[topIndex]
  const topConf  = probabilities[topIndex]

  // Top 3 sorted by confidence
  const top3 = probabilities
    .map((prob, i) => ({
      label:      classLabels[i],
      display:    CLASS_DISPLAY[classLabels[i]] || classLabels[i],
      confidence: prob,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)

  return {
    label:        topLabel,
    displayLabel: CLASS_DISPLAY[topLabel] || topLabel,
    confidence:   topConf,
    percent:      `${(topConf * 100).toFixed(1)}%`,
    description:  CLASS_DESCRIPTIONS[topLabel] || '',
    top3,
  }
}

/**
 * Load a File into an HTMLImageElement, ready for inference.
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

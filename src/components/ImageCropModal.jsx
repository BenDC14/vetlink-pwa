import React, { useState, useRef, useEffect } from 'react'

/**
 * ImageCropModal
 * Interactive Square Lesion ROI Zoom & Crop Tool for VetLink PWA.
 * Lets veterinarians and clinic staff center, zoom in, and isolate
 * the dermatological lesion before submitting to MobileNetV3 (224x224).
 * Prevents non-lesion backgrounds (floors, healthy fur) from skewing neural predictions.
 */
export default function ImageCropModal({ isOpen, file, onClose, onConfirmCrop, onUseFullImage }) {
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageSrc, setImageSrc] = useState(null)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })

  const containerRef = useRef(null)
  const imageRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !file) {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc)
        setImageSrc(null)
      }
      setZoom(1.0)
      setPan({ x: 0, y: 0 })
      return
    }

    const url = URL.createObjectURL(file)
    setImageSrc(url)
    setZoom(1.0)
    setPan({ x: 0, y: 0 })

    const img = new Image()
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.src = url

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [isOpen, file])

  if (!isOpen || !file || !imageSrc) return null

  // Pointer drag for panning
  const handlePointerDown = (e) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  // Generate cropped square blob
  const handleCropAndProceed = () => {
    if (!imageRef.current || !containerRef.current || naturalSize.width === 0) {
      onUseFullImage()
      return
    }

    const boxSize = 260 // Viewfinder square size in px
    const containerRect = containerRef.current.getBoundingClientRect()
    const boxCenterX = containerRect.width / 2
    const boxCenterY = containerRect.height / 2

    // Measure rendered image relative to container center
    // Rendered image is styled with transform translate and scale
    const imgEl = imageRef.current
    const imgRect = imgEl.getBoundingClientRect()

    // Calculate scale factor from natural image pixels to displayed pixels
    const displayedScale = (imgRect.width / naturalSize.width)

    // Center of crop square relative to image's top-left
    const cropSquareLeftInImg = (boxCenterX - boxSize / 2 - (imgRect.left - containerRect.left)) / displayedScale
    const cropSquareTopInImg = (boxCenterY - boxSize / 2 - (imgRect.top - containerRect.top)) / displayedScale
    const cropSquareSizeInImg = boxSize / displayedScale

    // Bound coordinates
    const sx = Math.max(0, cropSquareLeftInImg)
    const sy = Math.max(0, cropSquareTopInImg)
    const sWidth = Math.min(naturalSize.width - sx, cropSquareSizeInImg)
    const sHeight = Math.min(naturalSize.height - sy, cropSquareSizeInImg)
    const finalSize = Math.min(sWidth, sHeight)

    const targetDim = Math.min(1024, Math.round(finalSize))
    const canvas = document.createElement('canvas')
    canvas.width = targetDim > 64 ? targetDim : 1024
    canvas.height = canvas.width
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const sourceImg = new Image()
    sourceImg.onload = () => {
      ctx.drawImage(
        sourceImg,
        sx,
        sy,
        finalSize > 10 ? finalSize : naturalSize.width,
        finalSize > 10 ? finalSize : naturalSize.height,
        0,
        0,
        canvas.width,
        canvas.height
      )

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const croppedFile = new File([blob], `lesion_roi_${Date.now()}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            onConfirmCrop(croppedFile)
          } else {
            onUseFullImage()
          }
        },
        'image/jpeg',
        0.88
      )
    }
    sourceImg.src = imageSrc
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.88)' }}>
      <div
        className="modal-dialog"
        style={{
          width: '94%',
          maxWidth: 580,
          background: '#0f172a',
          color: '#f8fafc',
          borderRadius: 16,
          border: '1px solid #334155',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #334155',
            background: '#1e293b',
          }}
        >
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc', display: 'block' }}>
              Isolate Lesion Target (ROI Crop & Zoom)
            </span>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Center lesion inside the square box to eliminate non-clinical background.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </header>

        {/* Viewport & Viewfinder */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{
            position: 'relative',
            width: '100%',
            height: 360,
            background: '#000',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          {/* Draggable & Scalable Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Uploaded lesion for cropping"
            draggable={false}
            style={{
              maxWidth: '85%',
              maxHeight: '85%',
              objectFit: 'contain',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
              pointerEvents: 'none',
            }}
          />

          {/* Square Viewfinder Reticle Overlay (260px x 260px) */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 260,
              height: 260,
              maxWidth: '80vw',
              maxHeight: '80vw',
              border: '2px solid rgba(56, 189, 248, 0.95)',
              borderRadius: 12,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 8,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)', padding: '3px 8px', borderRadius: 4, alignSelf: 'center', border: '1px solid #0284c7' }}>
              <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>SQUARE LESION TARGET</span>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)', padding: '3px 8px', borderRadius: 4, alignSelf: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#f8fafc' }}>Drag to center & adjust zoom below</span>
            </div>
          </div>
        </div>

        {/* Zoom Slider Control */}
        <div style={{ padding: '10px 18px', background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, minWidth: 70 }}>
            Zoom: {zoom.toFixed(1)}x
          </span>
          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#059669', cursor: 'pointer' }}
          />
          <button
            type="button"
            onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }) }}
            style={{ background: '#334155', border: '1px solid #475569', color: '#94a3b8', borderRadius: 6, padding: '4px 8px', fontSize: '0.74rem', cursor: 'pointer' }}
          >
            Reset
          </button>
        </div>

        {/* Footer Actions */}
        <footer style={{ padding: '12px 18px', background: '#0f172a', borderTop: '1px solid #334155', display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={onUseFullImage}
            style={{ flex: 1, padding: '9px 12px', background: '#334155', color: '#f8fafc', border: '1px solid #475569', fontSize: '0.82rem' }}
          >
            Use Full Image
          </button>
          <button
            type="button"
            className="action-btn blue"
            onClick={handleCropAndProceed}
            style={{ flex: 1.4, padding: '9px 12px', background: '#16a34a', color: '#ffffff', fontWeight: 600, fontSize: '0.84rem' }}
          >
            Confirm Crop & Analyze Lesion
          </button>
        </footer>
      </div>
    </div>
  )
}


import React, { useState, useRef, useEffect, useCallback } from 'react'

/**
 * ImageViewerModal
 * Interactive Clinical High-Resolution Lesion Inspection Lightbox.
 * Supports zoom in/out (1x to 5x), wheel zoom, pointer drag/pan, 90° rotation,
 * and keyboard shortcuts (Esc, +, -, 0).
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {string} src - Image source (base64 or URL)
 * @param {string} title - Main header title (e.g. "Lesion Inspection")
 * @param {string} subtitle - Subtitle (e.g. "Visit #1 • Mange (Canine)")
 * @param {Function} onClose - Close handler
 */
export default function ImageViewerModal({ isOpen, src, title = 'Lesion Image Inspection', subtitle = '', onClose }) {
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const viewportRef = useRef(null)

  // Reset state whenever a new image opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1.0)
      setPan({ x: 0, y: 0 })
      setRotation(0)
      setIsDragging(false)
    }
  }, [isOpen, src])

  // Keyboard navigation (Esc to close, +/- to zoom, 0 to reset)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === '+' || e.key === '=') {
        setZoom((prev) => Math.min(5.0, Number((prev + 0.3).toFixed(2))))
      } else if (e.key === '-' || e.key === '_') {
        setZoom((prev) => {
          const next = Math.max(1.0, Number((prev - 0.3).toFixed(2)))
          if (next === 1.0) setPan({ x: 0, y: 0 })
          return next
        })
      } else if (e.key === '0' || e.key.toLowerCase() === 'r') {
        setZoom(1.0)
        setPan({ x: 0, y: 0 })
        setRotation(0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(5.0, Number((prev + 0.35).toFixed(2))))
  }

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(1.0, Number((prev - 0.35).toFixed(2)))
      if (next === 1.0) setPan({ x: 0, y: 0 })
      return next
    })
  }

  const handleReset = () => {
    setZoom(1.0)
    setPan({ x: 0, y: 0 })
    setRotation(0)
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  // Pointer drag panning
  const handlePointerDown = (e) => {
    if (zoom <= 1.0) return // Only pan when zoomed in
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    if (viewportRef.current) {
      viewportRef.current.setPointerCapture?.(e.pointerId)
    }
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    e.preventDefault()
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handlePointerUp = (e) => {
    if (isDragging) {
      setIsDragging(false)
      if (viewportRef.current && e.pointerId) {
        try {
          viewportRef.current.releasePointerCapture?.(e.pointerId)
        } catch {
          // ignore
        }
      }
    }
  }

  // Smooth wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY * -0.002
    setZoom((prev) => {
      const next = Math.min(5.0, Math.max(1.0, Number((prev + delta).toFixed(2))))
      if (next === 1.0) setPan({ x: 0, y: 0 })
      return next
    })
  }, [])

  // Double click to toggle 1.0x vs 2.5x zoom
  const handleDoubleClick = () => {
    if (zoom > 1.2) {
      setZoom(1.0)
      setPan({ x: 0, y: 0 })
    } else {
      setZoom(2.5)
    }
  }

  if (!isOpen || !src) return null

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(51, 65, 85, 0.8)',
          color: '#f8fafc',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </h3>
          {subtitle && (
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitle}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(51, 65, 85, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.1rem',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(51, 65, 85, 0.6)' }}
        >
          ✕
        </button>
      </header>

      {/* ── Image Viewport ─────────────────────────────────────────── */}
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: zoom > 1.0 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <img
          src={src}
          alt={title}
          draggable={false}
          style={{
            maxWidth: '92%',
            maxHeight: '90%',
            objectFit: 'contain',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.2, 0.8, 0.4, 1)',
            pointerEvents: 'none',
          }}
        />

        {/* Pan guidance indicator when zoomed in */}
        {zoom > 1.0 && (
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              padding: '6px 12px',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: 20,
              fontSize: '0.74rem',
              color: '#38bdf8',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              pointerEvents: 'none',
            }}
          >
            <span>✋ Drag to pan lesion</span>
            <span style={{ color: '#64748b' }}>•</span>
            <span>{zoom.toFixed(1)}x zoom</span>
          </div>
        )}
      </div>

      {/* ── Interactive Zoom & Navigation Toolbar ─────────────────── */}
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '12px 20px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderTop: '1px solid rgba(51, 65, 85, 0.8)',
          zIndex: 10,
          flexWrap: 'wrap',
        }}
      >
        {/* Zoom Out Button */}
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoom <= 1.0}
          aria-label="Zoom Out"
          title="Zoom out (-)"
          style={{
            minWidth: 44,
            height: 44,
            padding: '0 12px',
            borderRadius: 10,
            background: zoom <= 1.0 ? 'rgba(51, 65, 85, 0.3)' : 'rgba(51, 65, 85, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            color: zoom <= 1.0 ? '#64748b' : '#f8fafc',
            cursor: zoom <= 1.0 ? 'not-allowed' : 'pointer',
            fontSize: '1.25rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          −
        </button>

        {/* Zoom Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 160, maxWidth: 260, flex: 1 }}>
          <input
            type="range"
            min="1.0"
            max="5.0"
            step="0.1"
            value={zoom}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              setZoom(val)
              if (val === 1.0) setPan({ x: 0, y: 0 })
            }}
            aria-label="Zoom percentage"
            style={{
              flex: 1,
              accentColor: '#0d9488',
              cursor: 'pointer',
              height: 6,
            }}
          />
          <span style={{ fontSize: '0.84rem', color: '#38bdf8', fontWeight: 700, minWidth: 46, textAlign: 'right' }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Zoom In Button */}
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoom >= 5.0}
          aria-label="Zoom In"
          title="Zoom in (+)"
          style={{
            minWidth: 44,
            height: 44,
            padding: '0 12px',
            borderRadius: 10,
            background: zoom >= 5.0 ? 'rgba(51, 65, 85, 0.3)' : 'rgba(51, 65, 85, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            color: zoom >= 5.0 ? '#64748b' : '#f8fafc',
            cursor: zoom >= 5.0 ? 'not-allowed' : 'pointer',
            fontSize: '1.25rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </button>

        {/* Reset Button */}
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset zoom and rotation"
          title="Reset zoom to 100% (0 / R)"
          style={{
            height: 44,
            padding: '0 14px',
            borderRadius: 10,
            background: 'rgba(51, 65, 85, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            color: '#f8fafc',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Reset
        </button>

        {/* Rotate Button */}
        <button
          type="button"
          onClick={handleRotate}
          aria-label="Rotate image 90 degrees"
          title="Rotate 90° clockwise"
          style={{
            height: 44,
            padding: '0 14px',
            borderRadius: 10,
            background: 'rgba(51, 65, 85, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            color: '#f8fafc',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Rotate
        </button>
      </footer>
    </div>
  )
}


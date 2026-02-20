import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, ChevronDown, Image, FileImage, Zap, AlertTriangle, Check, Lock, Unlock } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { useEditor, Layer } from './EditorContext'

/**
 * Export format options available in the dialog
 */
type ExportFormat = 'png' | 'jpeg' | 'webp'

/**
 * Export area options
 */
type ExportArea = 'canvas' | 'selection' | 'layer'

/**
 * Scale presets for quick selection
 */
const SCALE_PRESETS = [25, 50, 100, 200, 400]

/**
 * Format information for display
 */
const FORMAT_INFO: Record<ExportFormat, { 
  name: string; 
  description: string; 
  supportsTransparency: boolean;
  extension: string;
  mimeType: string;
}> = {
  png: {
    name: 'PNG',
    description: 'Lossless, supports transparency',
    supportsTransparency: true,
    extension: 'png',
    mimeType: 'image/png'
  },
  jpeg: {
    name: 'JPEG',
    description: 'Lossy, smaller file size',
    supportsTransparency: false,
    extension: 'jpg',
    mimeType: 'image/jpeg'
  },
  webp: {
    name: 'WebP',
    description: 'Modern format, best compression',
    supportsTransparency: true,
    extension: 'webp',
    mimeType: 'image/webp'
  }
}

/**
 * Props for the ExportDialog component
 */
interface ExportDialogProps {
  onClose: () => void
}

/**
 * Export Dialog Component
 * Provides a comprehensive export interface with real-time preview,
 * quality adjustment, and size options.
 */
export default function ExportDialog({ onClose }: ExportDialogProps) {
  const { t } = useLanguage()
  const { 
    canvasSize, 
    layers, 
    selection, 
    activeLayerId,
    activeDocument 
  } = useEditor()

  // Refs
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const originalCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // State for export options
  const [format, setFormat] = useState<ExportFormat>('png')
  const [quality, setQuality] = useState(85)
  const [scale, setScale] = useState(100)
  const [customWidth, setCustomWidth] = useState(canvasSize.width)
  const [customHeight, setCustomHeight] = useState(canvasSize.height)
  const [lockAspectRatio, setLockAspectRatio] = useState(true)
  const [matteColor, setMatteColor] = useState('#FFFFFF')
  const [filename, setFilename] = useState(activeDocument?.name || 'export')
  const [exportArea, setExportArea] = useState<ExportArea>('canvas')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Preview state
  const [zoom, setZoom] = useState(100)
  const [previewMode, setPreviewMode] = useState<'export' | 'original'>('export')
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)

  // Check if image has transparency
  const hasTransparency = useMemo(() => {
    const checkLayer = (layer: Layer): boolean => {
      if (layer.opacity < 100) return true
      if (layer.type === 'text') return true
      if (layer.data) {
        const ctx = layer.data.getContext('2d')
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, layer.data.width, layer.data.height)
          for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] < 255) return true
          }
        }
      }
      if (layer.children) {
        return layer.children.some(checkLayer)
      }
      return false
    }
    return layers.some(checkLayer)
  }, [layers])

  // Calculate export dimensions
  const exportDimensions = useMemo(() => {
    const baseWidth = exportArea === 'selection' && selection 
      ? Math.round(selection.width)
      : canvasSize.width
    const baseHeight = exportArea === 'selection' && selection 
      ? Math.round(selection.height)
      : canvasSize.height
    
    return {
      width: Math.round(baseWidth * scale / 100),
      height: Math.round(baseHeight * scale / 100)
    }
  }, [canvasSize, scale, exportArea, selection])

  // Handle dimension changes with aspect ratio lock
  const handleWidthChange = (newWidth: number) => {
    setCustomWidth(newWidth)
    if (lockAspectRatio) {
      const ratio = canvasSize.height / canvasSize.width
      setCustomHeight(Math.round(newWidth * ratio))
    }
    const newScale = (newWidth / canvasSize.width) * 100
    setScale(Math.round(newScale))
  }

  const handleHeightChange = (newHeight: number) => {
    setCustomHeight(newHeight)
    if (lockAspectRatio) {
      const ratio = canvasSize.width / canvasSize.height
      setCustomWidth(Math.round(newHeight * ratio))
    }
    const newScale = (newHeight / canvasSize.height) * 100
    setScale(Math.round(newScale))
  }

  const handleScaleChange = (newScale: number) => {
    setScale(newScale)
    setCustomWidth(Math.round(canvasSize.width * newScale / 100))
    setCustomHeight(Math.round(canvasSize.height * newScale / 100))
  }

  // Render flattened image to canvas
  const renderFlattenedImage = useCallback((canvas: HTMLCanvasElement, applyMatte: boolean = false) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = exportDimensions
    canvas.width = width
    canvas.height = height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Apply matte color for formats without transparency
    if (applyMatte && !FORMAT_INFO[format].supportsTransparency) {
      ctx.fillStyle = matteColor
      ctx.fillRect(0, 0, width, height)
    }

    // Calculate render offset for selection export
    let offsetX = 0
    let offsetY = 0
    if (exportArea === 'selection' && selection) {
      offsetX = -selection.x
      offsetY = -selection.y
    }

    // Collect all visible layers in render order (bottom to top)
    const collectVisible = (list: Layer[]): Layer[] => {
      const result: Layer[] = []
      for (const l of list) {
        if (!l.visible) continue
        if (l.type === 'group' && l.children) {
          result.push(...collectVisible(l.children))
        } else if (l.data || l.type === 'text') {
          result.push(l)
        }
      }
      return result
    }

    const visibleLayers = collectVisible(layers).reverse()

    // Apply scale transform
    ctx.save()
    ctx.scale(scale / 100, scale / 100)

    for (const layer of visibleLayers) {
      ctx.globalAlpha = layer.opacity / 100
      ctx.globalCompositeOperation = layer.blendMode === 'normal' ? 'source-over' : (layer.blendMode as GlobalCompositeOperation) || 'source-over'
      
      if (layer.type === 'text' && layer.text) {
        // Render text layer
        const s = layer.textStyle || { fontFamily: 'Arial', fontSize: 24, fill: '#000000' }
        const weight = s.fontWeight || 'normal'
        const style = s.fontStyle || 'normal'
        ctx.font = `${style} ${weight} ${s.fontSize}px "${s.fontFamily}"`
        ctx.fillStyle = s.fill
        ctx.textBaseline = 'top'

        const lines = layer.text.split('\n')
        const lineH = s.fontSize * (s.lineHeight || 1.2)

        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], layer.x + offsetX, layer.y + offsetY + i * lineH)
        }
      } else if (layer.data) {
        ctx.drawImage(layer.data, layer.x + offsetX, layer.y + offsetY)
      }
    }

    ctx.restore()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }, [layers, exportDimensions, format, matteColor, exportArea, selection, scale])

  // Generate preview and estimate file size
  useEffect(() => {
    if (!previewCanvasRef.current) return

    setIsGeneratingPreview(true)
    
    // Use requestAnimationFrame for smooth updates
    const frame = requestAnimationFrame(() => {
      renderFlattenedImage(previewCanvasRef.current!, previewMode === 'export' && !FORMAT_INFO[format].supportsTransparency)
      
      // Estimate file size
      previewCanvasRef.current!.toBlob((blob) => {
        if (blob) {
          setEstimatedSize(blob.size)
        }
        setIsGeneratingPreview(false)
      }, FORMAT_INFO[format].mimeType, quality / 100)
    })

    return () => cancelAnimationFrame(frame)
  }, [renderFlattenedImage, format, quality, previewMode])

  // Render original image
  useEffect(() => {
    if (!originalCanvasRef.current) return
    
    const canvas = originalCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = exportDimensions.width
    canvas.height = exportDimensions.height

    // Apply scale transform for original preview
    ctx.save()
    ctx.scale(scale / 100, scale / 100)

    // Render without matte (original)
    const collectVisible = (list: Layer[]): Layer[] => {
      const result: Layer[] = []
      for (const l of list) {
        if (!l.visible) continue
        if (l.type === 'group' && l.children) {
          result.push(...collectVisible(l.children))
        } else if (l.data || l.type === 'text') {
          result.push(l)
        }
      }
      return result
    }

    const visibleLayers = collectVisible(layers).reverse()

    for (const layer of visibleLayers) {
      ctx.globalAlpha = layer.opacity / 100
      ctx.globalCompositeOperation = layer.blendMode === 'normal' ? 'source-over' : (layer.blendMode as GlobalCompositeOperation) || 'source-over'
      
      if (layer.type === 'text' && layer.text) {
        const s = layer.textStyle || { fontFamily: 'Arial', fontSize: 24, fill: '#000000' }
        const weight = s.fontWeight || 'normal'
        const style = s.fontStyle || 'normal'
        ctx.font = `${style} ${weight} ${s.fontSize}px "${s.fontFamily}"`
        ctx.fillStyle = s.fill
        ctx.textBaseline = 'top'

        const lines = layer.text.split('\n')
        const lineH = s.fontSize * (s.lineHeight || 1.2)

        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], layer.x, layer.y + i * lineH)
        }
      } else if (layer.data) {
        ctx.drawImage(layer.data, layer.x, layer.y)
      }
    }

    ctx.restore()
  }, [layers, exportDimensions, scale])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleExport()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Export handler
  const handleExport = useCallback(() => {
    const exportCanvas = document.createElement('canvas')
    renderFlattenedImage(exportCanvas, true)
    
    exportCanvas.toBlob((blob) => {
      if (!blob) return
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.${FORMAT_INFO[format].extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onClose()
    }, FORMAT_INFO[format].mimeType, quality / 100)
  }, [renderFlattenedImage, filename, format, quality, onClose])

  // Format file size for display
  const formatFileSize = (bytes: number | null): string => {
    if (bytes === null) return 'Calculating...'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // Get file size color indicator
  const getFileSizeColor = (bytes: number | null): string => {
    if (bytes === null) return 'var(--text-muted)'
    if (bytes < 500 * 1024) return 'var(--success-color, #22c55e)'
    if (bytes < 2 * 1024 * 1024) return 'var(--warning-color, #eab308)'
    return 'var(--error-color, #ef4444)'
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div 
        className="dialog-content export-dialog" 
        onClick={e => e.stopPropagation()}
        style={{ 
          width: 'min(95vw, 900px)', 
          maxWidth: '900px',
          maxHeight: '90vh'
        }}
        ref={containerRef}
      >
        {/* Header */}
        <div className="dialog-header">
          <span>{t('export.title')}</span>
          <button className="dialog-close-btn" onClick={onClose}>×</button>
        </div>

        {/* Main Content */}
        <div className="export-dialog-content">
          {/* Preview Panel */}
          <div className="export-preview-panel">
            <div className="export-preview-header">
              <div className="export-preview-tabs">
                <button 
                  className={`export-preview-tab ${previewMode === 'export' ? 'active' : ''}`}
                  onClick={() => setPreviewMode('export')}
                >
                  {t('export.preview.export')}
                </button>
                <button 
                  className={`export-preview-tab ${previewMode === 'original' ? 'active' : ''}`}
                  onClick={() => setPreviewMode('original')}
                >
                  {t('export.preview.original')}
                </button>
              </div>
              <div className="export-preview-zoom">
                <button 
                  className="export-zoom-btn" 
                  onClick={() => setZoom(Math.max(25, zoom - 25))}
                  title={t('export.zoom.out')}
                >
                  <ZoomOut size={14} />
                </button>
                <span className="export-zoom-value">{zoom}%</span>
                <button 
                  className="export-zoom-btn" 
                  onClick={() => setZoom(Math.min(400, zoom + 25))}
                  title={t('export.zoom.in')}
                >
                  <ZoomIn size={14} />
                </button>
                <button 
                  className="export-zoom-btn" 
                  onClick={() => setZoom(100)}
                  title={t('export.zoom.reset')}
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
            
            <div className="export-preview-canvas-container">
              <canvas 
                ref={previewCanvasRef}
                className="export-preview-canvas"
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'center center'
                }}
              />
              <canvas 
                ref={originalCanvasRef}
                className="export-preview-canvas"
                style={{
                  display: previewMode === 'original' ? 'block' : 'none',
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'center center'
                }}
              />
              {isGeneratingPreview && (
                <div className="export-preview-loading">
                  <div className="export-preview-spinner" />
                </div>
              )}
            </div>

            <div className="export-preview-info">
              <span>{t('export.dimensions')}: {exportDimensions.width} × {exportDimensions.height} px</span>
              <span style={{ color: getFileSizeColor(estimatedSize), marginLeft: 16 }}>
                {t('export.file_size')}: {formatFileSize(estimatedSize)}
              </span>
            </div>
          </div>

          {/* Options Panel */}
          <div className="export-options-panel">
            {/* Format Selection */}
            <div className="export-option-group">
              <label className="export-option-label">{t('export.format.label')}</label>
              <div className="export-format-options">
                {(Object.keys(FORMAT_INFO) as ExportFormat[]).map((fmt) => {
                  const info = FORMAT_INFO[fmt]
                  const FormatIcon = fmt === 'png' ? Image : fmt === 'jpeg' ? FileImage : Zap
                  return (
                    <button
                      key={fmt}
                      className={`export-format-btn ${format === fmt ? 'active' : ''}`}
                      onClick={() => setFormat(fmt)}
                    >
                      <FormatIcon size={20} />
                      <span className="export-format-name">{info.name}</span>
                      <span className="export-format-desc">{info.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quality Slider (for JPEG/WebP) */}
            {format !== 'png' && (
              <div className="export-option-group">
                <div className="export-option-header">
                  <label className="export-option-label">{t('export.quality.label')}</label>
                  <span className="export-option-value">{quality}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="export-quality-slider"
                />
                <div className="export-quality-labels">
                  <span>{t('export.quality.low')}</span>
                  <span>{t('export.quality.high')}</span>
                </div>
              </div>
            )}

            {/* Matte Color (for JPEG with transparency) */}
            {format === 'jpeg' && hasTransparency && (
              <div className="export-option-group export-warning-group">
                <div className="export-warning">
                  <AlertTriangle size={14} />
                  <span>{t('export.jpeg_transparency_warning')}</span>
                </div>
                <div className="export-matte-option">
                  <label className="export-option-label">{t('export.matte_color')}</label>
                  <div className="export-matte-picker">
                    <input
                      type="color"
                      value={matteColor}
                      onChange={(e) => setMatteColor(e.target.value)}
                      className="export-color-input"
                    />
                    <span className="export-matte-value">{matteColor}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Size Options */}
            <div className="export-option-group">
              <label className="export-option-label">{t('export.size.label')}</label>
              
              {/* Scale Presets */}
              <div className="export-scale-presets">
                {SCALE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    className={`export-scale-preset ${scale === preset ? 'active' : ''}`}
                    onClick={() => handleScaleChange(preset)}
                  >
                    {preset}%
                  </button>
                ))}
              </div>

              {/* Custom Dimensions */}
              <div className="export-dimensions">
                <div className="export-dimension-input">
                  <label>{t('export.size.width')}</label>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => handleWidthChange(Number(e.target.value))}
                    min={1}
                    max={8192}
                  />
                </div>
                <button 
                  className={`export-aspect-lock ${lockAspectRatio ? 'locked' : ''}`}
                  onClick={() => setLockAspectRatio(!lockAspectRatio)}
                  title={lockAspectRatio ? t('export.aspect.unlock') : t('export.aspect.lock')}
                >
                  {lockAspectRatio ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
                <div className="export-dimension-input">
                  <label>{t('export.size.height')}</label>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                    min={1}
                    max={8192}
                  />
                </div>
              </div>
            </div>

            {/* Filename */}
            <div className="export-option-group">
              <label className="export-option-label">{t('export.filename')}</label>
              <div className="export-filename-input">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="filename"
                />
                <span className="export-filename-ext">.{FORMAT_INFO[format].extension}</span>
              </div>
            </div>

            {/* Advanced Options Toggle */}
            <button 
              className="export-advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <ChevronDown 
                size={14} 
                style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
              />
              <span>{t('export.advanced.label')}</span>
            </button>

            {/* Advanced Options */}
            {showAdvanced && (
              <div className="export-advanced-options">
                {/* Export Area */}
                <div className="export-option-group">
                  <label className="export-option-label">{t('export.area.label')}</label>
                  <div className="export-area-options">
                    <button
                      className={`export-area-btn ${exportArea === 'canvas' ? 'active' : ''}`}
                      onClick={() => setExportArea('canvas')}
                    >
                      {t('export.area.canvas')}
                    </button>
                    {selection && (
                      <button
                        className={`export-area-btn ${exportArea === 'selection' ? 'active' : ''}`}
                        onClick={() => setExportArea('selection')}
                      >
                        {t('export.area.selection')}
                      </button>
                    )}
                    {activeLayerId && (
                      <button
                        className={`export-area-btn ${exportArea === 'layer' ? 'active' : ''}`}
                        onClick={() => setExportArea('layer')}
                      >
                        {t('export.area.layer')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="dialog-footer export-dialog-footer">
          <div className="export-footer-info">
            <span>{t('export.original_size')}: {canvasSize.width} × {canvasSize.height} px</span>
          </div>
          <div className="export-footer-actions">
            <button className="export-btn export-btn-secondary" onClick={onClose}>
              {t('export.cancel')}
            </button>
            <button className="export-btn export-btn-primary" onClick={handleExport}>
              <Check size={14} style={{ marginRight: 6 }} />
              {t('export.export_button')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
/**
 * Hook for monitoring and managing history memory usage
 * 
 * This hook provides memory statistics and can optionally use the new
 * delta-compressed history system for better memory efficiency.
 */

import { useState, useEffect, useRef } from 'react'
import { formatBytes, canvasCache } from '../utils/historyCompression'
import type { Document, EditorContent } from '../components/EditorContext'

/**
 * Estimate memory usage of a single EditorContent
 */
function estimateContentMemory(content: EditorContent): number {
  let total = 0

  const estimateLayerMemory = (layer: any): number => {
    let size = 0
    
    // Canvas data
    if (layer.data) {
      // Raw RGBA data size
      const rawSize = layer.data.width * layer.data.height * 4
      // Estimate compressed size (about 30% for PNG/WebP)
      size += rawSize * 0.3
    }
    
    // Children
    if (layer.children) {
      for (const child of layer.children) {
        size += estimateLayerMemory(child)
      }
    }
    
    // Metadata
    size += 1024 // ~1KB for layer metadata
    
    return size
  }

  for (const layer of content.layers) {
    total += estimateLayerMemory(layer)
  }

  // Add size for other content
  total += content.paths.length * 2048 // ~2KB per path
  total += content.guides.length * 128 // ~128 bytes per guide
  total += 4096 // Base overhead

  return total
}

/**
 * Estimate memory usage of a document's history
 */
export function estimateDocumentMemory(document: Document): {
  present: number
  past: number
  future: number
  total: number
} {
  const present = estimateContentMemory(document.history.present)
  
  const past = document.history.past.reduce(
    (sum, content) => sum + estimateContentMemory(content),
    0
  )
  
  const future = document.history.future.reduce(
    (sum, content) => sum + estimateContentMemory(content),
    0
  )

  return {
    present,
    past,
    future,
    total: present + past + future
  }
}

/**
 * Hook to monitor memory usage of the editor
 */
export function useHistoryMemory(
  documents: Document[],
  activeDocumentId: string | null,
  maxMemoryMB: number = 500
) {
  const [stats, setStats] = useState<{
    totalMB: number
    maxMB: number
    activeDocMB: number
    entryCount: number
    isNearLimit: boolean
  }>({
    totalMB: 0,
    maxMB: maxMemoryMB,
    activeDocMB: 0,
    entryCount: 0,
    isNearLimit: false
  })

  // Throttled update
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Clear pending update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // Throttle to 500ms
    updateTimeoutRef.current = setTimeout(() => {
      let totalBytes = 0
      let activeDocBytes = 0
      let entryCount = 0

      for (const doc of documents) {
        const docMemory = estimateDocumentMemory(doc)
        totalBytes += docMemory.total
        entryCount += doc.history.past.length + doc.history.future.length + 1

        if (doc.id === activeDocumentId) {
          activeDocBytes = docMemory.total
        }
      }

      const totalMB = totalBytes / (1024 * 1024)
      const activeDocMB = activeDocBytes / (1024 * 1024)

      setStats({
        totalMB,
        maxMB: maxMemoryMB,
        activeDocMB,
        entryCount,
        isNearLimit: totalMB > maxMemoryMB * 0.8
      })
    }, 500)

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [documents, activeDocumentId, maxMemoryMB])

  return stats
}

/**
 * Get canvas cache statistics
 */
export function useCanvasCacheStats() {
  const [cacheStats, setCacheStats] = useState(canvasCache.getStats())

  useEffect(() => {
    const interval = setInterval(() => {
      setCacheStats(canvasCache.getStats())
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return cacheStats
}

/**
 * Format memory for display
 */
export { formatBytes }

/**
 * Check if we should warn about memory
 */
export function shouldWarnMemory(currentMB: number, maxMB: number): boolean {
  return currentMB > maxMB * 0.9
}

/**
 * Get memory pressure level
 */
export type MemoryPressure = 'low' | 'medium' | 'high' | 'critical'

export function getMemoryPressure(currentMB: number, maxMB: number): MemoryPressure {
  const ratio = currentMB / maxMB
  if (ratio < 0.5) return 'low'
  if (ratio < 0.75) return 'medium'
  if (ratio < 0.9) return 'high'
  return 'critical'
}

/**
 * Get color for memory pressure level
 */
export function getMemoryPressureColor(pressure: MemoryPressure): string {
  switch (pressure) {
    case 'low': return '#4ade80' // green
    case 'medium': return '#facc15' // yellow
    case 'high': return '#fb923c' // orange
    case 'critical': return '#ef4444' // red
  }
}
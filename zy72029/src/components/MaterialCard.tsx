import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/store/gameStore'
import type { Material } from '@/types'
import { FileText, Eye } from 'lucide-react'

interface Props {
  material: Material
  isPlaced: boolean
}

export function MaterialCard({ material, isPlaced }: Props) {
  const [isShaking, setIsShaking] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const { clickMaterial, placeMaterial, status, placedMaterials, removeMaterial } = useGameStore()

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'identity': return 'border-calm-blue'
      case 'policy': return 'border-success-green'
      case 'accident': return 'border-warning-orange'
      case 'medical': return 'border-danger-red'
      case 'other': return 'border-purple-400'
      default: return 'border-gray-500'
    }
  }

  const getCategoryBg = (category: string) => {
    switch (category) {
      case 'identity': return 'bg-calm-blue/10'
      case 'policy': return 'bg-success-green/10'
      case 'accident': return 'bg-warning-orange/10'
      case 'medical': return 'bg-danger-red/10'
      case 'other': return 'bg-purple-400/10'
      default: return 'bg-gray-500/10'
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !cardRef.current) return
    e.preventDefault()
    cardRef.current.style.position = 'fixed'
    cardRef.current.style.left = `${e.clientX - dragOffset.current.x}px`
    cardRef.current.style.top = `${e.clientY - dragOffset.current.y}px`
    cardRef.current.style.zIndex = '1000'
    cardRef.current.style.pointerEvents = 'none'
    cardRef.current.style.opacity = '0.85'
    cardRef.current.style.transform = 'scale(1.05)'
    cardRef.current.style.boxShadow = '0 10px 40px rgba(0,0,0,0.4)'
    cardRef.current.style.transition = 'none'
  }, [])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    if (cardRef.current) {
      cardRef.current.style.position = ''
      cardRef.current.style.left = ''
      cardRef.current.style.top = ''
      cardRef.current.style.zIndex = ''
      cardRef.current.style.pointerEvents = ''
      cardRef.current.style.opacity = ''
      cardRef.current.style.transform = ''
      cardRef.current.style.boxShadow = ''
      cardRef.current.style.transition = ''
    }

    const dropZones = document.querySelectorAll('[data-slot-id]')
    let dropped = false

    dropZones.forEach(zone => {
      const rect = zone.getBoundingClientRect()
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        const slotId = zone.getAttribute('data-slot-id')
        if (slotId) {
          placeMaterial(material.id, slotId, e.clientX, e.clientY)
          dropped = true
        }
      }
    })

    if (!dropped && isPlaced) {
      const currentSlot = placedMaterials[material.id]
      if (currentSlot) {
        removeMaterial(material.id)
      }
    }

    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }, [material.id, placeMaterial, isPlaced, placedMaterials, removeMaterial, handleMouseMove])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (status !== 'playing') return
    e.preventDefault()

    const rect = cardRef.current?.getBoundingClientRect()
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
    startPosRef.current = { x: e.clientX, y: e.clientY }
    isDraggingRef.current = true

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [status, handleMouseMove, handleMouseUp])

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (status !== 'playing') return
    const dx = Math.abs(e.clientX - startPosRef.current.x)
    const dy = Math.abs(e.clientY - startPosRef.current.y)
    if (dx > 5 || dy > 5) return

    clickMaterial(material.id, e.clientX, e.clientY)
  }, [status, material.id, clickMaterial])

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`w-40 p-3 bg-paper-cream text-charcoal border-2 ${getCategoryColor(material.category)} 
        ${getCategoryBg(material.category)} cursor-grab active:cursor-grabbing
        hover:shadow-lg hover:-translate-y-1 transition-all duration-200 select-none
        ${isPlaced ? 'opacity-50' : ''}
        ${isShaking ? 'animate-shake' : ''}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div className="flex items-start gap-2 mb-2">
        <FileText size={16} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-bold truncate">{material.title}</div>
          <div className="text-[10px] text-white/50 bg-black/10 px-1 inline-block rounded-sm mt-0.5">
            {material.category}
          </div>
        </div>
        <Eye size={14} className="flex-shrink-0 opacity-50 hover:opacity-100" />
      </div>
      <div className="text-xs opacity-70 line-clamp-2">{material.content}</div>

      {material.originalNote && (
        <div className="mt-2 pt-2 border-t border-black/10">
          <div className="raw-note text-[11px]">{material.originalNote}</div>
        </div>
      )}
    </motion.div>
  )
}

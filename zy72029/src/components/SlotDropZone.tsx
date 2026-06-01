import { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { GameSlot, Material } from '@/types'
import { Inbox, X } from 'lucide-react'

interface Props {
  slot: GameSlot
  placedMaterials: Material[]
}

export function SlotDropZone({ slot, placedMaterials }: Props) {
  const [isDragOver, setIsDragOver] = useState(false)
  const { removeMaterial, status } = useGameStore()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (status === 'playing') {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const getAcceptedCategoriesText = () => {
    const categoryMap: Record<string, string> = {
      identity: '身份证明',
      policy: '保单信息',
      accident: '事故证明',
      medical: '费用证明',
      other: '其他材料',
    }
    return slot.acceptedCategories.map(c => categoryMap[c] || c).join('、')
  }

  return (
    <div
      data-slot-id={slot.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 min-h-[200px] p-4 border-2 border-dashed transition-all duration-200
        ${isDragOver ? 'border-calm-blue bg-calm-blue/10 drag-over' : 'border-white/20 bg-white/5'}
        ${placedMaterials.length > 0 ? 'border-solid border-success-green/50' : ''}`}
    >
      <div className="mb-3 pb-2 border-b border-white/10">
        <div className="font-mono font-bold text-lg text-paper-cream flex items-center gap-2">
          <Inbox size={18} />
          {slot.label}
        </div>
        <div className="text-xs text-white/50 mt-1">
          接受：{getAcceptedCategoriesText()}
        </div>
        <div className="text-[11px] text-white/40 mt-0.5">
          {slot.description}
        </div>
      </div>

      <div className="space-y-2">
        {placedMaterials.map(material => (
          <div
            key={material.id}
            className="bg-paper-cream/90 text-charcoal p-2 rounded-sm text-sm relative group"
          >
            <div className="font-mono font-medium text-xs">{material.title}</div>
            <div className="text-[11px] opacity-70 truncate">{material.content}</div>
            {status === 'playing' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeMaterial(material.id)
                }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-danger-red text-white rounded-full 
                  opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}

        {placedMaterials.length === 0 && (
          <div className="text-center text-white/30 py-8">
            <Inbox size={32} className="mx-auto mb-2 opacity-50" />
            <div className="text-xs">拖拽材料到此处</div>
          </div>
        )}
      </div>
    </div>
  )
}

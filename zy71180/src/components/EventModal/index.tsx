import { motion, AnimatePresence } from 'framer-motion'
import { Check, AlertTriangle, Info, ThumbsUp, ThumbsDown } from 'lucide-react'
import type { GameEvent } from '@/types/game'

interface EventModalProps {
  event: GameEvent | null
  onConfirm: () => void
}

const typeConfig = {
  positive: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    iconBg: 'bg-green-500',
    text: 'text-green-700',
    icon: ThumbsUp,
    label: '正面事件'
  },
  negative: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    iconBg: 'bg-red-500',
    text: 'text-red-700',
    icon: ThumbsDown,
    label: '负面事件'
  },
  neutral: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    iconBg: 'bg-blue-500',
    text: 'text-blue-700',
    icon: Info,
    label: '中性事件'
  }
}

export default function EventModal({ event, onConfirm }: EventModalProps) {
  if (!event) return null

  const config = typeConfig[event.type]
  const Icon = config.icon

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className={`${config.bg} ${config.border} border-4 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden`}
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <div className={`${config.iconBg} p-6 flex items-center justify-center`}>
            <motion.div
              initial={{ rotate: -10, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
            >
              <Icon className="w-16 h-16 text-white" />
            </motion.div>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className={`${config.iconBg} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                {config.label}
              </span>
            </div>

            <h2 className={`text-2xl font-bold ${config.text} mb-3`}>
              {event.title}
            </h2>

            <p className="text-gray-700 text-base leading-relaxed mb-6">
              {event.description}
            </p>

            <div className="flex items-center gap-2 text-sm text-gray-600 mb-6 p-3 bg-white/50 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              <span>效果：{formatEffect(event)}</span>
            </div>

            <motion.button
              className={`w-full ${config.iconBg} hover:opacity-90 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-opacity`}
              onClick={onConfirm}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Check className="w-5 h-5" />
              确认
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function formatEffect(event: GameEvent): string {
  const effectMap: Record<string, string> = {
    oil_increase: '油量增加',
    complaint: '投诉变化',
    capacity_change: '容量变化',
    road_block: '道路封锁',
    bonus_score: '奖励分数'
  }
  const effectName = effectMap[event.effect.type] || event.effect.type
  const sign = event.effect.value >= 0 ? '+' : ''
  return `${effectName} ${sign}${event.effect.value}`
}

import { useGameStore } from '@/store/gameStore'
import { motion, AnimatePresence } from 'framer-motion'

export function FloatingMessages() {
  const { floatingMessages } = useGameStore()

  const getMessageColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-success-green'
      case 'error': return 'text-danger-red'
      case 'warning': return 'text-warning-orange'
      default: return 'text-paper-cream'
    }
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <AnimatePresence>
        {floatingMessages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: -40 }}
            exit={{ opacity: 0, y: -60 }}
            transition={{ duration: 0.8 }}
            className={`absolute font-mono font-bold text-lg ${getMessageColor(msg.type)}`}
            style={{ left: msg.x, top: msg.y }}
          >
            {msg.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

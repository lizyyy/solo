import { motion } from 'framer-motion'
import { Clock, AlertTriangle, Truck as TruckIcon, Droplets, Star } from 'lucide-react'
import type { Level, Truck, Restaurant } from '@/types/game'

interface InfoPanelProps {
  level: Level | null
  currentTurn: number
  score: number
  complaints: number
  truck: Truck | null
  restaurants: Restaurant[]
}

export default function InfoPanel({
  level,
  currentTurn,
  score,
  complaints,
  truck,
  restaurants,
}: InfoPanelProps) {
  const maxTurns = level?.maxTurns ?? 0
  const maxComplaints = level?.maxComplaints ?? 0
  const capacity = truck?.capacity ?? 0
  const currentLoad = truck?.currentLoad ?? 0

  const complaintRatio = maxComplaints > 0 ? complaints / maxComplaints : 0
  const isComplaintCritical = complaintRatio >= 0.8
  const capacityRatio = capacity > 0 ? currentLoad / capacity : 0

  const totalOilPerTurn = restaurants.reduce((sum, r) => sum + r.oilPerTurn, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-slate-700"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <span className="text-slate-300 font-medium">回合</span>
          </div>
          <span className="text-white font-bold text-lg">
            {currentTurn} / {maxTurns}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            <span className="text-slate-300 font-medium">分数</span>
          </div>
          <span className="text-yellow-400 font-bold text-lg">{score}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`w-5 h-5 ${isComplaintCritical ? 'text-red-400' : 'text-orange-400'}`}
              />
              <span className="text-slate-300 font-medium">投诉</span>
            </div>
            <span
              className={`font-bold ${isComplaintCritical ? 'text-red-400' : 'text-orange-400'}`}
            >
              {complaints} / {maxComplaints}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${complaintRatio * 100}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full rounded-full ${
                isComplaintCritical
                  ? 'bg-gradient-to-r from-red-500 to-red-400'
                  : 'bg-gradient-to-r from-orange-500 to-orange-400'
              }`}
              {...(isComplaintCritical
                ? {
                    animate: {
                      opacity: [1, 0.6, 1],
                      scaleX: [1, 1.02, 1],
                    },
                    transition: {
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    },
                  }
                : {})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TruckIcon className="w-5 h-5 text-green-400" />
              <span className="text-slate-300 font-medium">车辆容量</span>
            </div>
            <span className="text-green-400 font-bold">
              {currentLoad} / {capacity}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${capacityRatio * 100}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-amber-400" />
            <span className="text-slate-300 font-medium">每回合产油</span>
          </div>
          <span className="text-amber-400 font-bold">+{totalOilPerTurn}</span>
        </div>
      </div>
    </motion.div>
  )
}

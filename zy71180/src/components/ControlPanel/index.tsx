import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Trash2,
  RotateCcw,
  Play,
  Pause,
  RefreshCw,
  Home,
  Navigation,
  CheckCircle,
  XCircle,
  Fuel,
  Route,
} from 'lucide-react'
import type { RouteNode, Restaurant, Station } from '@/types/game'

interface RouteValidation {
  valid: boolean
  reason?: string
}

interface ControlPanelProps {
  plannedRoute: RouteNode[]
  routeValidation: RouteValidation | null
  totalDistance: number
  expectedCollection: Record<string, number>
  onRemoveNode: (index: number) => void
  onClearRoute: () => void
  onAutoPlan: () => void
  onExecuteTurn: () => void
  onPause: () => void
  onRestart: () => void
  onMenu: () => void
  isPaused: boolean
  isAnimating: boolean
  isValid: boolean
  restaurants: Restaurant[]
  station: Station
}

export default function ControlPanel({
  plannedRoute,
  routeValidation,
  totalDistance,
  expectedCollection,
  onRemoveNode,
  onClearRoute,
  onAutoPlan,
  onExecuteTurn,
  onPause,
  onRestart,
  onMenu,
  isPaused,
  isAnimating,
  isValid,
  restaurants,
  station,
}: ControlPanelProps) {
  const getNodeName = (node: RouteNode) => {
    if (node.type === 'restaurant') {
      const restaurant = restaurants.find((r) => r.id === node.id)
      return restaurant?.name ?? '餐厅'
    }
    return station?.name ?? '处理站'
  }

  const totalCollected = Object.values(expectedCollection).reduce((sum, val) => sum + val, 0)

  const canExecute =
    isValid &&
    routeValidation?.valid &&
    plannedRoute.length > 0 &&
    !isAnimating &&
    !isPaused

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-slate-700 flex flex-col h-full"
    >
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Route className="w-5 h-5 text-blue-400" />
        路线规划
      </h3>

      <div className="flex-1 min-h-0 flex flex-col gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">已规划节点</span>
            <span className="text-slate-300">{plannedRoute.length} 个</span>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
            {plannedRoute.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">
                点击地图添加路线节点
              </p>
            ) : (
              <AnimatePresence>
                {plannedRoute.map((node, index) => (
                  <motion.div
                    key={`${node.id}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2 group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">
                        {index + 1}
                      </span>
                      <MapPin
                        className={`w-4 h-4 ${
                          node.type === 'restaurant'
                            ? 'text-amber-400'
                            : 'text-green-400'
                        }`}
                      />
                      <span className="text-sm text-slate-200">
                        {getNodeName(node)}
                      </span>
                    </div>
                    <button
                      onClick={() => onRemoveNode(index)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                      disabled={isAnimating}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-400" />
              <span className="text-slate-400">预计距离</span>
            </div>
            <span className="text-white font-medium">
              {totalDistance.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">预计收集量</span>
            </div>
            <span className="text-amber-400 font-medium">
              +{totalCollected.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {routeValidation ? (
              routeValidation.valid ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">路线有效</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400">{routeValidation.reason}</span>
                </>
              )
            ) : (
              <>
                <CheckCircle className="w-4 h-4 text-slate-500" />
                <span className="text-slate-500">等待规划路线</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClearRoute}
            disabled={isAnimating || plannedRoute.length === 0}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            清空路线
          </button>
          <button
            onClick={onAutoPlan}
            disabled={isAnimating}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm transition-colors"
          >
            <Navigation className="w-4 h-4" />
            自动规划
          </button>
        </div>

        <button
          onClick={onExecuteTurn}
          disabled={!canExecute}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white transition-all ${
            canExecute
              ? 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/25'
              : 'bg-slate-600 cursor-not-allowed opacity-50'
          }`}
        >
          {isAnimating ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {isAnimating ? '执行中...' : '执行回合'}
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onPause}
            disabled={isAnimating}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-sm transition-colors"
          >
            {isPaused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
            {isPaused ? '继续' : '暂停'}
          </button>
          <button
            onClick={onRestart}
            disabled={isAnimating}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重开
          </button>
          <button
            onClick={onMenu}
            disabled={isAnimating}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-sm transition-colors"
          >
            <Home className="w-4 h-4" />
            菜单
          </button>
        </div>
      </div>
    </motion.div>
  )
}

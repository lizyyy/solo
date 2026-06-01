import { Activity, CheckCircle, XCircle, TrendingUp, AlertTriangle } from 'lucide-react'
import type { GameSession, ActionRecord, ExceptionRecord } from '@/types'

interface StatsOverviewProps {
  session: GameSession
  actions: ActionRecord[]
  exceptions: ExceptionRecord[]
}

export default function StatsOverview({ session, actions, exceptions }: StatsOverviewProps) {
  const successCount = session.status === 'completed' ? 1 : 0
  const failCount = session.status === 'failed' ? 1 : 0

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="card-cafe text-center">
        <Activity className="w-5 h-5 mx-auto text-data-blue mb-1" />
        <p className="text-2xl font-bold text-cafe-brown">{actions.length}</p>
        <p className="text-xs text-cafe-brown/50">操作次数</p>
      </div>

      <div className="card-cafe text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <CheckCircle className="w-4 h-4 text-safe-green" />
          <XCircle className="w-4 h-4 text-risk-red" />
        </div>
        <p className="text-2xl font-bold text-cafe-brown">
          <span className="text-safe-green">{successCount}</span>
          <span className="text-cafe-brown/30 mx-0.5">/</span>
          <span className="text-risk-red">{failCount}</span>
        </p>
        <p className="text-xs text-cafe-brown/50">成功/失败</p>
      </div>

      <div className="card-cafe text-center">
        <TrendingUp className="w-5 h-5 mx-auto text-safe-green mb-1" />
        <p className="text-2xl font-bold text-cafe-brown">
          {session.currentScore.toFixed(1)}
        </p>
        <p className="text-xs text-cafe-brown/50">最终分数</p>
      </div>

      <div
        className={`card-cafe text-center ${
          exceptions.length > 0 ? 'border-risk-yellow' : ''
        }`}
      >
        <AlertTriangle
          className={`w-5 h-5 mx-auto mb-1 ${
            exceptions.length > 0 ? 'text-risk-yellow' : 'text-cafe-brown/30'
          }`}
        />
        <p className="text-2xl font-bold text-cafe-brown">{exceptions.length}</p>
        <p className="text-xs text-cafe-brown/50">例外数</p>
      </div>
    </div>
  )
}

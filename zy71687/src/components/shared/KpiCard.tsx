import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string
  icon: ReactNode
  trend?: 'up' | 'down'
  trendValue?: string
  color?: string
}

export default function KpiCard({ label, value, icon, trend, trendValue, color = '#00d4aa' }: KpiCardProps) {
  return (
    <div className="bg-[#1a1f2e] rounded-lg border border-white/5 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs">{label}</span>
        <span className="text-gray-500">{icon}</span>
      </div>

      <div className="flex items-end justify-between">
        <span className="font-mono text-2xl font-bold" style={{ color }}>
          {value}
        </span>

        {trend && trendValue && (
          <div
            className={`flex items-center gap-0.5 text-xs font-mono ${
              trend === 'up' ? 'text-[#00d4aa]' : 'text-[#ef4444]'
            }`}
          >
            {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {trendValue}
          </div>
        )}
      </div>
    </div>
  )
}

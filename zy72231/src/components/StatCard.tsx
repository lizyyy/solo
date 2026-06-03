import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: number
  color: string
  icon: ReactNode
}

export default function StatCard({ label, value, color, icon }: StatCardProps) {
  return (
    <div className="bg-[#1A2B3C] rounded-xl p-4 border border-slate-700/50 relative overflow-hidden">
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{
          background: `linear-gradient(to right, ${color}00, ${color})`,
        }}
      />
      <div style={{ color }}>{icon}</div>
      <div className="text-3xl font-bold text-white font-mono mt-2">
        {value}
      </div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  )
}

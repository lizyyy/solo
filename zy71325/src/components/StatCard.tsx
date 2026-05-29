interface Props {
  label: string
  value: string | number
  unit?: string
  color?: string
  icon?: React.ReactNode
}

export default function StatCard({ label, value, unit, color = "amber", icon }: Props) {
  const colorMap: Record<string, string> = {
    amber: "from-amber-500/10 to-amber-700/5 border-amber-500/20 text-amber-400",
    emerald: "from-emerald-500/10 to-emerald-700/5 border-emerald-500/20 text-emerald-400",
    red: "from-red-500/10 to-red-700/5 border-red-500/20 text-red-400",
    blue: "from-blue-500/10 to-blue-700/5 border-blue-500/20 text-blue-400",
    purple: "from-purple-500/10 to-purple-700/5 border-purple-500/20 text-purple-400",
  }

  const classes = colorMap[color] || colorMap.amber

  return (
    <div className={`bg-gradient-to-br ${classes} border rounded-xl p-4`}>
      {icon && <div className="mb-2 opacity-60">{icon}</div>}
      <div className="text-2xl font-bold font-['JetBrains_Mono',monospace]">
        {value}
        {unit && <span className="text-xs ml-1 font-normal opacity-60">{unit}</span>}
      </div>
      <div className="text-xs opacity-60 mt-1">{label}</div>
    </div>
  )
}

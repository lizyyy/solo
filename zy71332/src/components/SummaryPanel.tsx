interface Props {
  conflictCount: number
  adjacencyRiskCount: number
  pendingCount: number
}

export default function SummaryPanel({ conflictCount, adjacencyRiskCount, pendingCount }: Props) {
  const cards = [
    { label: '冲突数量', value: conflictCount, bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400' },
    { label: '邻接风险', value: adjacencyRiskCount, bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400' },
    { label: '未处理项', value: pendingCount, bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`${c.bg} border ${c.border} rounded-lg p-5 text-center`}>
          <p className={`text-4xl font-bold ${c.text} mono`}>{c.value}</p>
          <p className="text-sm text-brand-300 mt-2">{c.label}</p>
        </div>
      ))}
    </div>
  )
}

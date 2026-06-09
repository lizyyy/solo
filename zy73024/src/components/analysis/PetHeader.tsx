import type { Pet } from '../../types'

const statusMap: Record<Pet['status'], { label: string; cls: string }> = {
  pending: { label: '待跟进', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  reviewing: { label: '审核中', cls: 'bg-clay-50 text-clay-700 border-clay-200' },
  processed: { label: '已处理', cls: 'bg-sage-50 text-sage-700 border-sage-200' },
  completed: { label: '已完成', cls: 'bg-rust-50 text-rust-700 border-rust-200' },
}

interface Props {
  pet: Pet
}

export default function PetHeader({ pet }: Props) {
  const score = pet.confidenceScore
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const statusInfo = statusMap[pet.status]

  return (
    <div className="card p-5 flex items-center gap-5">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-paper to-paper-deep flex items-center justify-center text-5xl shadow-inner border border-clay-100 shrink-0">
          {pet.avatarEmoji}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-kai text-3xl text-clay-900 leading-tight">{pet.name}</h1>
            <span className={`tag-tag border ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          </div>
          {pet.aliases.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {pet.aliases.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-paper-deep/80 text-graphite-500 border border-clay-100"
                >
                  曾用名: {a}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-5 text-sm">
            <div className="text-graphite-500">
              入站 <span className="num text-clay-800 font-medium">{pet.startWeight}kg</span>
              <span className="mx-1.5 text-clay-300">→</span>
              当前 <span className="num text-clay-800 font-medium">{pet.currentWeight}kg</span>
              {pet.targetWeight && (
                <>
                  <span className="mx-1.5 text-clay-300">→</span>
                  目标 <span className="num text-sage-700 font-medium">{pet.targetWeight}kg</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5 shrink-0">
        {pet.reviewer && (
          <div className="text-right">
            <div className="text-[11px] text-graphite-400 uppercase tracking-wide">负责人</div>
            <div className="mt-1 flex items-center justify-end gap-2">
              <div className="w-8 h-8 rounded-full bg-clay-100 text-clay-700 flex items-center justify-center font-kai font-bold text-sm">
                {pet.reviewer.slice(-1)}
              </div>
              <div className="font-medium text-clay-800">{pet.reviewer}</div>
            </div>
          </div>
        )}
        <div className="text-right">
          <div className="text-[11px] text-graphite-400 uppercase tracking-wide mb-1">数据可信度</div>
          <div className="relative w-14 h-14">
            <svg viewBox="0 0 60 60" className="w-14 h-14 -rotate-90">
              <circle cx="30" cy="30" r={radius} fill="none" stroke="#F4E0CE" strokeWidth="6" />
              <circle
                cx="30"
                cy="30"
                r={radius}
                fill="none"
                stroke="#C87941"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="num text-sm font-bold text-clay-700">{score}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

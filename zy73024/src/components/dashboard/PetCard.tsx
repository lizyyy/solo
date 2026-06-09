import { Link } from 'react-router-dom'
import type { Pet } from '../../types'
import StatusTag from '../common/StatusTag'
import IconFlag from '../common/IconFlag'
import MiniWeightChart from './MiniWeightChart'

interface PetCardProps {
  pet: Pet
}

export default function PetCard({ pet }: PetCardProps) {
  const weightDiff = pet.currentWeight - pet.startWeight
  const weightRate = (weightDiff / pet.startWeight) * 100
  const isLosing = weightDiff < 0

  return (
    <Link to={`/pet/${pet.id}`} className="card p-5 relative block group hover:-translate-y-1">
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
        <span className="text-[10px] text-clay-400 font-medium">置信度 {pet.confidenceScore}%</span>
        <div className="w-20 h-1 bg-clay-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sage rounded-full transition-all"
            style={{ width: `${pet.confidenceScore}%` }}
          />
        </div>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-paper flex items-center justify-center text-3xl shadow-inner shrink-0">
          {pet.avatarEmoji}
        </div>
        <div className="min-w-0 pt-1">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h3 className="font-kai text-xl text-clay-900 leading-tight">{pet.name}</h3>
            {pet.aliases.length > 0 && (
              <span className="text-xs text-clay-400 truncate">
                ({pet.aliases.slice(0, 2).join(' / ')}
                {pet.aliases.length > 2 ? '…' : ''})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <MiniWeightChart petId={pet.id} />
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[10px] text-clay-400 mb-0.5">当前体重</div>
          <div className="flex items-baseline gap-1">
            <span className="num text-2xl font-bold text-clay-800">{pet.currentWeight.toFixed(1)}</span>
            <span className="text-xs text-clay-400">kg</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-clay-400 mb-0.5">相对入站</div>
          <div className={`num text-sm font-bold ${isLosing ? 'text-sage-600' : 'text-rust-500'}`}>
            {weightDiff > 0 ? '+' : ''}
            {weightDiff.toFixed(1)}kg
            <span className="ml-1 text-[11px]">
              ({weightRate > 0 ? '+' : ''}
              {weightRate.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      {pet.anomalyCount > 0 && (
        <div className="absolute top-16 right-5">
          <IconFlag variant={pet.highAnomalyCount > 0 ? 'rust' : 'clay'} pulse={pet.highAnomalyCount > 0}>
            ⚠️ {pet.anomalyCount}异常
          </IconFlag>
        </div>
      )}

      <div className="pt-3 border-t border-clay-100 flex items-center justify-between gap-2">
        <StatusTag status={pet.status} />
        <div className="text-[11px] text-clay-400 text-right leading-tight">
          <div>{pet.lastUpdatedAt}</div>
          {pet.reviewer && <div className="text-clay-500">{pet.reviewer}跟进</div>}
        </div>
      </div>
    </Link>
  )
}

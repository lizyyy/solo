import { useMemo } from 'react'
import { pets } from '../../data/mockPets'
import { anomalies } from '../../data/mockAnomalies'
import { useAppStore } from '../../store/useAppStore'
import type { AnomalyType, ImpactLevel, Status } from '../../types'
import PetCard from './PetCard'

export default function PetGrid() {
  const searchQuery = useAppStore((s) => s.searchQuery)
  const statusFilter = useAppStore((s) => s.statusFilter)
  const anomalyTypeFilter = useAppStore((s) => s.anomalyTypeFilter)
  const impactLevelFilter = useAppStore((s) => s.impactLevelFilter)

  const filteredPets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return pets.filter((pet) => {
      if (q) {
        const nameMatch = pet.name.toLowerCase().includes(q)
        const aliasMatch = pet.aliases.some((a) => a.toLowerCase().includes(q))
        if (!nameMatch && !aliasMatch) return false
      }

      if (statusFilter !== 'all' && pet.status !== (statusFilter as Status)) {
        return false
      }

      const petAnomalies = anomalies.filter((a) => a.petId === pet.id)

      if (anomalyTypeFilter !== 'all') {
        const hasType = petAnomalies.some((a) => a.type === (anomalyTypeFilter as AnomalyType))
        if (!hasType) return false
      }

      if (impactLevelFilter !== 'all') {
        const hasLevel = petAnomalies.some((a) => a.level === (impactLevelFilter as ImpactLevel))
        if (!hasLevel) return false
      }

      return true
    })
  }, [searchQuery, statusFilter, anomalyTypeFilter, impactLevelFilter])

  if (filteredPets.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-3">🔍</div>
        <div className="font-kai text-lg text-clay-700 mb-1">没有找到匹配的宠物</div>
        <div className="text-sm text-clay-400">试试调整搜索条件或重置筛选</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {filteredPets.map((pet, i) => (
        <div
          key={pet.id}
          style={{ animationDelay: `${i * 80}ms` }}
          className="animate-fade-up"
        >
          <PetCard pet={pet} />
        </div>
      ))}
    </div>
  )
}

import { Link, useParams } from 'react-router-dom'
import { pets } from '../data/mockPets'
import { weightRecords } from '../data/mockWeightRecords'
import { anomalies } from '../data/mockAnomalies'
import { traceNodes, reviewDecisions, abnormalNotes } from '../data/mockTraces'
import PetHeader from '../components/analysis/PetHeader'
import WeightChart from '../components/analysis/WeightChart'
import RecordTimeline from '../components/analysis/RecordTimeline'
import TraceChain from '../components/analysis/TraceChain'
import AbnormalNoteCard from '../components/analysis/AbnormalNoteCard'
import ReviewTable from '../components/analysis/ReviewTable'

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>()
  const pet = pets.find((p) => p.id === id)

  if (!pet) {
    return (
      <div className="card p-10 text-center animate-zoom-in">
        <div className="text-6xl mb-5">🐾</div>
        <h2 className="font-kai text-3xl text-clay-700 mb-2">找不到这份档案</h2>
        <p className="text-clay-500 mb-6">宠物ID: {id}，可能已归档或链接输入错误</p>
        <Link to="/dashboard" className="btn-primary">
          📋 返回追踪汇总
        </Link>
      </div>
    )
  }

  const records = weightRecords.filter((r) => r.petId === pet.id)
  const petAnomalies = anomalies.filter((a) => a.petId === pet.id)
  const petTraces = traceNodes.filter((t) => petAnomalies.some((a) => a.id === t.anomalyId))
  const petReviews = reviewDecisions.filter((r) => r.petId === pet.id)
  const petAbnormalNotes = abnormalNotes.filter((n) => n.petId === pet.id)

  return (
    <div className="space-y-6 animate-zoom-in">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/dashboard" className="btn-ghost">
          ← 返回追踪汇总
        </Link>
        <Link to="/delivery" className="btn-ghost">
          📤 查看交付说明
        </Link>
        <div className="ml-auto flex items-center gap-2 text-xs text-graphite-400">
          <span>📝 档案编号</span>
          <span className="num font-medium text-clay-600 bg-clay-50 px-2 py-0.5 rounded">{pet.id.toUpperCase()}</span>
        </div>
      </div>

      <PetHeader pet={pet} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <WeightChart records={records} petName={pet.name} />
          <RecordTimeline records={records} petName={pet.name} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <TraceChain anomalies={petAnomalies} traceNodes={petTraces} />

          <AbnormalNoteCard notes={petAbnormalNotes} />

          <ReviewTable decisions={petReviews} />
        </div>
      </div>
    </div>
  )
}

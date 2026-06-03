import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Radio, Camera, RefreshCw, Copy, Check } from 'lucide-react'
import { useCalibrationStore } from '@/store/useCalibrationStore'
import StatusBadge from '@/components/StatusBadge'
import CoordinateTable from '@/components/CoordinateTable'
import FieldNoteCard from '@/components/FieldNoteCard'
import OperationTimeline from '@/components/OperationTimeline'

function PhotoSection({ onUpdated }: { onUpdated: () => void }) {
  const { currentRecord, supplementPhoto } = useCalibrationStore()
  const [newIds, setNewIds] = useState('')
  const [operator, setOperator] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!currentRecord) return null

  const handleSubmit = async () => {
    if (!newIds.trim() || !operator.trim()) return
    setSubmitting(true)
    const ids = newIds.split(',').map((s) => s.trim()).filter(Boolean)
    const ok = await supplementPhoto(currentRecord.id, ids, operator.trim())
    setSubmitting(false)
    if (ok) { setNewIds(''); setOperator(''); onUpdated() }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-5">
      <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
        <Camera className="h-4 w-4 text-status-blue" />
        巡检照片
      </h3>
      {currentRecord.photoIds.length > 0 ? (
        <div className="space-y-1 mb-3">
          {currentRecord.photoIds.map((id) => (
            <p key={id} className="text-sm data-font text-text-primary">{id}</p>
          ))}
          {currentRecord.photoSupplementedAt && (
            <p className="text-xs text-text-secondary mt-2">
              补录人: {currentRecord.photoSupplementedBy} · {currentRecord.photoSupplementedAt}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-status-blue mb-3">尚未补录巡检照片编号</p>
      )}
      <div className="space-y-2">
        <input
          value={newIds}
          onChange={(e) => setNewIds(e.target.value)}
          placeholder="照片编号，逗号分隔"
          className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text-primary data-font placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <input
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            placeholder="操作人"
            className="flex-1 rounded border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !newIds.trim() || !operator.trim()}
            className="rounded bg-status-blue px-4 py-2 text-sm font-medium text-white hover:bg-status-blue/90 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '补录'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RerunSection({ recordId }: { recordId: string }) {
  const [copied, setCopied] = useState(false)
  const command = `curl -X POST http://localhost:3001/api/records/${recordId}/rerun -H "Content-Type: application/json" -d '{"operator":"system"}'`

  const handleCopy = () => {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-5">
      <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-status-red" />
        重跑命令
      </h3>
      <div className="relative">
        <pre className="rounded border border-border bg-bg p-3 text-xs data-font text-text-secondary overflow-x-auto pr-10">
          {command}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 text-text-secondary hover:text-text-primary"
        >
          {copied ? <Check className="h-4 w-4 text-status-green" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentRecord, operationLogs, fieldTeamNote, loading, fetchRecordDetail, fetchLogs, fetchNote, rerunCalibration } = useCalibrationStore()
  const [rerunning, setRerunning] = useState(false)

  useEffect(() => {
    if (id) {
      fetchRecordDetail(id)
      fetchLogs(id)
      fetchNote(id)
    }
  }, [id, fetchRecordDetail, fetchLogs, fetchNote])

  const reloadDetail = () => {
    if (id) {
      fetchRecordDetail(id)
      fetchLogs(id)
      fetchNote(id)
    }
  }

  const handleRerun = async () => {
    if (!id) return
    setRerunning(true)
    await rerunCalibration(id, 'system')
    setRerunning(false)
    reloadDetail()
  }

  if (loading && !currentRecord) {
    return <div className="flex items-center justify-center min-h-screen text-text-secondary">加载中...</div>
  }

  if (!currentRecord) {
    return <div className="flex items-center justify-center min-h-screen text-text-secondary">记录不存在</div>
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="container max-w-5xl py-6 px-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="text-text-secondary hover:text-text-primary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Radio className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-semibold data-font text-text-primary">{currentRecord.beaconId}</h1>
          <StatusBadge status={currentRecord.status} />
          <div className="flex-1" />
          <button
            onClick={handleRerun}
            disabled={rerunning}
            className="flex items-center gap-2 rounded bg-status-red/15 border border-status-red/30 px-3 py-1.5 text-xs text-status-red hover:bg-status-red/25 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {rerunning ? '重跑中...' : '重跑校准'}
          </button>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-bg-card p-5">
            <h3 className="text-sm font-medium text-text-primary mb-3">坐标数据</h3>
            {currentRecord.coordinates.length > 0 ? (
              <CoordinateTable coordinates={currentRecord.coordinates} />
            ) : (
              <p className="text-sm text-text-secondary">暂无坐标数据</p>
            )}
          </section>

          <PhotoSection onUpdated={reloadDetail} />

          {fieldTeamNote && (
            <section>
              <h3 className="text-sm font-medium text-text-primary mb-3">现场班组说明</h3>
              <FieldNoteCard note={fieldTeamNote} />
            </section>
          )}

          <section className="rounded-lg border border-border bg-bg-card p-5">
            <h3 className="text-sm font-medium text-text-primary mb-3">操作历史</h3>
            <OperationTimeline logs={operationLogs} />
          </section>

          {id && <RerunSection recordId={id} />}
        </div>
      </div>
    </div>
  )
}

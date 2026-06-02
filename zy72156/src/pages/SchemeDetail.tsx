import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  FileBarChart,
  RefreshCw,
  Copy,
  Plus,
} from 'lucide-react'
import { api } from '../services/api'
import type { Scheme, ManualNote } from '../types'
import { ManualNotes } from '../components/ManualNotes'

export default function SchemeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [scheme, setScheme] = useState<
    Scheme & {
      location: { id: string; canonical_name: string }
      prev_version: Scheme | null
      next_version: Scheme | null
      notes: ManualNote[]
    } | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [showSupersedeForm, setShowSupersedeForm] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [historicalOpinion, setHistoricalOpinion] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    if (id) loadScheme(id)
  }, [id])

  const loadScheme = async (schemeId: string) => {
    setLoading(true)
    try {
      const data = await api.getScheme(schemeId)
      setScheme(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSupersede = async () => {
    if (!newContent.trim() || !scheme) return
    try {
      const newScheme = await api.supersedeScheme(scheme.id, {
        new_content: newContent,
        historical_opinion: historicalOpinion,
      })
      navigate(`/schemes/${newScheme.id}`)
    } catch (e) {
      console.error(e)
    }
  }

  const handleGenerateReport = async () => {
    if (!scheme) return
    setGeneratingReport(true)
    try {
      const report = await api.createReport({
        location_id: scheme.location.id,
        scheme_id: scheme.id,
      })
      navigate(`/reports/${report.id}`)
    } catch (e) {
      console.error(e)
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleNoteAdded = (note: ManualNote) => {
    if (scheme) {
      setScheme({
        ...scheme,
        notes: [note, ...scheme.notes],
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
      </div>
    )
  }

  if (!scheme) {
    return <div className="p-6">方案不存在</div>
  }

  return (
    <div className="p-6 h-screen overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/schemes" className="text-primary-500 hover:text-primary-700">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-primary-800 font-serif">{scheme.title}</h2>
            <div className="flex items-center gap-4 mt-1">
              <Link
                to={`/locations/${scheme.location.id}`}
                className="text-sm text-accent-600 hover:text-accent-700"
              >
                {scheme.location.canonical_name}
              </Link>
              <span className="text-sm text-primary-500">
                v{scheme.version} · {scheme.created_at.slice(0, 16)} · {scheme.created_by}
              </span>
              <span
                className={
                  scheme.status === '已发布'
                    ? 'badge-published'
                    : scheme.status === '被覆盖'
                    ? 'badge-superseded'
                    : 'badge-draft'
                }
              >
                {scheme.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {scheme.status === '已发布' && (
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="btn-secondary flex items-center gap-2"
            >
              <FileBarChart size={16} />
              {generatingReport ? '生成中...' : '生成报告'}
            </button>
          )}
          {scheme.status !== '被覆盖' && (
            <button
              onClick={() => setShowSupersedeForm(!showSupersedeForm)}
              className="btn-accent flex items-center gap-2"
            >
              <RefreshCw size={16} />
              迭代新版本
            </button>
          )}
        </div>
      </div>

      {(scheme.prev_version || scheme.next_version) && (
        <div className="card p-4 mb-6 bg-primary-50">
          <div className="flex items-center justify-between">
            {scheme.prev_version ? (
              <Link
                to={`/schemes/${scheme.prev_version.id}`}
                className="flex items-center gap-2 text-primary-600 hover:text-primary-800"
              >
                <ArrowLeft size={16} />
                <span>
                  上一版本：v{scheme.prev_version.version}
                  {scheme.prev_version.status === '被覆盖' && ' (已覆盖)'}
                </span>
              </Link>
            ) : (
              <div />
            )}
            {scheme.next_version ? (
              <Link
                to={`/schemes/${scheme.next_version.id}`}
                className="flex items-center gap-2 text-primary-600 hover:text-primary-800"
              >
                <span>下一版本：v{scheme.next_version.version}</span>
                <ArrowRight size={16} />
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {showSupersedeForm && (
        <div className="card p-6 mb-6 border-accent-300">
          <h3 className="font-semibold text-primary-800 mb-4 flex items-center gap-2">
            <Plus size={18} className="text-accent-500" />
            创建新版本 v{scheme.version + 1}
          </h3>
          <div className="mb-4">
            <label className="label">新版本方案内容</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="input min-h-[120px]"
              placeholder="请输入新版本的方案内容..."
            />
          </div>
          <div className="mb-4">
            <label className="label">历史意见（将记录在旧方案上）</label>
            <textarea
              value={historicalOpinion}
              onChange={(e) => setHistoricalOpinion(e.target.value)}
              className="input min-h-[80px]"
              placeholder="简述为什么需要迭代，旧方案存在什么问题..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowSupersedeForm(false)} className="btn-secondary">
              取消
            </button>
            <button onClick={handleSupersede} className="btn-accent">
              创建新版本
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-primary-800 mb-4">方案内容</h3>
            <div className="prose prose-sm max-w-none">
              <p className="text-primary-700 whitespace-pre-wrap leading-relaxed">
                {scheme.content}
              </p>
            </div>
          </div>

          {scheme.source_refs.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-primary-800 mb-3 flex items-center gap-2">
                <Copy size={16} className="text-primary-500" />
                来源参考 ({scheme.source_refs.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {scheme.source_refs.map((ref) => (
                  <Link
                    key={ref}
                    to={`/feedback/${ref}`}
                    className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm hover:bg-primary-200 transition-colors"
                  >
                    {ref}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {scheme.historical_opinion && (
            <div className="card p-4 border-yellow-300 bg-yellow-50">
              <h3 className="font-semibold text-yellow-800 mb-2">历史意见</h3>
              <p className="text-sm text-yellow-700 italic">{scheme.historical_opinion}</p>
            </div>
          )}
        </div>

        <div>
          <ManualNotes
            targetType="scheme"
            targetId={scheme.id}
            notes={scheme.notes}
            onNoteAdded={handleNoteAdded}
          />
        </div>
      </div>
    </div>
  )
}

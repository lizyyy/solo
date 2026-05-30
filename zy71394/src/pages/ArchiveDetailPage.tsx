import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Edit, GitCompare, Copy, Check, User, Clock } from 'lucide-react'
import { api } from '@/services/api'
import type { PromptDetail, PromptVersion } from '../../shared/types'
import {
  getRatingColor,
  getStatusBadge,
  formatDate,
  formatDateTime,
} from '@/components/StatusBadges'
import ArchiveFormPage from './ArchiveFormPage'

export default function ArchiveDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [prompt, setPrompt] = useState<PromptDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const isEditMode = searchParams.get('edit') === '1'

  useEffect(() => {
    if (!isEditMode) {
      loadPrompt()
    }
  }, [id, isEditMode]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPrompt() {
    setLoading(true)
    try {
      const data = await api.prompts.get(id!)
      setPrompt(data)
    } finally {
      setLoading(false)
    }
  }

  if (isEditMode) {
    return <ArchiveFormPage />
  }

  async function copyContent() {
    if (!prompt) return
    await navigator.clipboard.writeText(prompt.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function confirmVersion(version: number) {
    if (!prompt) return
    await api.prompts.confirmVersion(prompt.id, version, '当前用户')
    loadPrompt()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-amber border-t-transparent" />
      </div>
    )
  }

  if (!prompt) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p>提示词不存在</p>
        <button onClick={() => navigate('/archive')} className="btn-secondary mt-4">
          返回列表
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/archive')}
          className="p-2 text-gray-400 hover:text-gray-200 hover:bg-bg-hover rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-gray-100 truncate">{prompt.title}</h2>
          <p className="text-sm text-gray-400 mt-1">
            v{prompt.currentVersion} · 创建于 {formatDate(prompt.createdAt)} · 更新于 {formatDate(prompt.updatedAt)}
          </p>
        </div>
        {getStatusBadge(prompt.status)}
        <span className={`badge border ${getRatingColor(prompt.rating)}`}>
          {prompt.rating.toFixed(1)} 分
        </span>
        <button
          onClick={() => navigate(`/compare?promptId=${prompt.id}`)}
          className="btn-secondary"
        >
          <GitCompare className="w-4 h-4" />
          版本对比
        </button>
        <button
          onClick={() => navigate(`/archive/${prompt.id}?edit=1`)}
          className="btn-primary"
        >
          <Edit className="w-4 h-4" />
          编辑
        </button>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0 space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-200">提示词内容</h3>
              <button onClick={copyContent} className="btn-secondary px-3 py-1.5">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <pre className="font-mono text-sm text-gray-300 bg-bg-lighter p-4 rounded-lg overflow-auto max-h-[500px] whitespace-pre-wrap">
              {prompt.content}
            </pre>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-200 mb-4">版本历史</h3>
            <div className="space-y-3">
              {prompt.versions.map((version, index) => (
                <VersionHistoryItem
                  key={version.id}
                  version={version}
                  isLatest={version.version === prompt.currentVersion}
                  index={index}
                  onConfirm={() => confirmVersion(version.version)}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className="w-80 flex-shrink-0 space-y-6">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-200 mb-4">技术栈</h3>
            <div className="flex flex-wrap gap-2">
              {prompt.techStacks.length === 0 ? (
                <span className="text-gray-500 text-sm">未设置</span>
              ) : (
                prompt.techStacks.map(ts => (
                  <span
                    key={ts}
                    className="chip bg-status-info/10 text-status-info border-status-info/20 border"
                  >
                    {ts}
                  </span>
                ))
              )}
            </div>
          </div>

          {prompt.failureReasons.length > 0 && (
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-gray-200 mb-4">常见失败原因</h3>
              <div className="flex flex-wrap gap-2">
                {prompt.failureReasons.map(reason => (
                  <span
                    key={reason}
                    className="chip bg-status-danger/10 text-status-danger border-status-danger/20 border"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          )}

          {prompt.tags.length > 0 && (
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-gray-200 mb-4">标签</h3>
              <div className="flex flex-wrap gap-2">
                {prompt.tags.map(tag => (
                  <span
                    key={tag}
                    className="chip bg-bg-lighter text-gray-300 border-bg-border border"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function VersionHistoryItem({
  version,
  isLatest,
  index,
  onConfirm,
}: {
  version: PromptVersion
  isLatest: boolean
  index: number
  onConfirm: () => void
}) {
  return (
    <div
      className="p-4 border border-bg-border rounded-lg bg-bg-lighter/30 hover:bg-bg-lighter/50 transition-colors"
      style={{ animation: `fade-in 0.2s ease-out ${index * 0.03}s both` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`chip border ${
              isLatest
                ? 'bg-brand-amber/20 text-brand-amber border-brand-amber/30'
                : 'bg-bg-lighter text-gray-400 border-bg-border'
            }`}>
              v{version.version}
              {isLatest && ' (当前)'}
            </span>
            <span className={`badge border ${getRatingColor(version.rating)}`}>
              {version.rating.toFixed(1)}
            </span>
            {version.confirmedAt ? (
              <span className="chip bg-status-success/10 text-status-success border-status-success/20 border">
                <Check className="w-3 h-3 mr-1" />
                已确认
              </span>
            ) : (
              <span className="chip bg-status-warning/10 text-status-warning border-status-warning/20 border">
                <Clock className="w-3 h-3 mr-1" />
                待确认
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 mb-2">{version.changeReason}</p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {version.confirmedBy && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {version.confirmedBy}
              </span>
            )}
            {version.confirmedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(version.confirmedAt)}
              </span>
            )}
          </div>
        </div>
        {!version.confirmedAt && isLatest && (
          <button
            onClick={onConfirm}
            className="btn-success px-3 py-1.5 text-sm"
          >
            <Check className="w-4 h-4" />
            确认
          </button>
        )}
      </div>
    </div>
  )
}

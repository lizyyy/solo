import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, User, Clock } from 'lucide-react'
import { diffLines, type Change } from 'diff'
import { api } from '@/services/api'
import type { Prompt, PromptVersion } from '../../shared/types'
import { formatDateTime, getRatingColor } from '@/components/StatusBadges'
import { cn } from '@/lib/utils'

export default function ComparePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const promptIdParam = searchParams.get('promptId')

  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(promptIdParam)
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [v1, setV1] = useState<number | null>(null)
  const [v2, setV2] = useState<number | null>(null)
  const [promptDropdownOpen, setPromptDropdownOpen] = useState(false)
  const [v1DropdownOpen, setV1DropdownOpen] = useState(false)
  const [v2DropdownOpen, setV2DropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [diff, setDiff] = useState<Change[]>([])

  useEffect(() => {
    loadPrompts()
  }, [])

  useEffect(() => {
    if (selectedPromptId) {
      loadVersions()
    }
  }, [selectedPromptId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (v1 !== null && v2 !== null) {
      computeDiff()
    }
  }, [v1, v2, versions]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPrompts() {
    const result = await api.prompts.list({ pageSize: 100 })
    setPrompts(result.items)
  }

  async function loadVersions() {
    if (!selectedPromptId) return
    setLoading(true)
    try {
      const data = await api.prompts.versions(selectedPromptId)
      setVersions(data.sort((a, b) => b.version - a.version))
      if (data.length >= 2) {
        setV2(data[0].version)
        setV1(data[1].version)
      } else if (data.length === 1) {
        setV1(data[0].version)
        setV2(null)
      }
    } finally {
      setLoading(false)
    }
  }

  function computeDiff() {
    const version1 = versions.find(v => v.version === v1)
    const version2 = versions.find(v => v.version === v2)
    if (!version1 || !version2) return

    const changes = diffLines(version1.content, version2.content)
    setDiff(changes)
  }

  function handlePromptSelect(promptId: string) {
    setSelectedPromptId(promptId)
    setV1(null)
    setV2(null)
    setDiff([])
    setPromptDropdownOpen(false)
  }

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId)
  const version1 = versions.find(v => v.version === v1)
  const version2 = versions.find(v => v.version === v2)

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-gray-200 hover:bg-bg-hover rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-100">版本对比</h2>
          <p className="text-sm text-gray-400 mt-1">对比两个版本的提示词内容差异</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="relative">
            <label className="label">选择提示词</label>
            <button
              onClick={() => setPromptDropdownOpen(!promptDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-bg-lighter border border-bg-border rounded-md text-left transition-colors hover:border-gray-500"
            >
              <span className={selectedPrompt ? 'text-gray-200 truncate' : 'text-gray-500'}>
                {selectedPrompt?.title || '请选择提示词'}
              </span>
              <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-2', promptDropdownOpen && 'rotate-180')} />
            </button>
            {promptDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-md shadow-lg z-10 max-h-64 overflow-auto animate-fade-in">
                {prompts.map(prompt => (
                  <button
                    key={prompt.id}
                    onClick={() => handlePromptSelect(prompt.id)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-hover truncate',
                      selectedPromptId === prompt.id && 'bg-brand-amber/10 text-brand-amber'
                    )}
                  >
                    {prompt.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <label className="label">旧版本 (V1)</label>
            <button
              onClick={() => setV1DropdownOpen(!v1DropdownOpen)}
              disabled={!selectedPromptId || versions.length === 0}
              className="w-full flex items-center justify-between px-3 py-2 bg-bg-lighter border border-bg-border rounded-md text-left transition-colors hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={v1 !== null ? 'text-gray-200' : 'text-gray-500'}>
                {v1 !== null ? `v${v1}` : '选择版本'}
              </span>
              <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', v1DropdownOpen && 'rotate-180')} />
            </button>
            {v1DropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-md shadow-lg z-10 max-h-64 overflow-auto animate-fade-in">
                {versions.map(version => (
                  <button
                    key={version.id}
                    onClick={() => { setV1(version.version); setV1DropdownOpen(false) }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-hover',
                      v1 === version.version && 'bg-status-danger/10 text-status-danger'
                    )}
                  >
                    v{version.version} - {version.changeReason}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <label className="label">新版本 (V2)</label>
            <button
              onClick={() => setV2DropdownOpen(!v2DropdownOpen)}
              disabled={!selectedPromptId || versions.length === 0}
              className="w-full flex items-center justify-between px-3 py-2 bg-bg-lighter border border-bg-border rounded-md text-left transition-colors hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={v2 !== null ? 'text-gray-200' : 'text-gray-500'}>
                {v2 !== null ? `v${v2}` : '选择版本'}
              </span>
              <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', v2DropdownOpen && 'rotate-180')} />
            </button>
            {v2DropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-md shadow-lg z-10 max-h-64 overflow-auto animate-fade-in">
                {versions.map(version => (
                  <button
                    key={version.id}
                    onClick={() => { setV2(version.version); setV2DropdownOpen(false) }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-hover',
                      v2 === version.version && 'bg-status-success/10 text-status-success'
                    )}
                  >
                    v{version.version} - {version.changeReason}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {version1 && version2 && (
        <div className="grid grid-cols-2 gap-6">
          <VersionInfoCard version={version1} label="旧版本" variant="old" />
          <VersionInfoCard version={version2} label="新版本" variant="new" />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-amber border-t-transparent" />
        </div>
      ) : diff.length > 0 ? (
        <div className="card overflow-hidden flex-1 min-h-0">
          <div className="overflow-auto h-full">
            <table className="w-full border-collapse">
              <tbody>
                {diff.map((change, index) => (
                  <DiffRow key={index} change={change} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedPromptId && !loading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">请选择两个版本进行对比</p>
        </div>
      ) : null}
    </div>
  )
}

function VersionInfoCard({
  version,
  label,
  variant,
}: {
  version: PromptVersion
  label: string
  variant: 'old' | 'new'
}) {
  return (
    <div className={cn(
      'card p-4',
      variant === 'old' ? 'border-status-danger/30' : 'border-status-success/30'
    )}>
      <div className="flex items-center gap-3 mb-3">
        <span className={cn(
          'chip border px-2 py-1',
          variant === 'old'
            ? 'bg-status-danger/15 text-status-danger border-status-danger/30'
            : 'bg-status-success/15 text-status-success border-status-success/30'
        )}>
          {label} v{version.version}
        </span>
        <span className={`badge border ${getRatingColor(version.rating)}`}>
          {version.rating.toFixed(1)}
        </span>
      </div>
      <p className="text-sm text-gray-300 mb-2">{version.changeReason}</p>
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
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
  )
}

function DiffRow({ change }: { change: Change }) {
  const lines = change.value.split('\n')
  const lastLineEmpty = lines[lines.length - 1] === ''
  const displayLines = lastLineEmpty ? lines.slice(0, -1) : lines

  const rowClass = change.added
    ? 'bg-status-success/10'
    : change.removed
      ? 'bg-status-danger/10'
      : 'hover:bg-bg-lighter/50'

  const lineNumClass = change.added
    ? 'text-status-success/60'
    : change.removed
      ? 'text-status-danger/60'
      : 'text-gray-600'

  const prefix = change.added ? '+' : change.removed ? '-' : ' '
  const prefixClass = change.added
    ? 'text-status-success'
    : change.removed
      ? 'text-status-danger'
      : 'text-gray-600'

  return (
    <>
      {displayLines.map((line, i) => (
        <tr key={i} className={cn(rowClass, 'border-b border-bg-border/50')}>
          <td className={cn('px-2 py-1 text-right text-xs w-12 select-none', lineNumClass)}>
            {change.added || change.removed ? '' : ''}
          </td>
          <td className={cn('px-2 py-1 text-xs w-8 select-none text-right', prefixClass)}>
            {prefix}
          </td>
          <td className="px-2 py-1 font-mono text-sm whitespace-pre text-gray-300">
            {line || '\u00A0'}
          </td>
        </tr>
      ))}
    </>
  )
}

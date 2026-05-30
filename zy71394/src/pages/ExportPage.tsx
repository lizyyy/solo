import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FileJson, FileSpreadsheet, ChevronDown, Calendar } from 'lucide-react'
import { api } from '@/services/api'
import { useStore } from '@/store/app'
import type { Prompt, PromptFilter, TechStackStat } from '../../shared/types'
import { getRatingColor, getStatusBadge, formatDate } from '@/components/StatusBadges'
import { cn } from '@/lib/utils'

export default function ExportPage() {
  const location = useLocation()
  const { filter: storeFilter } = useStore()

  const [techStacks, setTechStacks] = useState<string[]>([])
  const [failureReasons, setFailureReasons] = useState<string[]>([])
  const [selectedTechStacks, setSelectedTechStacks] = useState<string[]>([])
  const [selectedFailureReasons, setSelectedFailureReasons] = useState<string[]>([])
  const [minRating, setMinRating] = useState<number | ''>('')
  const [maxRating, setMaxRating] = useState<number | ''>('')
  const [status, setStatus] = useState<Prompt['status'] | 'all'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [techDropdownOpen, setTechDropdownOpen] = useState(false)
  const [reasonDropdownOpen, setReasonDropdownOpen] = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)

  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [techStackStats, setTechStackStats] = useState<TechStackStat[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    loadMetaData()
    if (location.pathname === '/export' && storeFilter.techStacks) {
      setSelectedTechStacks(storeFilter.techStacks || [])
      setMinRating(storeFilter.minRating ?? '')
      setMaxRating(storeFilter.maxRating ?? '')
      setSelectedFailureReasons(storeFilter.failureReasons || [])
      if (storeFilter.status) setStatus(storeFilter.status)
    }
  }, [])

  useEffect(() => {
    loadPreview()
  }, [selectedTechStacks, selectedFailureReasons, minRating, maxRating, status, startDate, endDate]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMetaData() {
    const [st, fr] = await Promise.all([
      api.tags.techStacks(),
      api.tags.failureReasons(),
    ])
    setTechStacks(st)
    setFailureReasons(fr)
  }

  async function loadPreview() {
    setLoading(true)
    try {
      const filter: PromptFilter = {
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }
      if (selectedTechStacks.length > 0) filter.techStacks = selectedTechStacks
      if (selectedFailureReasons.length > 0) filter.failureReasons = selectedFailureReasons
      if (minRating !== '') filter.minRating = Number(minRating)
      if (maxRating !== '') filter.maxRating = Number(maxRating)
      if (status !== 'all') filter.status = status

      const [result, stats] = await Promise.all([
        api.prompts.list(filter),
        api.stats.techStack(),
      ])
      setPrompts(result.items)
      setTotal(result.total)
      setTechStackStats(stats)
    } finally {
      setLoading(false)
    }
  }

  async function getAllPrompts(): Promise<Prompt[]> {
    const filter: PromptFilter = {
      page: 1,
      pageSize: 1000,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }
    if (selectedTechStacks.length > 0) filter.techStacks = selectedTechStacks
    if (selectedFailureReasons.length > 0) filter.failureReasons = selectedFailureReasons
    if (minRating !== '') filter.minRating = Number(minRating)
    if (maxRating !== '') filter.maxRating = Number(maxRating)
    if (status !== 'all') filter.status = status

    const result = await api.prompts.list(filter)
    return result.items
  }

  function exportCSV() {
    getAllPrompts().then(data => {
      const headers = ['ID', '标题', '内容', '技术栈', '评分', '失败原因', '标签', '状态', '当前版本', '创建时间', '更新时间']
      const rows = data.map(p => [
        p.id,
        p.title,
        `"${p.content.replace(/"/g, '""')}"`,
        p.techStacks.join('; '),
        p.rating,
        p.failureReasons.join('; '),
        p.tags.join('; '),
        p.status,
        p.currentVersion,
        p.createdAt,
        p.updatedAt,
      ])

      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `prompts_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    })
  }

  function exportJSON() {
    getAllPrompts().then(data => {
      const jsonContent = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `prompts_${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    })
  }

  const avgRating = prompts.length > 0
    ? (prompts.reduce((sum, p) => sum + p.rating, 0) / prompts.length).toFixed(1)
    : '0.0'

  const topTechStacks = techStackStats
    .filter(ts => selectedTechStacks.length === 0 || selectedTechStacks.includes(ts.name))
    .slice(0, 3)

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">报告导出</h2>
          <p className="text-sm text-gray-400 mt-1">按条件筛选并导出提示词数据</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="btn-secondary">
            <FileSpreadsheet className="w-4 h-4" />
            导出 CSV
          </button>
          <button onClick={exportJSON} className="btn-primary">
            <FileJson className="w-4 h-4" />
            导出 JSON
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-72 flex-shrink-0 space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-200 mb-4">筛选条件</h3>

            <div className="space-y-4">
              <FilterDropdown
                label="技术栈"
                selected={selectedTechStacks}
                options={techStacks}
                isOpen={techDropdownOpen}
                onToggle={() => setTechDropdownOpen(!techDropdownOpen)}
                onToggleItem={(item) => setSelectedTechStacks(prev =>
                  prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
                )}
                onClear={() => setSelectedTechStacks([])}
              />

              <FilterDropdown
                label="失败原因"
                selected={selectedFailureReasons}
                options={failureReasons}
                isOpen={reasonDropdownOpen}
                onToggle={() => setReasonDropdownOpen(!reasonDropdownOpen)}
                onToggleItem={(item) => setSelectedFailureReasons(prev =>
                  prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
                )}
                onClear={() => setSelectedFailureReasons([])}
              />

              <div>
                <label className="label">评分区间</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    placeholder="最低"
                    value={minRating}
                    onChange={e => setMinRating(e.target.value ? Number(e.target.value) : '')}
                    className="input w-24"
                  />
                  <span className="text-gray-500">—</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    placeholder="最高"
                    value={maxRating}
                    onChange={e => setMaxRating(e.target.value ? Number(e.target.value) : '')}
                    className="input w-24"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="label">状态</label>
                <button
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-bg-lighter border border-bg-border rounded-md text-left transition-colors hover:border-gray-500"
                >
                  <span className={status !== 'all' ? 'text-gray-200' : 'text-gray-500'}>
                    {status === 'all' ? '全部状态' : status === 'active' ? '在用' : status === 'deprecated' ? '弃用' : '归档'}
                  </span>
                  <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', statusDropdownOpen && 'rotate-180')} />
                </button>
                {statusDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-md shadow-lg z-10 overflow-auto animate-fade-in">
                    {['all', 'active', 'deprecated', 'archived'].map(s => (
                      <button
                        key={s}
                        onClick={() => { setStatus(s as Prompt['status'] | 'all'); setStatusDropdownOpen(false) }}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-hover',
                          status === s && 'bg-brand-amber/10 text-brand-amber'
                        )}
                      >
                        {s === 'all' ? '全部状态' : s === 'active' ? '在用' : s === 'deprecated' ? '弃用' : '归档'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  时间范围
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="input"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-200 mb-4">筛选统计</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">总条数</span>
                <span className="text-gray-100 font-semibold">{total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">平均分</span>
                <span className={`badge border ${getRatingColor(Number(avgRating))}`}>
                  {avgRating}
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-sm block mb-2">技术栈 Top3</span>
                <div className="space-y-1">
                  {topTechStacks.map((ts, i) => (
                    <div key={ts.name} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">
                        <span className="text-gray-500 mr-2">{i + 1}.</span>
                        {ts.name}
                      </span>
                      <span className="text-gray-500">{ts.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">数据预览 (前10条)</h3>
              <span className="text-sm text-gray-500">共 {total} 条</span>
            </div>
            <div className="overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-amber border-t-transparent" />
                </div>
              ) : prompts.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  暂无匹配数据
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-bg-border bg-bg-lighter">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">标题</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">技术栈</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">评分</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">状态</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">更新时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bg-border">
                    {prompts.map((prompt, index) => (
                      <tr
                        key={prompt.id}
                        className="hover:bg-bg-lighter/50 transition-colors"
                        style={{ animation: `fade-in 0.2s ease-out ${index * 0.03}s both` }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-100 max-w-xs truncate">{prompt.title}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {prompt.techStacks.slice(0, 2).map(ts => (
                              <span key={ts} className="chip bg-status-info/10 text-status-info border-status-info/20 border">
                                {ts}
                              </span>
                            ))}
                            {prompt.techStacks.length > 2 && (
                              <span className="chip bg-bg-lighter text-gray-400 border-bg-border">
                                +{prompt.techStacks.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge border ${getRatingColor(prompt.rating)}`}>
                            {prompt.rating.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(prompt.status)}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {formatDate(prompt.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterDropdown({
  label,
  selected,
  options,
  isOpen,
  onToggle,
  onToggleItem,
  onClear,
}: {
  label: string
  selected: string[]
  options: string[]
  isOpen: boolean
  onToggle: () => void
  onToggleItem: (item: string) => void
  onClear: () => void
}) {
  return (
    <div className="relative">
      <label className="label">{label}</label>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-bg-lighter border border-bg-border rounded-md text-left transition-colors hover:border-gray-500"
      >
        <span className={selected.length > 0 ? 'text-gray-200 text-sm' : 'text-gray-500 text-sm'}>
          {selected.length > 0 ? `已选 ${selected.length} 项` : '请选择'}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-md shadow-lg z-10 max-h-48 overflow-auto animate-fade-in">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => onToggleItem(opt)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-hover flex items-center gap-2',
                selected.includes(opt) && 'bg-brand-amber/10 text-brand-amber'
              )}
            >
              <span className={cn('w-4 h-4 border rounded flex items-center justify-center',
                selected.includes(opt)
                  ? 'border-brand-amber bg-brand-amber text-black'
                  : 'border-bg-border'
              )}>
                {selected.includes(opt) && '✓'}
              </span>
              {opt}
            </button>
          ))}
          {selected.length > 0 && (
            <button
              onClick={onClear}
              className="w-full px-3 py-2 text-left text-sm text-status-danger hover:bg-status-danger/10 transition-colors border-t border-bg-border"
            >
              清除选择
            </button>
          )}
        </div>
      )}
    </div>
  )
}

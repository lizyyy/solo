import { useEffect, useState } from 'react'
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Edit, Trash2, Eye, GitCompare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import { useStore } from '@/store/app'
import type { Prompt } from '../../shared/types'
import {
  getRatingColor,
  getStatusBadge,
  formatDate,
} from '@/components/StatusBadges'
import DuplicateCheckModal from '@/components/DuplicateCheckModal'

export default function ArchiveListPage() {
  const navigate = useNavigate()
  const { filter, setFilter, resetFilter, searchQuery, duplicateCheckResult, hideDuplicateCheck } = useStore()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [techStacks, setTechStacks] = useState<string[]>([])
  const [failureReasons, setFailureReasons] = useState<string[]>([])

  useEffect(() => {
    loadMetaData()
  }, [])

  useEffect(() => {
    loadPrompts()
  }, [filter, searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMetaData() {
    const [st, fr] = await Promise.all([
      api.tags.techStacks(),
      api.tags.failureReasons(),
    ])
    setTechStacks(st)
    setFailureReasons(fr)
  }

  async function loadPrompts() {
    setLoading(true)
    try {
      const result = await api.prompts.list({
        ...filter,
        search: searchQuery || undefined,
      })
      setPrompts(result.items)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } finally {
      setLoading(false)
    }
  }

  function handleSort(column: 'createdAt' | 'updatedAt' | 'rating') {
    const newOrder = filter.sortBy === column && filter.sortOrder === 'desc' ? 'asc' : 'desc'
    setFilter({ sortBy: column, sortOrder: newOrder, page: 1 })
  }

  function handleTechStackToggle(tech: string) {
    const current = filter.techStacks || []
    const next = current.includes(tech) ? current.filter(t => t !== tech) : [...current, tech]
    setFilter({ techStacks: next, page: 1 })
  }

  function handleReasonToggle(reason: string) {
    const current = filter.failureReasons || []
    const next = current.includes(reason) ? current.filter(r => r !== reason) : [...current, reason]
    setFilter({ failureReasons: next, page: 1 })
  }

  function handleRatingChange(min: number | undefined, max: number | undefined) {
    setFilter({ minRating: min, maxRating: max, page: 1 })
  }

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">提示词列表</h2>
          <p className="text-sm text-gray-400 mt-1">共 {total} 条提示词，结构化归档便于管理和复用</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/export')} className="btn-secondary">
            <Search className="w-4 h-4" />
            导出当前筛选
          </button>
          <button onClick={resetFilter} className="btn-secondary">
            重置筛选
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-64 flex-shrink-0 space-y-6">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">技术栈</h3>
            <div className="flex flex-wrap gap-2">
              {techStacks.map(tech => (
                <button
                  key={tech}
                  onClick={() => handleTechStackToggle(tech)}
                  className={`chip border ${
                    filter.techStacks?.includes(tech)
                      ? 'bg-brand-amber/20 text-brand-amber border-brand-amber/30'
                      : 'bg-bg-lighter text-gray-400 border-bg-border hover:border-gray-500'
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">评分区间</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={10}
                  placeholder="最低"
                  value={filter.minRating ?? ''}
                  onChange={e => handleRatingChange(e.target.value ? Number(e.target.value) : undefined, filter.maxRating)}
                  className="input w-20"
                />
                <span className="text-gray-500">—</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  placeholder="最高"
                  value={filter.maxRating ?? ''}
                  onChange={e => handleRatingChange(filter.minRating, e.target.value ? Number(e.target.value) : undefined)}
                  className="input w-20"
                />
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">失败原因</h3>
            <div className="flex flex-wrap gap-2">
              {failureReasons.map(reason => (
                <button
                  key={reason}
                  onClick={() => handleReasonToggle(reason)}
                  className={`chip border ${
                    filter.failureReasons?.includes(reason)
                      ? 'bg-status-danger/20 text-status-danger border-status-danger/30'
                      : 'bg-bg-lighter text-gray-400 border-bg-border hover:border-gray-500'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-bg-border bg-bg-lighter">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      标题
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      技术栈
                    </th>
                    <th
                      className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200"
                      onClick={() => handleSort('rating')}
                    >
                      <span className="flex items-center gap-1">
                        评分
                        <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      状态
                    </th>
                    <th
                      className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200"
                      onClick={() => handleSort('updatedAt')}
                    >
                      <span className="flex items-center gap-1">
                        更新时间
                        <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-border">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        加载中...
                      </td>
                    </tr>
                  ) : prompts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        暂无匹配的提示词
                      </td>
                    </tr>
                  ) : (
                    prompts.map((prompt, index) => (
                      <tr
                        key={prompt.id}
                        className="hover:bg-bg-lighter/50 transition-colors"
                        style={{ animation: `fade-in 0.3s ease-out ${index * 0.03}s both` }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-100 max-w-xs truncate">{prompt.title}</div>
                          {prompt.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {prompt.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="chip bg-bg-lighter text-gray-400 border-bg-border">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {prompt.techStacks.slice(0, 3).map(ts => (
                              <span key={ts} className="chip bg-status-info/10 text-status-info border-status-info/20 border">
                                {ts}
                              </span>
                            ))}
                            {prompt.techStacks.length > 3 && (
                              <span className="chip bg-bg-lighter text-gray-400 border-bg-border">
                                +{prompt.techStacks.length - 3}
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
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate(`/archive/${prompt.id}`)}
                              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-bg-hover rounded transition-colors"
                              title="查看详情"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/archive/${prompt.id}?edit=1`)}
                              className="p-1.5 text-gray-400 hover:text-brand-amber hover:bg-bg-hover rounded transition-colors"
                              title="编辑"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/compare?promptId=${prompt.id}`)}
                              className="p-1.5 text-gray-400 hover:text-status-info hover:bg-bg-hover rounded transition-colors"
                              title="版本对比"
                            >
                              <GitCompare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('确定要删除这条提示词吗？')) {
                                  await api.prompts.delete(prompt.id)
                                  loadPrompts()
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-status-danger hover:bg-bg-hover rounded transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-bg-border">
                <div className="text-sm text-gray-400">
                  第 {filter.page} 页，共 {total} 条
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setFilter({ page: Math.max(1, filter.page! - 1) })}
                    disabled={filter.page === 1}
                    className="p-2 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-300">
                    {filter.page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setFilter({ page: Math.min(totalPages, filter.page! + 1) })}
                    disabled={filter.page === totalPages}
                    className="p-2 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {duplicateCheckResult && (
        <DuplicateCheckModal
          title={duplicateCheckResult.title}
          content={duplicateCheckResult.content}
          onClose={hideDuplicateCheck}
        />
      )}
    </div>
  )
}

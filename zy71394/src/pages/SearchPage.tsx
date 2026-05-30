import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, GitCompare, ChevronDown } from 'lucide-react'
import { api } from '@/services/api'
import type { SearchResult, SearchRequest } from '../../shared/types'
import { similarityLabel, similarityColor, highlightText } from '@/components/StatusBadges'
import { cn } from '@/lib/utils'

export default function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedTechStacks, setSelectedTechStacks] = useState<string[]>([])
  const [availableTechStacks, setAvailableTechStacks] = useState<string[]>([])
  const [techDropdownOpen, setTechDropdownOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    loadTechStacks()
  }, [])

  async function loadTechStacks() {
    const stacks = await api.tags.techStacks()
    setAvailableTechStacks(stacks)
  }

  async function handleSearch() {
    if (!query.trim()) return

    setLoading(true)
    setHasSearched(true)
    try {
      const request: SearchRequest = {
        query: query.trim(),
        techStacks: selectedTechStacks.length > 0 ? selectedTechStacks : undefined,
        limit: 20,
      }
      const report = await api.search.similar(request)
      setResults(report.results)
    } finally {
      setLoading(false)
    }
  }

  function toggleTechStack(tech: string) {
    setSelectedTechStacks(prev =>
      prev.includes(tech)
        ? prev.filter(t => t !== tech)
        : [...prev, tech]
    )
  }

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">相似检索</h2>
        <p className="text-sm text-gray-400 mt-1">输入提示词内容，快速查找相似的历史提示词</p>
      </div>

      <div className="card p-6">
        <label className="label">输入提示词</label>
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleSearch()}
          placeholder="粘贴或输入你要使用的提示词内容，系统将自动匹配相似条目..."
          rows={6}
          className="input font-mono text-sm resize-y mb-4"
        />

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <button
              onClick={() => setTechDropdownOpen(!techDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-bg-lighter border border-bg-border rounded-md text-left transition-colors hover:border-gray-500"
            >
              <span className={selectedTechStacks.length > 0 ? 'text-gray-200' : 'text-gray-500'}>
                {selectedTechStacks.length > 0
                  ? `已选 ${selectedTechStacks.length} 个技术栈`
                  : '筛选技术栈（可选）'}
              </span>
              <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', techDropdownOpen && 'rotate-180')} />
            </button>

            {techDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-md shadow-lg z-10 max-h-64 overflow-auto animate-fade-in">
                {availableTechStacks.map(tech => (
                  <button
                    key={tech}
                    onClick={() => toggleTechStack(tech)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-hover flex items-center gap-2',
                      selectedTechStacks.includes(tech) && 'bg-brand-amber/10 text-brand-amber'
                    )}
                  >
                    <span className={cn('w-4 h-4 border rounded flex items-center justify-center',
                      selectedTechStacks.includes(tech)
                        ? 'border-brand-amber bg-brand-amber text-black'
                        : 'border-bg-border'
                    )}>
                      {selectedTechStacks.includes(tech) && '✓'}
                    </span>
                    {tech}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedTechStacks.length > 0 && (
            <button
              onClick={() => setSelectedTechStacks([])}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              清除筛选
            </button>
          )}

          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="btn-primary px-6 py-2.5 flex-shrink-0"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            搜索
          </button>
        </div>

        {selectedTechStacks.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {selectedTechStacks.map(tech => (
              <span
                key={tech}
                className="chip bg-status-info/10 text-status-info border-status-info/20 border"
              >
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

      {hasSearched && (
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-amber border-t-transparent" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">未找到匹配的提示词</p>
              <p className="text-sm text-gray-500 mt-1">尝试调整关键词或技术栈筛选条件</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">找到 {results.length} 条相似结果</p>
              {results.map((result, index) => (
                <SearchResultCard
                  key={result.promptId}
                  result={result}
                  query={query}
                  index={index}
                  onView={() => navigate(`/archive/${result.promptId}`)}
                  onCompare={() => navigate(`/compare?promptId=${result.promptId}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SearchResultCard({
  result,
  query,
  index,
  onView,
  onCompare,
}: {
  result: SearchResult
  query: string
  index: number
  onView: () => void
  onCompare: () => void
}) {
  return (
    <div
      className="card p-5 hover:border-brand-amber/30 transition-colors"
      style={{ animation: `fade-in 0.2s ease-out ${index * 0.03}s both` }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-gray-100 truncate">{result.promptTitle}</h3>
            <span className={`badge border ${similarityColor(result.similarity)}`}>
              {similarityLabel(result.similarity)} 相似
            </span>
          </div>
          <p
            className="text-sm text-gray-400 line-clamp-3 font-mono bg-bg-lighter p-3 rounded-md"
            dangerouslySetInnerHTML={{ __html: highlightText(result.snippet, query) }}
          />
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={onView}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            <Eye className="w-4 h-4" />
            详情
          </button>
          <button
            onClick={onCompare}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            <GitCompare className="w-4 h-4" />
            对比
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { Search, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSceneStore } from '@/store/useSceneStore'
import type { MeetingMinutes } from './OriginalQuoteDrawer'

export type CollisionConfidence = 'high' | 'medium' | 'low'

export interface CollisionMaterial {
  id: string
  name: string
  color?: string
}

export interface CollisionItem {
  id: string
  confidence: CollisionConfidence
  materials: CollisionMaterial[]
  duplicateCount: number
  meetingIds: string[]
  hitParagraphIds: string[]
  originalQuoteSnippet: string
}

interface CollisionListProps {
  collisions: CollisionItem[]
  meetings: Record<string, MeetingMinutes>
  totalDeduplicated: number
  totalMergedDuplicates: number
  onViewOriginal: (meetingId: string, paragraphIds: string[]) => void
  selectedCollisionId: string | null
  onSelectCollision: (id: string | null) => void
  className?: string
}

const CONFIDENCE_CONFIG = {
  high: {
    label: '高',
    bgClass: 'bg-red-500',
    textClass: 'text-red-500',
    badgeClass: 'bg-red-100 text-red-700',
    dotClass: 'bg-red-500',
  },
  medium: {
    label: '中',
    bgClass: 'bg-orange-500',
    textClass: 'text-orange-500',
    badgeClass: 'bg-orange-100 text-orange-700',
    dotClass: 'bg-orange-500',
  },
  low: {
    label: '低',
    bgClass: 'bg-yellow-500',
    textClass: 'text-yellow-500',
    badgeClass: 'bg-yellow-100 text-yellow-700',
    dotClass: 'bg-yellow-500',
  },
}

export default function CollisionList({
  collisions,
  meetings,
  totalDeduplicated,
  totalMergedDuplicates,
  onViewOriginal,
  selectedCollisionId,
  onSelectCollision,
  className,
}: CollisionListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const { focusOnMaterial } = useSceneStore()

  const filteredCollisions = useMemo(() => {
    if (!searchQuery.trim()) {
      return collisions
    }
    const query = searchQuery.toLowerCase()
    return collisions.filter((collision) => {
      const materialMatch = collision.materials.some((m) =>
        m.name.toLowerCase().includes(query),
      )
      const quoteMatch = collision.originalQuoteSnippet
        .toLowerCase()
        .includes(query)
      const meetingMatch = collision.meetingIds.some((mid) => {
        const meeting = meetings[mid]
        if (!meeting) return false
        return (
          meeting.title.toLowerCase().includes(query) ||
          meeting.code.toLowerCase().includes(query)
        )
      })
      return materialMatch || quoteMatch || meetingMatch
    })
  }, [collisions, searchQuery, meetings])

  const handleMaterialClick = (material: CollisionMaterial) => {
    focusOnMaterial(material.id, material.name)
  }

  const handleViewOriginal = (collision: CollisionItem) => {
    onSelectCollision(collision.id)
    if (collision.meetingIds.length > 0) {
      onViewOriginal(collision.meetingIds[0], collision.hitParagraphIds)
    }
  }

  const getConfidenceStyle = (confidence: CollisionConfidence) => {
    return CONFIDENCE_CONFIG[confidence]
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm',
        className,
      )}
    >
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">碰撞清单</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              已自动合并重复碰撞，共
              <b className="mx-1 text-emerald-600">{totalDeduplicated}</b>
              条去重，合并
              <b className="mx-1 text-blue-600">{totalMergedDuplicates}</b>
              条重复
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-slate-600">高风险</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <span className="text-slate-600">中风险</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-slate-600">低风险</span>
            </div>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="按材料名 / 原文关键词过滤..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
            <tr>
              <th className="w-[12%] border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                置信度
              </th>
              <th className="w-[38%] border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                涉及材料
              </th>
              <th className="w-[10%] border-b border-slate-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                重复次数
              </th>
              <th className="w-[40%] border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                原文摘要 & 定位
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredCollisions.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-16 text-center text-sm text-slate-400"
                >
                  {searchQuery ? '未找到匹配的碰撞记录' : '暂无碰撞数据'}
                </td>
              </tr>
            ) : (
              filteredCollisions.map((collision) => {
                const conf = getConfidenceStyle(collision.confidence)
                const isSelected = selectedCollisionId === collision.id
                return (
                  <tr
                    key={collision.id}
                    className={cn(
                      'border-b border-slate-100 transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-indigo-50/70'
                        : 'hover:bg-slate-50',
                    )}
                    onClick={() => onSelectCollision(collision.id)}
                  >
                    <td className="px-4 py-4 align-top">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-lg px-3 py-1 text-xs font-bold',
                          conf.badgeClass,
                        )}
                      >
                        <span
                          className={cn(
                            'mr-1.5 h-1.5 w-1.5 rounded-full',
                            conf.dotClass,
                          )}
                        />
                        {conf.label}
                      </span>
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {collision.materials.map((material, idx) => (
                          <span key={material.id} className="flex items-center">
                            {idx > 0 && (
                              <span className="mx-0.5 text-slate-400">,</span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMaterialClick(material)
                              }}
                              className="group inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-700 transition-all hover:bg-indigo-100 hover:text-indigo-700"
                            >
                              {material.color && (
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: material.color }}
                                />
                              )}
                              {material.name}
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-4 align-top text-center">
                      {collision.duplicateCount > 1 ? (
                        <span className="relative inline-flex items-center justify-center">
                          <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white shadow-md">
                            ×{collision.duplicateCount}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <p className="line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          "{collision.originalQuoteSnippet}"
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewOriginal(collision)
                          }}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-slate-100 text-slate-700 hover:bg-indigo-100 hover:text-indigo-700',
                          )}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          查看原文
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 text-sm">
        <div className="text-slate-600">
          显示 <b className="text-slate-800">{filteredCollisions.length}</b> /{' '}
          <b className="text-slate-800">{collisions.length}</b> 条碰撞
        </div>
        <div className="flex items-center gap-3 text-xs">
          {Object.entries(CONFIDENCE_CONFIG).map(([key, config]) => {
            const count = collisions.filter((c) => c.confidence === key).length
            return (
              <span key={key} className="flex items-center gap-1.5">
                <span
                  className={cn('h-2 w-2 rounded-full', config.bgClass)}
                />
                <span className="text-slate-500">
                  {config.label}: <b className={config.textClass}>{count}</b>
                </span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

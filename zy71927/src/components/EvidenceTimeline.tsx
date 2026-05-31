import { format } from 'date-fns'
import { Shield, Lightbulb, GalleryVerticalEnd, FileCheck, Edit3, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EvidenceChainEntry } from '@/types'

interface EvidenceTimelineProps {
  entries: EvidenceChainEntry[]
  onNavigate: (type: 'insurance' | 'lighting' | 'exhibition') => void
}

const typeIcons: Record<string, typeof Shield> = {
  insurance_change: Shield,
  confirmation: FileCheck,
  lighting_update: Lightbulb,
  exhibition_update: GalleryVerticalEnd,
  correction: Edit3,
  status_change: Activity,
}

const typeColors: Record<string, string> = {
  insurance_change: 'bg-blue-500',
  confirmation: 'bg-green-500',
  lighting_update: 'bg-yellow-500',
  exhibition_update: 'bg-purple-500',
  correction: 'bg-orange-500',
  status_change: 'bg-gray-500',
}

export default function EvidenceTimeline({ entries, onNavigate }: EvidenceTimelineProps) {
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const handleClick = (entry: EvidenceChainEntry) => {
    if (entry.type === 'insurance_change') {
      onNavigate('insurance')
    } else if (entry.type === 'lighting_update') {
      onNavigate('lighting')
    } else if (entry.type === 'exhibition_update') {
      onNavigate('exhibition')
    }
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
      <div className="space-y-4">
        {sortedEntries.map((entry) => {
          const Icon = typeIcons[entry.type] || Activity
          const isClickable = ['insurance_change', 'lighting_update', 'exhibition_update'].includes(entry.type)

          return (
            <div
              key={entry.id}
              className={cn(
                'relative pl-10',
                isClickable && 'cursor-pointer hover:bg-gray-50 rounded-lg -mx-2 px-10 py-1'
              )}
              onClick={() => isClickable && handleClick(entry)}
            >
              <div
                className={cn(
                  'absolute left-2 w-5 h-5 rounded-full flex items-center justify-center',
                  typeColors[entry.type] || 'bg-gray-500'
                )}
              >
                <Icon className="w-3 h-3 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                  {isClickable && (
                    <span className="text-xs text-blue-600 ml-2">点击查看</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>操作人: {entry.operator}</span>
                  <span>{format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm')}</span>
                </div>
              </div>
            </div>
          )
        })}
        {sortedEntries.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            暂无证据链记录
          </div>
        )}
      </div>
    </div>
  )
}

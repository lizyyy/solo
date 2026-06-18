import { useState } from 'react'
import { MessageSquare, Send, User, Clock } from 'lucide-react'
import type { Remark } from '@/utils/types'
import { cn } from '@/lib/utils'

interface RemarkTimelineProps {
  remarks: Remark[]
  onAddRemark: (author: string, content: string) => void
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`

  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RemarkTimeline({ remarks, onAddRemark }: RemarkTimelineProps) {
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState('')

  const handleSubmit = () => {
    if (!content.trim()) return
    onAddRemark(author.trim() || '匿名', content.trim())
    setContent('')
  }

  return (
    <div className="bg-ocean-800/30 backdrop-blur-sm rounded-xl border border-ocean-700 overflow-hidden">
      <div className="px-5 py-4 bg-ocean-800/50 border-b border-ocean-700">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-neon" />
          <h3 className="font-semibold text-surface font-display">人工备注</h3>
          <span className="text-xs text-muted ml-2">共 {remarks.length} 条</span>
        </div>
      </div>

      <div className="p-5">
        {remarks.length > 0 ? (
          <div className="space-y-4 mb-6 max-h-80 overflow-y-auto pr-2">
            {remarks.map((remark, idx) => (
              <div key={remark.id} className="relative pl-6">
                {idx < remarks.length - 1 && (
                  <div className="absolute left-2 top-6 bottom-0 w-px bg-ocean-700" />
                )}
                <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-neon/50 bg-ocean-900 flex items-center justify-center">
                  {remark.author === '系统' ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-alert" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-neon" />
                  )}
                </div>

                <div className="bg-ocean-800/50 rounded-lg p-3 border border-ocean-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted" />
                      <span className={cn(
                        'text-sm font-medium',
                        remark.author === '系统' ? 'text-alert' : 'text-surface'
                      )}>
                        {remark.author}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <Clock className="w-3 h-3" />
                      {formatTime(remark.createdAt)}
                    </div>
                  </div>
                  <p className="text-sm text-surface/80 leading-relaxed whitespace-pre-wrap">
                    {remark.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted mb-4">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无备注</p>
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="您的称呼（选填）"
            className="w-full px-3 py-2 rounded-lg bg-ocean-900 border border-ocean-700 text-surface text-sm placeholder:text-muted/50 focus:outline-none focus:border-neon/50 transition-colors"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="输入备注内容，按 Enter 提交"
              className="flex-1 px-3 py-2 rounded-lg bg-ocean-900 border border-ocean-700 text-surface text-sm placeholder:text-muted/50 focus:outline-none focus:border-neon/50 transition-colors"
            />
            <button
              onClick={handleSubmit}
              disabled={!content.trim()}
              className="px-4 py-2 rounded-lg bg-neon text-ocean-950 font-medium hover:bg-neon/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

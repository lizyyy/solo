import { useState } from 'react'
import type { QuoteVersion } from '@/types'
import { Receipt, AlertTriangle, ChevronDown, ChevronUp, GitCompare } from 'lucide-react'

interface QuoteTimelineProps {
  quotes: QuoteVersion[]
}

export default function QuoteTimeline({ quotes }: QuoteTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null)

  const hasOverwrites = quotes.some((q) => q.isOverwritten)

  const channels = [...new Set(quotes.map((q) => q.channel))]

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const handleCompare = (id1: string, id2: string) => {
    setCompareIds(compareIds?.[0] === id1 && compareIds?.[1] === id2 ? null : [id1, id2])
  }

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent-blue/15 flex items-center justify-center">
          <Receipt className="w-3.5 h-3.5 text-accent-blue" />
        </div>
        <h3 className="text-sm font-medium text-surface-200">报价版本</h3>
        {hasOverwrites && (
          <span className="px-2 py-0.5 rounded-full bg-accent-yellow/15 text-accent-yellow text-[10px] font-medium">
            存在覆盖
          </span>
        )}
      </div>

      <div className="space-y-4">
        {channels.map((channel) => {
          const channelQuotes = quotes
            .filter((q) => q.channel === channel)
            .sort((a, b) => a.version - b.version)

          return (
            <div key={channel}>
              <p className="text-[11px] text-surface-400 mb-2 font-medium">{channel}</p>
              <div className="relative ml-3 border-l-2 border-surface-600 pl-4 space-y-2">
                {channelQuotes.map((quote) => {
                  const isExpanded = expandedId === quote.id
                  const isCompared = compareIds?.includes(quote.id)

                  return (
                    <div key={quote.id}>
                      <div
                        className={`rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                          quote.isOverwritten
                            ? 'bg-accent-yellow/5 border-accent-yellow/30 hover:bg-accent-yellow/10'
                            : isCompared
                            ? 'bg-accent-blue/5 border-accent-blue/30'
                            : 'bg-surface-700/40 border-surface-600 hover:bg-surface-700/60'
                        }`}
                        onClick={() => toggleExpand(quote.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                quote.isOverwritten
                                  ? 'bg-accent-yellow'
                                  : 'bg-accent-green'
                              }`}
                            />
                            <span className="text-xs text-surface-200">
                              v{quote.version}
                            </span>
                            {quote.isOverwritten && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-yellow/15 text-accent-yellow">
                                已覆盖
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-surface-100 font-mono font-medium">
                              ¥{quote.premium.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-surface-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-surface-400 mt-1">{quote.timestamp}</p>
                      </div>

                      {isExpanded && (
                        <div className="mt-1.5 ml-2 bg-surface-700/30 rounded-lg px-3 py-2 space-y-1.5">
                          {quote.isOverwritten && quote.overwriteReason && (
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-accent-yellow mt-0.5 flex-shrink-0" />
                              <p className="text-[11px] text-accent-yellow">{quote.overwriteReason}</p>
                            </div>
                          )}
                          {channelQuotes.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const otherQuote = channelQuotes.find(
                                  (q) => q.id !== quote.id
                                )
                                if (otherQuote) handleCompare(quote.id, otherQuote.id)
                              }}
                              className="flex items-center gap-1 text-[11px] text-accent-blue hover:text-accent-blue/80 transition-colors"
                            >
                              <GitCompare className="w-3 h-3" />
                              <span>与v{channelQuotes.find((q) => q.id !== quote.id)?.version}对比</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {compareIds && (
        <div className="mt-4 bg-surface-700/30 border border-surface-600 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <GitCompare className="w-3.5 h-3.5 text-accent-blue" />
            <span className="text-[11px] text-accent-blue font-medium">版本对比</span>
          </div>
          {(() => {
            const q1 = quotes.find((q) => q.id === compareIds[0])
            const q2 = quotes.find((q) => q.id === compareIds[1])
            if (!q1 || !q2) return null
            const diff = q2.premium - q1.premium
            return (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-700/50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-surface-400">v{q1.version} ({q1.channel})</p>
                  <p className="text-sm text-surface-100 font-mono font-medium mt-0.5">
                    ¥{q1.premium.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-surface-700/50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-surface-400">v{q2.version} ({q2.channel})</p>
                  <p className="text-sm text-surface-100 font-mono font-medium mt-0.5">
                    ¥{q2.premium.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="col-span-2 bg-accent-blue/10 border border-accent-blue/20 rounded-lg px-3 py-2 text-center">
                  <span className="text-xs text-surface-400">差额：</span>
                  <span className={`text-sm font-mono font-bold ${diff > 0 ? 'text-accent-red' : diff < 0 ? 'text-accent-green' : 'text-surface-200'}`}>
                    {diff > 0 ? '+' : ''}¥{diff.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

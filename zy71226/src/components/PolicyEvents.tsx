import { useState, useEffect, useCallback } from 'react'
import { POLICY_EVENTS } from '@/types'
import { useStore } from '@/store/useStore'

const COLOR_MAP: Record<string, string> = {
  'cut-50': '#3b82f6',
  'hike-25': '#ef4444',
  'qt': '#8b5cf6',
  'recession': '#f97316',
  'inflation': '#eab308',
}

const ICON_MAP: Record<string, string> = {
  'cut-50': '📉',
  'hike-25': '📈',
  'qt': '🔄',
  'recession': '⚠️',
  'inflation': '🔥',
}

export default function PolicyEvents() {
  const applyPolicyEvent = useStore(s => s.applyPolicyEvent)
  const lastEventId = useStore(s => s.lastEventId)
  const [tooltip, setTooltip] = useState<{ id: string; text: string } | null>(null)

  const handleClick = useCallback((eventId: string) => {
    applyPolicyEvent(eventId)
    const event = POLICY_EVENTS.find(e => e.id === eventId)
    if (event) {
      setTooltip({ id: eventId, text: event.description })
    }
  }, [applyPolicyEvent])

  useEffect(() => {
    if (!tooltip) return
    const timer = setTimeout(() => setTooltip(null), 3000)
    return () => clearTimeout(timer)
  }, [tooltip])

  return (
    <div className="relative">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-navy-600">
        {POLICY_EVENTS.map(event => {
          const color = COLOR_MAP[event.id] || '#6b7280'
          const isActive = lastEventId === event.id
          return (
            <button
              key={event.id}
              onClick={() => handleClick(event.id)}
              className="relative flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: `${color}22`,
                border: `1.5px solid ${color}`,
                boxShadow: isActive
                  ? `0 0 0 2px #0f1729, 0 0 0 4px #d4a843, 0 0 12px ${color}44`
                  : `0 0 8px ${color}22`,
              }}
            >
              <span className="text-sm">{ICON_MAP[event.id]}</span>
              <span style={{ color }}>{event.name}</span>
              {isActive && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{ backgroundColor: '#d4a843', boxShadow: '0 0 6px #d4a843' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {tooltip && (
        <div
          className="absolute top-full left-0 right-0 mt-2 z-50 animate-fade-in"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,41,0.95), rgba(26,39,64,0.95))',
            border: '1px solid rgba(212,168,67,0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="px-4 py-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">{ICON_MAP[tooltip.id]}</span>
              <span className="text-gold-500 font-medium text-xs">
                {POLICY_EVENTS.find(e => e.id === tooltip.id)?.name}
              </span>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed">{tooltip.text}</p>
          </div>
          <div
            className="h-0.5 rounded-full"
            style={{
              background: COLOR_MAP[tooltip.id] || '#6b7280',
              animation: 'shrink 3s linear forwards',
            }}
          />
          <style>{`
            @keyframes shrink {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

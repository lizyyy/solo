import { useState } from 'react'
import type { ExceptionRecord, ExceptionType } from '@/types'

const EXCEPTION_STYLES: Record<ExceptionType, { bg: string; text: string; label: string }> = {
  misoperation: { bg: 'bg-risk-red/15', text: 'text-risk-red', label: '误操作' },
  boundary_score: { bg: 'bg-risk-yellow/15', text: 'text-risk-yellow', label: '边界分数' },
  pause_interrupt: { bg: 'bg-purple-500/15', text: 'text-purple-600', label: '故意暂停' },
  dirty_data: { bg: 'bg-cafe-latte/40', text: 'text-cafe-brown/60', label: '脏数据' },
}

interface ExceptionTagProps {
  exception: ExceptionRecord
}

export default function ExceptionTag({ exception }: ExceptionTagProps) {
  const [expanded, setExpanded] = useState(false)
  const style = EXCEPTION_STYLES[exception.exceptionType]

  return (
    <div>
      <button
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text} transition-colors`}
        onClick={() => setExpanded(e => !e)}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
        {style.label}
      </button>
      <p className="text-xs text-cafe-brown/70 mt-1">{exception.description}</p>
      {expanded && (
        <div className="mt-1.5 text-xs text-cafe-brown/50 bg-cafe-latte/20 rounded-lg p-2">
          {exception.context}
        </div>
      )}
    </div>
  )
}

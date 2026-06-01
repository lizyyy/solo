import { AlertTriangle } from 'lucide-react'
import type { ExceptionRecord, ExceptionType } from '@/types'
import ExceptionTag from '@/components/feedback/ExceptionTag'

const EXCEPTION_BORDER_COLORS: Record<ExceptionType, string> = {
  misoperation: 'border-l-risk-red',
  boundary_score: 'border-l-risk-yellow',
  pause_interrupt: 'border-l-purple-500',
  dirty_data: 'border-l-cafe-latte',
}

interface ExceptionTableProps {
  exceptions: ExceptionRecord[]
}

export default function ExceptionTable({ exceptions }: ExceptionTableProps) {
  return (
    <div className="card-cafe overflow-x-auto">
      {exceptions.length > 0 ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-risk-yellow" />
            <h3 className="font-bold text-sm text-cafe-brown">
              例外明细 ({exceptions.length})
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cafe-latte/50">
                <th className="text-left py-2 px-3 text-xs text-cafe-brown/50 font-medium">时间</th>
                <th className="text-left py-2 px-3 text-xs text-cafe-brown/50 font-medium">类型</th>
                <th className="text-left py-2 px-3 text-xs text-cafe-brown/50 font-medium">描述</th>
                <th className="text-left py-2 px-3 text-xs text-cafe-brown/50 font-medium">上下文</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map(ex => (
                <tr
                  key={ex.id}
                  className={`border-b border-cafe-latte/20 border-l-4 ${EXCEPTION_BORDER_COLORS[ex.exceptionType]}`}
                >
                  <td className="py-2 px-3 text-xs text-cafe-brown/50 whitespace-nowrap">
                    {new Date(ex.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3">
                    <ExceptionTag exception={ex} />
                  </td>
                  <td className="py-2 px-3 text-xs text-cafe-brown/70">
                    {ex.description}
                  </td>
                  <td className="py-2 px-3 text-xs text-cafe-brown/50">
                    {ex.context}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="text-center text-sm text-cafe-brown/40 py-6">本局无例外记录</p>
      )}
    </div>
  )
}

import { useState } from 'react'
import { format } from 'date-fns'
import { FileCheck, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Confirmation } from '@/types'

interface ConfirmationsListProps {
  confirmations: Confirmation[]
  onAdd: (confirmation: Confirmation) => void
  recordId: string
}

const typeLabels: Record<string, string> = {
  insurance_verified: '保险验证',
  lighting_checked: '灯光检查',
  exhibition_confirmed: '展览确认',
  manual_review: '人工审核',
}

export default function ConfirmationsList({ confirmations, onAdd, recordId }: ConfirmationsListProps) {
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<Confirmation['type']>('manual_review')
  const [confirmedBy, setConfirmedBy] = useState('')
  const [note, setNote] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmedBy.trim()) return

    const confirmation: Confirmation = {
      id: `confirmation-${Date.now()}`,
      recordId,
      type,
      confirmedBy: confirmedBy.trim(),
      confirmedAt: new Date().toISOString(),
      note: note.trim(),
    }

    onAdd(confirmation)
    setType('manual_review')
    setConfirmedBy('')
    setNote('')
    setShowForm(false)
  }

  const sortedConfirmations = [...confirmations].sort(
    (a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime()
  )

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">确认记录</h3>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
        >
          <Plus className="w-4 h-4" />
          添加
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              类型
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Confirmation['type'])}
              className={cn(
                'w-full px-3 py-2 border border-gray-300 rounded-lg',
                'focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm'
              )}
            >
              <option value="insurance_verified">保险验证</option>
              <option value="lighting_checked">灯光检查</option>
              <option value="exhibition_confirmed">展览确认</option>
              <option value="manual_review">人工审核</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              确认人
            </label>
            <input
              type="text"
              value={confirmedBy}
              onChange={(e) => setConfirmedBy(e.target.value)}
              placeholder="输入确认人姓名"
              className={cn(
                'w-full px-3 py-2 border border-gray-300 rounded-lg',
                'focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm'
              )}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              备注
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="输入备注信息"
              rows={3}
              className={cn(
                'w-full px-3 py-2 border border-gray-300 rounded-lg',
                'focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm resize-none'
              )}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!confirmedBy.trim()}
              className={cn(
                'flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm',
                'hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
              )}
            >
              提交
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {sortedConfirmations.map((confirmation) => (
          <div
            key={confirmation.id}
            className="p-3 bg-gray-50 rounded-lg border border-gray-100"
          >
            <div className="flex items-start justify-between mb-1">
              <span className="text-xs font-medium px-2 py-0.5 bg-green-100 text-green-700 rounded">
                {typeLabels[confirmation.type] || confirmation.type}
              </span>
              <span className="text-xs text-gray-500">
                {format(new Date(confirmation.confirmedAt), 'yyyy-MM-dd HH:mm')}
              </span>
            </div>
            <p className="text-sm text-gray-900 mb-1">
              <span className="font-medium">确认人:</span> {confirmation.confirmedBy}
            </p>
            {confirmation.note && (
              <p className="text-sm text-gray-600">{confirmation.note}</p>
            )}
          </div>
        ))}
        {sortedConfirmations.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            <FileCheck className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">暂无确认记录</p>
          </div>
        )}
      </div>
    </div>
  )
}

import { cn } from '@/lib/utils'
import type { PhotoRecord } from '@/lib/types'
import { FIELD_LABELS } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'
import { X, FileText, Shield, Gavel } from 'lucide-react'

interface MarkDetailDrawerProps {
  record: PhotoRecord | null
  onClose: () => void
  open: boolean
}

const BASE_INFO_FIELDS: (keyof PhotoRecord)[] = [
  'fileName',
  'shootDate',
  'sourceType',
  'specVersion',
]

const AUTH_FIELDS: (keyof PhotoRecord)[] = [
  'authorizationStatus',
  'authorizationExpiry',
  'authorizationContact',
]

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') return new Date(value).toLocaleString('zh-CN')
  return String(value)
}

export default function MarkDetailDrawer({
  record,
  onClose,
  open,
}: MarkDetailDrawerProps) {
  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-50 w-96 transform bg-[#1a1a2e] shadow-2xl transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {record && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-zinc-700/50 px-6 py-4">
            <h2 className="text-lg font-semibold text-zinc-100">记录详情</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <section className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-400" />
                <h3 className="text-sm font-medium text-zinc-300">基本信息</h3>
              </div>
              <div className="space-y-2">
                {BASE_INFO_FIELDS.map((field) => (
                  <div
                    key={field}
                    className="flex items-start justify-between text-sm"
                  >
                    <span className="text-zinc-500">
                      {FIELD_LABELS[field] ?? field}
                    </span>
                    <span className="ml-4 text-right text-zinc-200">
                      {field === 'sourceType' ? (
                        <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                          {record[field]}
                        </span>
                      ) : (
                        formatValue(record[field])
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-zinc-400" />
                <h3 className="text-sm font-medium text-zinc-300">授权信息</h3>
              </div>
              <div className="space-y-2">
                {AUTH_FIELDS.map((field) => (
                  <div
                    key={field}
                    className="flex items-start justify-between text-sm"
                  >
                    <span className="text-zinc-500">
                      {FIELD_LABELS[field] ?? field}
                    </span>
                    <span className="ml-4 text-right text-zinc-200">
                      {field === 'authorizationStatus' ? (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            record.authorizationStatus === '有效'
                              ? 'bg-emerald-900/60 text-emerald-400'
                              : record.authorizationStatus === '过期'
                                ? 'bg-amber-900/60 text-amber-400'
                                : 'bg-zinc-700 text-zinc-300',
                          )}
                        >
                          {record.authorizationStatus}
                        </span>
                      ) : (
                        formatValue(record[field])
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Gavel className="h-4 w-4 text-zinc-400" />
                <h3 className="text-sm font-medium text-zinc-300">判断结果</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-start justify-between text-sm">
                  <span className="text-zinc-500">标记状态</span>
                  <StatusBadge status={record.markStatus} />
                </div>
                {record.markReason && (
                  <div className="rounded-md bg-amber-900/30 px-3 py-2">
                    <p className="mb-1 text-xs text-amber-400/80">判断原因</p>
                    <p className="text-sm text-amber-200">
                      {record.markReason}
                    </p>
                  </div>
                )}
                {record.nextStep && (
                  <div className="rounded-md bg-sky-900/30 px-3 py-2">
                    <p className="mb-1 text-xs text-sky-400/80">后续步骤</p>
                    <p className="text-sm text-sky-200">{record.nextStep}</p>
                  </div>
                )}
                {record.reviewOpinion && (
                  <div className="flex items-start justify-between text-sm">
                    <span className="text-zinc-500">
                      {FIELD_LABELS.reviewOpinion}
                    </span>
                    <span className="ml-4 text-right text-zinc-200">
                      {record.reviewOpinion}
                    </span>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

import { Lock, AlertTriangle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import LockedFieldsGuard, { type LockedField } from './LockedFieldsGuard'

export type FieldMappingStatus = 'mapped' | 'unmapped' | 'locked'

export interface FieldMappingRow {
  id: string
  originalField: string
  standardField: string | null
  status: FieldMappingStatus
  isLocked: boolean
}

interface FieldMappingPanelProps {
  mappings: FieldMappingRow[]
  lockedFields?: LockedField[]
  className?: string
}

export default function FieldMappingPanel({
  mappings,
  lockedFields = [],
  className,
}: FieldMappingPanelProps) {
  const totalCount = mappings.length
  const mappedCount = mappings.filter((m) => m.status === 'mapped').length
  const lockedCount = mappings.filter((m) => m.isLocked).length
  const missingCount = mappings.filter(
    (m) => m.status === 'unmapped' && m.standardField === null,
  ).length

  const getRowClass = (row: FieldMappingRow) => {
    if (row.isLocked) {
      return 'bg-blue-50 border-blue-200'
    }
    if (row.status === 'mapped') {
      return 'bg-slate-50 border-slate-200'
    }
    return 'bg-amber-50 border-amber-200'
  }

  const getStatusBadge = (row: FieldMappingRow) => {
    if (row.isLocked) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
          <Lock className="h-3 w-3" />
          锁定
        </span>
      )
    }
    if (row.status === 'mapped') {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          ✓ 已映射
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
        <AlertTriangle className="h-3 w-3" />
        未映射
      </span>
    )
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
          <h2 className="text-lg font-bold text-slate-800">
            会议纪要字段归一化处理链
          </h2>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
              Processing Chain v2.1
            </span>
          </div>
        </div>
      </div>

      {lockedFields.length > 0 && (
        <div className="border-b border-slate-200 p-4">
          <LockedFieldsGuard fields={lockedFields} />
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th className="w-[5%] border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                状态
              </th>
              <th className="w-[35%] border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                原始字段名
              </th>
              <th className="w-[10%] border-b border-slate-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                →映射→
              </th>
              <th className="w-[45%] border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                标准字段名
              </th>
              <th className="w-[5%] border-b border-slate-200 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-slate-100 transition-colors hover:bg-slate-50/50',
                  getRowClass(row),
                )}
              >
                <td className="px-4 py-3">{getStatusBadge(row)}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'font-mono text-sm',
                      row.isLocked
                        ? 'font-bold text-blue-700'
                        : 'font-medium text-slate-700',
                    )}
                  >
                    {row.isLocked && (
                      <Lock className="mr-1 inline-block h-3.5 w-3.5 text-blue-600" />
                    )}
                    {row.originalField}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <ChevronRight className="mx-auto h-5 w-5 text-slate-400" />
                </td>
                <td className="px-4 py-3">
                  {row.standardField ? (
                    <span
                      className={cn(
                        'inline-block rounded-md px-2.5 py-1 font-mono text-sm',
                        row.isLocked
                          ? 'bg-blue-200 font-bold text-blue-800'
                          : row.status === 'mapped'
                            ? 'bg-emerald-100 font-medium text-emerald-800'
                            : 'bg-amber-100 font-medium text-amber-800',
                      )}
                    >
                      {row.standardField}
                    </span>
                  ) : (
                    <span className="text-sm italic text-slate-400">
                      未映射，请选择标准字段
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {!row.isLocked && (
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                    >
                      编辑
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 text-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
            <span className="text-slate-600">
              共识别 <b className="text-slate-800">{totalCount}</b> 条字段
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600">
              <b className="text-emerald-700">{mappedCount}</b> 条已映射
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-slate-600">
              <b className="text-blue-700">{lockedCount}</b> 条强制锁定
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
            <span className="text-slate-600">
              <b className="text-slate-700">{missingCount}</b> 条丢失
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
              style={{
                width: `${totalCount > 0 ? (mappedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-xs font-medium text-slate-500">
            {totalCount > 0 ? Math.round((mappedCount / totalCount) * 100) : 0}%
          </span>
        </div>
      </div>
    </div>
  )
}

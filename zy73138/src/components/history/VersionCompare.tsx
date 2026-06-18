import { GitCompare } from 'lucide-react'
import type { ChangeRecord } from '@/types'
import { formatDateTime } from '@/utils'

interface VersionCompareProps {
  changes: ChangeRecord[]
}

export default function VersionCompare({ changes }: VersionCompareProps) {
  if (changes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-foam/50 font-sans text-sm">
        暂无可比较的变更记录
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-foam/70 font-sans text-sm mb-4">
        <GitCompare className="w-4 h-4 text-tide" />
        <span>版本对比</span>
      </div>

      {changes.map((change) => (
        <div
          key={change.id}
          className="rounded-lg border border-ocean-700 overflow-hidden"
        >
          <div className="grid grid-cols-2 gap-0">
            <div className="bg-rust/10 border-r border-ocean-700 p-3">
              <div className="text-foam/40 text-xs font-sans mb-1 tracking-wide">
                变更前
              </div>
              <div className="font-mono text-sm text-rust line-through">
                {change.oldValue}
              </div>
            </div>

            <div className="bg-tide/10 p-3">
              <div className="text-foam/40 text-xs font-sans mb-1 tracking-wide">
                变更后
              </div>
              <div className="font-mono text-sm text-tide">
                {change.newValue}
              </div>
            </div>
          </div>

          <div className="bg-ocean-800 px-3 py-2 border-t border-ocean-700 flex items-center justify-between text-xs font-sans">
            <div className="flex items-center gap-3">
              <span className="text-sand">{change.field}</span>
              <span className="text-foam/40">|</span>
              <span className="text-foam/50">{change.changedBy}</span>
              <span className="text-foam/40">|</span>
              <span className="text-foam/40">{formatDateTime(change.changedAt)}</span>
            </div>
          </div>

          {change.reason && (
            <div className="bg-ocean-900 px-3 py-2 border-t border-ocean-700 text-xs font-sans text-foam/50 leading-relaxed">
              <span className="text-foam/30">变更原因：</span>
              {change.reason}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

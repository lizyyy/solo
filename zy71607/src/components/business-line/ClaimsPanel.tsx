import type { ClaimRecord } from '@/types'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface ClaimsPanelProps {
  claims: ClaimRecord[]
}

export default function ClaimsPanel({ claims }: ClaimsPanelProps) {
  const hasMissing = claims.some((c) => !c.isIncluded)

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent-blue/15 flex items-center justify-center">
          <AlertTriangle className="w-3.5 h-3.5 text-accent-blue" />
        </div>
        <h3 className="text-sm font-medium text-surface-200">出险归集</h3>
        {hasMissing && (
          <span className="px-2 py-0.5 rounded-full bg-accent-red/15 text-accent-red text-[10px] font-medium">
            存在漏入
          </span>
        )}
      </div>

      <div className="space-y-2">
        {claims.map((claim) => (
          <div
            key={claim.id}
            className={`rounded-lg border px-3 py-3 ${
              claim.isIncluded
                ? 'bg-surface-700/40 border-surface-600'
                : 'bg-accent-red/5 border-l-2 border-l-accent-red border-r-surface-600 border-t-surface-600 border-b-surface-600'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {claim.isIncluded ? (
                  <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-accent-red" />
                )}
                <span className="text-xs text-surface-200 font-medium">
                  {claim.claimType}
                </span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  claim.isIncluded
                    ? 'bg-accent-green/15 text-accent-green'
                    : 'bg-accent-red/15 text-accent-red'
                }`}
              >
                {claim.isIncluded ? '已纳入' : '漏入'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-surface-400">{claim.claimDate}</span>
              <span className="text-surface-100 font-mono">
                ¥{claim.claimAmount.toLocaleString()}
              </span>
            </div>
            {!claim.isIncluded && claim.missReason && (
              <div className="mt-2 bg-accent-red/10 rounded-md px-2.5 py-2">
                <p className="text-[11px] text-accent-red leading-relaxed">
                  {claim.missReason}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {claims.length === 0 && (
        <div className="text-center py-6">
          <p className="text-xs text-surface-400">无出险记录</p>
        </div>
      )}
    </div>
  )
}

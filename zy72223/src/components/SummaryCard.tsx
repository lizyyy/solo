import { AlertCircle, FileQuestion, ArrowRight } from 'lucide-react'
import { type Summary } from '@/store'

interface SummaryCardProps {
  summary: Summary
}

const roleConfig = {
  fund_accountant: { label: '基金会计', className: 'bg-ledger-amber-light text-ledger-amber' },
  risk_control: { label: '风控', className: 'bg-ledger-red-light text-ledger-red' },
}

export default function SummaryCard({ summary }: SummaryCardProps) {
  const role = roleConfig[summary.responsibleRole] || roleConfig.fund_accountant

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-ledger-border p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-ledger-red-light flex items-center justify-center shrink-0">
          <AlertCircle className="w-4 h-4 text-ledger-red" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-ledger-muted mb-1">原因</p>
          <p className="text-sm text-ledger-text font-serif leading-relaxed">{summary.reason}</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-ledger-amber-light flex items-center justify-center shrink-0">
          <FileQuestion className="w-4 h-4 text-ledger-amber" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-ledger-muted mb-1">缺少材料</p>
          {summary.missingMaterials.length > 0 ? (
            <ul className="space-y-0.5">
              {summary.missingMaterials.map((m, i) => (
                <li key={i} className="text-sm text-ledger-text font-serif">· {m}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ledger-muted">无</p>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-ledger-green-light flex items-center justify-center shrink-0">
          <ArrowRight className="w-4 h-4 text-ledger-green" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-ledger-muted mb-1">下一步</p>
          <p className="text-sm text-ledger-text font-serif leading-relaxed">{summary.nextStep}</p>
        </div>
      </div>

      <div className="pt-2 border-t border-ledger-border">
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${role.className}`}>
          {role.label}
        </span>
      </div>
    </div>
  )
}

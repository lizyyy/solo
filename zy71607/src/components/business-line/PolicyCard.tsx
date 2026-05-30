import type { PolicyRecord } from '@/types'
import { FileText, Calendar, Car, Shield } from 'lucide-react'

interface PolicyCardProps {
  policy: PolicyRecord
}

export default function PolicyCard({ policy }: PolicyCardProps) {
  return (
    <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-accent-blue/15 flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-accent-blue" />
        </div>
        <h3 className="text-sm font-medium text-surface-200">保单记录</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-700/40 rounded-lg px-3 py-2.5">
          <p className="text-[10px] text-surface-400 mb-0.5">客户姓名</p>
          <p className="text-sm text-surface-100 font-medium">{policy.customerName}</p>
        </div>
        <div className="bg-surface-700/40 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Car className="w-3 h-3 text-surface-400" />
            <p className="text-[10px] text-surface-400">车牌号</p>
          </div>
          <p className="text-sm text-surface-100 font-mono font-medium mt-0.5">{policy.plateNumber}</p>
        </div>
        <div className="bg-surface-700/40 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-surface-400" />
            <p className="text-[10px] text-surface-400">保险期间</p>
          </div>
          <p className="text-xs text-surface-100 mt-0.5">
            {policy.startDate} ~ {policy.endDate}
          </p>
        </div>
        <div className="bg-surface-700/40 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-surface-400" />
            <p className="text-[10px] text-surface-400">NCD系数</p>
          </div>
          <p className="text-sm text-surface-100 font-mono font-medium mt-0.5">
            {policy.ncdCoefficient}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[10px] text-surface-400 mb-2">险种与保额</p>
        <div className="space-y-1.5">
          {policy.insuranceTypes.map((type) => (
            <div key={type} className="flex items-center justify-between bg-surface-700/40 rounded-lg px-3 py-2">
              <span className="text-xs text-surface-300">{type}</span>
              <span className="text-xs text-surface-100 font-mono">
                ¥{policy.coverageAmounts[type]?.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between bg-accent-blue/10 border border-accent-blue/20 rounded-lg px-3 py-2.5">
        <span className="text-xs text-accent-blue font-medium">上年保费</span>
        <span className="text-lg text-accent-blue font-mono font-bold">
          ¥{policy.premium.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  )
}

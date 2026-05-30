import { useStore } from '@/store/useStore'
import { formatWeight, formatRatio, getStatusColor, getStatusBg, statusLabel } from '@/lib/helpers'

export default function VerificationTab() {
  const schemeDetail = useStore((s) => s.schemeDetail)
  if (!schemeDetail) return null

  const verifs = schemeDetail.verifications

  return (
    <table className="w-full text-sm">
      <thead><tr className="text-zinc-400 border-b border-zinc-700">
        <th className="text-left py-2 px-2">标签</th><th className="py-2 px-2">实际载荷</th><th className="py-2 px-2">额定载荷</th>
        <th className="py-2 px-2">载荷比</th><th className="py-2 px-2">安全系数</th><th className="py-2 px-2">状态</th>
      </tr></thead>
      <tbody>
        {verifs.map((v) => (
          <tr key={v.pointId} className="border-b border-zinc-800 hover:bg-zinc-800/40">
            <td className="py-2 px-2">{v.pointLabel}</td>
            <td className="py-2 px-2 text-center">{formatWeight(v.actualLoadKg, 'kg')}</td>
            <td className="py-2 px-2 text-center">{formatWeight(v.ratedLoadKg, 'kg')}</td>
            <td className="py-2 px-2 text-center">
              <div className="flex items-center gap-2 justify-center">
                <div className="w-24 h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${v.status === 'overload' ? 'bg-red-500' : v.status === 'warning' ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(v.loadRatio * 100, 100)}%` }} />
                </div>
                <span className="text-xs">{formatRatio(v.loadRatio * 100)}</span>
              </div>
            </td>
            <td className="py-2 px-2 text-center">{v.safetyFactor.toFixed(1)}</td>
            <td className="py-2 px-2 text-center">
              <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(v.status)} ${getStatusBg(v.status)}`}>
                {statusLabel(v.status)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

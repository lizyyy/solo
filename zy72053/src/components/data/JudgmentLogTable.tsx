import { useStore } from '@/store/useStore'
import { JUDGMENT_TYPE_LABELS } from '@/types'
import { Link } from 'react-router-dom'

export default function JudgmentLogTable() {
  const judgments = useStore((s) => s.judgments)

  const sorted = [...judgments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.05]">
            <th className="px-4 py-2.5 text-left font-medium text-gray-400">时间</th>
            <th className="px-4 py-2.5 text-left font-medium text-gray-400">操作人</th>
            <th className="px-4 py-2.5 text-left font-medium text-gray-400">记录ID</th>
            <th className="px-4 py-2.5 text-left font-medium text-gray-400">判断类型</th>
            <th className="px-4 py-2.5 text-left font-medium text-gray-400">原值</th>
            <th className="px-4 py-2.5 text-left font-medium text-gray-400">新值</th>
            <th className="px-4 py-2.5 text-left font-medium text-gray-400">理由</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((log, idx) => (
            <tr
              key={log.id}
              className={`border-b border-white/5 ${
                idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'
              }`}
            >
              <td className="px-4 py-2 font-mono text-xs text-gray-400">
                {new Date(log.createdAt).toLocaleString('zh-CN')}
              </td>
              <td className="px-4 py-2 text-gray-300">{log.operator}</td>
              <td className="px-4 py-2">
                <Link
                  to={`/record/${log.pointId}`}
                  className="font-mono text-xs text-cyan-400 hover:underline"
                >
                  {log.pointId}
                </Link>
              </td>
              <td className="px-4 py-2 text-cyan-300">
                {JUDGMENT_TYPE_LABELS[log.judgmentType]}
              </td>
              <td className="px-4 py-2 font-mono text-xs text-gray-400">{log.oldValue}</td>
              <td className="px-4 py-2 font-mono text-xs text-gray-400">{log.newValue}</td>
              <td className="max-w-xs truncate px-4 py-2 text-xs text-gray-500">
                {log.reason}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                暂无判断日志
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

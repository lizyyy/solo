import { useDataStore } from "@/store/useDataStore"
import { getFlagColor } from "@/utils/dataQuality"
import type { DataQualityFlag } from "@/types"

function NullValue() {
  return <span className="text-zinc-300">—</span>
}

function FlagBadge({ flag }: { flag: DataQualityFlag }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${getFlagColor(flag.type)}`}
    >
      {flag.type.replace("_", " ")}
    </span>
  )
}

export default function DataTable() {
  const { records } = useDataStore()

  return (
    <div className="overflow-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-50">
          <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-3">行号</th>
            <th className="px-3 py-3">时间</th>
            <th className="px-3 py-3 font-mono">炉温</th>
            <th className="px-3 py-3">单位</th>
            <th className="px-3 py-3 font-mono">持续时间</th>
            <th className="px-3 py-3 font-mono">豆心温度</th>
            <th className="px-3 py-3 font-mono">豆表温度</th>
            <th className="px-3 py-3">烘焙度</th>
            <th className="px-3 py-3">原始备注</th>
            <th className="px-3 py-3">问题标签</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {records.map((record, index) => (
            <tr
              key={record.id}
              className={
                record.conflictWithNote
                  ? "border-l-4 border-l-amber-400 bg-amber-50/30"
                  : "border-l-4 border-l-transparent"
              }
            >
              <td className="px-3 py-2.5 font-mono text-zinc-400">{index + 1}</td>
              <td className="px-3 py-2.5 text-zinc-700">{record.timestamp}</td>
              <td className="px-3 py-2.5 font-mono text-zinc-700">
                {record.temperature !== null ? record.temperature : <NullValue />}
              </td>
              <td className="px-3 py-2.5 text-zinc-700">{record.temperatureUnit}</td>
              <td className="px-3 py-2.5 font-mono text-zinc-700">
                {record.duration !== null ? record.duration : <NullValue />}
              </td>
              <td className="px-3 py-2.5 font-mono text-zinc-700">
                {record.beanCenterTemp !== null ? record.beanCenterTemp : <NullValue />}
              </td>
              <td className="px-3 py-2.5 font-mono text-zinc-700">
                {record.beanSurfaceTemp !== null ? record.beanSurfaceTemp : <NullValue />}
              </td>
              <td className="px-3 py-2.5 text-zinc-700">{record.roastingLevel}</td>
              <td className="max-w-[200px] truncate px-3 py-2.5 text-zinc-700">
                {record.rawNote || <NullValue />}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {record.dataQualityFlags.map((flag) => (
                    <FlagBadge key={flag.id} flag={flag} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

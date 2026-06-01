import { useStore } from '@/store/useStore'
import RecordForm from '@/components/RecordForm'
import BatchInput from '@/components/BatchInput'
import { DatabaseZap, Trash2 } from 'lucide-react'

export default function InputPage() {
  const records = useStore((s) => s.records)
  const initSampleData = useStore((s) => s.initSampleData)
  const clearAll = useStore((s) => s.clearAll)
  const hasData = records.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">数据录入</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            逐条或批量录入微重力弹簧实验参数，标注数据来源
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!hasData && (
            <button
              onClick={initSampleData}
              className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-400 transition-all hover:bg-orange-500/20"
            >
              <DatabaseZap className="h-3.5 w-3.5" />
              加载样例数据
            </button>
          )}
          {hasData && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 transition-all hover:border-red-500/30 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空数据
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h3 className="mb-4 text-sm font-medium text-slate-300">逐条录入</h3>
          <RecordForm />
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h3 className="mb-4 text-sm font-medium text-slate-300">批量导入</h3>
          <BatchInput />
        </div>
      </div>

      {hasData && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h3 className="mb-3 text-sm font-medium text-slate-300">
            已录入记录（{records.length}条）
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50 text-left text-slate-500">
                  <th className="pb-2 pr-4 font-medium">时间戳</th>
                  <th className="pb-2 pr-4 font-medium">刚度</th>
                  <th className="pb-2 pr-4 font-medium">位移</th>
                  <th className="pb-2 pr-4 font-medium">力</th>
                  <th className="pb-2 pr-4 font-medium">方向</th>
                  <th className="pb-2 font-medium">来源</th>
                </tr>
              </thead>
              <tbody>
                {[...records]
                  .sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() -
                      new Date(b.timestamp).getTime()
                  )
                  .map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-800/50 text-slate-400"
                    >
                      <td className="py-1.5 pr-4 font-mono">
                        {new Date(r.timestamp).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-1.5 pr-4 font-mono">
                        {r.springStiffness} {r.stiffnessUnit}
                      </td>
                      <td className="py-1.5 pr-4 font-mono">
                        {r.displacement} {r.displacementUnit}
                      </td>
                      <td className="py-1.5 pr-4 font-mono">
                        {r.force.toFixed(1)} {r.forceUnit}
                      </td>
                      <td className="py-1.5 pr-4 font-mono">{r.direction}</td>
                      <td className="py-1.5 text-slate-500">
                        {r.source.reference}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

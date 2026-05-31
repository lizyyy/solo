import { useState } from "react"
import { ChevronDown, RotateCcw, FileText, Clock } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { SOURCE_LABELS, type DataSource } from "@/types"
import { cn } from "@/lib/utils"
import ImportZone from "@/components/DataManage/ImportZone"
import RollbackModal from "@/components/DataManage/RollbackModal"
import OperationTimeline from "@/components/DataManage/OperationTimeline"

export default function DataManage() {
  const { experiments, selectedExperimentId, selectExperiment, getExperimentDataSources } =
    useAppStore()
  const [rollbackTarget, setRollbackTarget] = useState<DataSource | null>(null)

  const dataSources = selectedExperimentId ? getExperimentDataSources(selectedExperimentId) : []

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">数据管理</h1>
        <div className="relative">
          <select
            value={selectedExperimentId ?? ""}
            onChange={(e) => selectExperiment(e.target.value || null)}
            className="appearance-none rounded-md bg-slate-800 px-4 py-2 pr-8 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">选择实验</option>
            {experiments.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-slate-300">数据导入</h2>
        <ImportZone />
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-slate-300">已导入数据源</h2>
        {dataSources.length === 0 ? (
          <div className="rounded-md bg-slate-900 py-8 text-center text-sm text-slate-500">
            暂无导入数据
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-xs text-slate-500">
                  <th className="px-4 py-2.5 text-left font-medium">文件名</th>
                  <th className="px-4 py-2.5 text-left font-medium">来源类型</th>
                  <th className="px-4 py-2.5 text-left font-medium">导入时间</th>
                  <th className="px-4 py-2.5 text-left font-medium">操作人</th>
                  <th className="px-4 py-2.5 text-left font-medium">状态</th>
                  <th className="px-4 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {dataSources.map((ds) => (
                  <tr
                    key={ds.id}
                    className="border-t border-slate-800/60 bg-slate-900/40 hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 text-slate-300">
                        <FileText className="h-4 w-4 text-slate-500" />
                        {ds.fileName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">
                      {SOURCE_LABELS[ds.type]}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {ds.importedAt}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">{ds.importedBy}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
                          ds.rolledBack
                            ? "bg-red-400/20 text-red-400"
                            : "bg-emerald-400/20 text-emerald-400"
                        )}
                      >
                        {ds.rolledBack ? "已撤回" : "正常"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!ds.rolledBack && (
                        <button
                          onClick={() => setRollbackTarget(ds)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-400/10"
                        >
                          <RotateCcw className="h-3 w-3" />
                          撤回
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-300">操作日志</h2>
        <div className="rounded-md bg-slate-900 p-4">
          <OperationTimeline experimentId={selectedExperimentId} />
        </div>
      </section>

      <RollbackModal
        open={!!rollbackTarget}
        onClose={() => setRollbackTarget(null)}
        dataSource={rollbackTarget}
      />
    </div>
  )
}

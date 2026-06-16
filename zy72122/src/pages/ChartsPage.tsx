import { useStore } from '@/store/useStore'
import ExperimentChart from '@/components/ExperimentChart'
import { Settings, RefreshCw } from 'lucide-react'

export default function ChartsPage() {
  const config = useStore((s) => s.config)
  const updateConfig = useStore((s) => s.updateConfig)
  const runValidation = useStore((s) => s.runValidation)
  const records = useStore((s) => s.records)
  const validationResults = useStore((s) => s.validationResults)

  const validRecords = records.filter((r) => {
    const vr = validationResults.find((v) => v.recordId === r.id)
    return vr ? vr.status !== 'error' : true
  })
  const overThresholdIds = validationResults
    .filter((v) => v.status === 'error')
    .map((v) => v.recordId)
  const overThresholdCount = overThresholdIds.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">图表可视化</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            弹簧实验数据折线图/散点图复现，高亮异常点和安全阈值线
          </p>
        </div>
        <button
          onClick={runValidation}
          className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 transition-all hover:border-orange-500/30 hover:text-orange-400"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重新校验
        </button>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
        <ExperimentChart />
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Settings className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-medium text-slate-300">
            安全阈值参数配置
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              力上限 ({config.expectedForceUnit})
            </label>
            <input
              type="number"
              value={config.forceThresholdMax}
              onChange={(e) =>
                updateConfig({
                  forceThresholdMax: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              力下限 ({config.expectedForceUnit})
            </label>
            <input
              type="number"
              value={config.forceThresholdMin}
              onChange={(e) =>
                updateConfig({
                  forceThresholdMin: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              位移上限 ({config.expectedDisplacementUnit})
            </label>
            <input
              type="number"
              value={config.displacementThresholdMax}
              onChange={(e) =>
                updateConfig({
                  displacementThresholdMax: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              位移下限 ({config.expectedDisplacementUnit})
            </label>
            <input
              type="number"
              value={config.displacementThresholdMin}
              onChange={(e) =>
                updateConfig({
                  displacementThresholdMin: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              最大时间间隔 (ms)
            </label>
            <input
              type="number"
              value={config.maxIntervalMs}
              onChange={(e) =>
                updateConfig({
                  maxIntervalMs: parseInt(e.target.value) || 60000,
                })
              }
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              期望位移单位
            </label>
            <select
              value={config.expectedDisplacementUnit}
              onChange={(e) =>
                updateConfig({ expectedDisplacementUnit: e.target.value })
              }
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="m">m</option>
            </select>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-2 text-xs text-orange-300">
          修改参数后会自动重新校验所有记录并更新图表。阈值变更不会删除已有的审计日志。
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-300">数据统计</h3>
          {overThresholdCount > 0 && (
            <p className="text-[10px] text-orange-400">
              已排除 {overThresholdCount} 条超阈值记录，不参与均值计算
            </p>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="rounded-lg bg-slate-800/50 p-3">
            <p className="text-lg font-bold text-slate-200">{records.length}</p>
            <p className="text-[10px] text-slate-500">总记录数</p>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-3">
            <p className="text-lg font-bold text-slate-200">
              {validRecords.length > 0
                ? (
                    validRecords.reduce((s, r) => s + r.force, 0) / validRecords.length
                  ).toFixed(1)
                : '0'}
            </p>
            <p className="text-[10px] text-slate-500">平均力(N)</p>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-3">
            <p className="text-lg font-bold text-slate-200">
              {records.length > 0
                ? Math.max(...records.map((r) => r.force)).toFixed(1)
                : '0'}
            </p>
            <p className="text-[10px] text-slate-500">最大力(N)</p>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-3">
            <p className="text-lg font-bold text-slate-200">
              {records.length > 0
                ? Math.min(...records.map((r) => r.force)).toFixed(1)
                : '0'}
            </p>
            <p className="text-[10px] text-slate-500">最小力(N)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

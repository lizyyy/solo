import { useCraneStore } from '@/store'
import SensorInput from '@/components/SensorInput'
import CalcCards from '@/components/CalcCards'
import ThresholdLights from '@/components/ThresholdLights'
import ExceptionTracker from '@/components/ExceptionTracker'
import AuditLog from '@/components/AuditLog'
import { Database, RefreshCw, Trash2 } from 'lucide-react'

export default function Dashboard() {
  const records = useCraneStore(s => s.records)
  const loadSampleData = useCraneStore(s => s.loadSampleData)
  const rerunAll = useCraneStore(s => s.rerunAll)
  const resetAll = useCraneStore(s => s.resetAll)

  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-100">
            港口吊机摆动抑制看板
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            传感器日志录入 → 自动校验 → 物理计算 → 阈值判定 → 审计留痕
          </p>
        </div>
        <div className="flex items-center gap-2">
          {records.length === 0 && (
            <button
              onClick={loadSampleData}
              className="harbor-btn text-xs flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              加载样例数据
            </button>
          )}
          {records.length > 0 && (
            <>
              <button
                onClick={rerunAll}
                className="harbor-btn-secondary text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重跑全部
              </button>
              <button
                onClick={resetAll}
                className="harbor-btn-secondary text-xs flex items-center gap-1.5 text-harbor-red hover:text-harbor-red"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清空
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4">
          <SensorInput />
        </div>
        <div className="lg:col-span-8 space-y-4">
          <ThresholdLights />
          <CalcCards />
          <ExceptionTracker />
          <AuditLog />
        </div>
      </div>
    </div>
  )
}

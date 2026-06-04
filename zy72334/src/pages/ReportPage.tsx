import { Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import Scatter3D from '@/components/Scatter3D'
import VarianceChart from '@/components/VarianceChart'
import TracePanel from '@/components/TracePanel'
import type { BoundaryStatus } from '@/types'

const statusStyles: Record<BoundaryStatus, string> = {
  pending_review: 'bg-amber-500/20 text-amber-400',
  reviewed: 'bg-blue-500/20 text-blue-400',
  resolved: 'bg-green-500/20 text-green-400',
}

const statusLabels: Record<BoundaryStatus, string> = {
  pending_review: '待复核',
  reviewed: '已复核',
  resolved: '已解决',
}

export default function ReportPage() {
  const svdResult = useStore(s => s.svdResult)
  const boundaryRecords = useStore(s => s.boundaryRecords)
  const selectAnomaly = useStore(s => s.selectAnomaly)

  const unresolvedRecords = boundaryRecords.filter(r => r.status !== 'resolved')

  if (!svdResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-indigo-950">
        <div className="text-center">
          <p className="mb-4 text-lg text-gray-300">尚未生成降维报告</p>
          <Link
            to="/"
            className="rounded-md bg-indigo-800 px-4 py-2 text-sm text-gray-200 hover:bg-indigo-700"
          >
            去导入数据
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-indigo-950 p-6">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-gray-100">
          奇异值降维报告
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          课堂演示结果 · 点击异常点可溯源
        </p>
      </header>

      <div className="mb-6">
        <Scatter3D />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VarianceChart />

        <div className="rounded-lg border border-indigo-800 bg-indigo-950 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-300">异常概览</h3>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {unresolvedRecords.length === 0 && (
              <p className="text-sm text-gray-500">暂无未解决的异常记录</p>
            )}
            {unresolvedRecords.map(record => (
              <button
                key={record.id}
                onClick={() => selectAnomaly(record.id)}
                className="flex w-full items-center gap-3 rounded-md bg-indigo-900/60 px-3 py-2 text-left text-sm hover:bg-indigo-800"
              >
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
                <span className="text-gray-300">
                  第 {record.rowIndex + 1} 行 · {record.columnName}
                </span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[record.status]}`}
                >
                  {statusLabels[record.status]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <TracePanel />
    </div>
  )
}

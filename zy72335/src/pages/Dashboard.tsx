import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, ClipboardCheck, FileBarChart, AlertTriangle, Clock } from 'lucide-react'
import { useAppStore } from '@/store'
import StepIndicator from '@/components/StepIndicator'
import StatusBadge from '@/components/StatusBadge'

export default function Dashboard() {
  const navigate = useNavigate()
  const { workflowStatus, fetchWorkflowStatus, rawRows, fetchRawRows, calculationDetails, fetchCalculations } = useAppStore()

  useEffect(() => {
    fetchWorkflowStatus()
    fetchRawRows()
    fetchCalculations({ reviewStatus: 'pending' })
  }, [fetchWorkflowStatus, fetchRawRows, fetchCalculations])

  const steps = [
    {
      label: '数据导入',
      completed: workflowStatus?.rawRowImported ?? false,
      active: !(workflowStatus?.rawRowImported ?? false),
    },
    {
      label: '边界复核',
      completed: workflowStatus?.boundaryReviewed ?? false,
      active: (workflowStatus?.rawRowImported ?? false) && !(workflowStatus?.boundaryReviewed ?? false),
    },
    {
      label: '计算更新',
      completed: workflowStatus?.calculationUpdated ?? false,
      active: (workflowStatus?.boundaryReviewed ?? false) && !(workflowStatus?.calculationUpdated ?? false),
    },
  ]

  const flaggedCount = rawRows.filter((r) => r.hasMixedFormat).length
  const pendingCount = calculationDetails.length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-primary">
          模拟退火座位安排复核系统
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          基于模拟退火算法的座位安排数据导入、复核与可视化平台
        </p>
      </div>

      <div className="rounded-lg bg-surface p-6 shadow-sm">
        <h2 className="mb-4 font-heading text-lg font-semibold text-primary">
          工作流进度
        </h2>
        <StepIndicator steps={steps} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="flex items-center gap-4 rounded-lg bg-surface p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
            <FileBarChart size={24} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{rawRows.length}</p>
            <p className="text-xs text-slate-500">原始数据行</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg bg-surface p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50">
            <AlertTriangle size={24} className="text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{flaggedCount}</p>
            <p className="text-xs text-slate-500">混合格式标记</p>
          </div>
          {flaggedCount > 0 && (
            <StatusBadge variant="warning">需关注</StatusBadge>
          )}
        </div>

        <div className="flex items-center gap-4 rounded-lg bg-surface p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-rose-50">
            <Clock size={24} className="text-danger" />
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{pendingCount}</p>
            <p className="text-xs text-slate-500">待复核项</p>
          </div>
          {pendingCount > 0 && (
            <StatusBadge variant="danger">待处理</StatusBadge>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => navigate('/import')}
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-light"
        >
          <Upload size={16} />
          导入数据
        </button>
        <button
          onClick={() => navigate('/review')}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-light"
        >
          <ClipboardCheck size={16} />
          开始复核
        </button>
      </div>
    </div>
  )
}

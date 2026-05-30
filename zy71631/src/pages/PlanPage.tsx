import { useState } from 'react'
import { ArrowLeft, GitCompare, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlanStore } from '@/stores'
import PlanCard from '@/components/plans/PlanCard'
import PlanComparison from '@/components/plans/PlanComparison'
import ReportPreview from '@/components/plans/ReportPreview'

export default function PlanPage() {
  const navigate = useNavigate()
  const plans = usePlanStore((state) => state.plans)
  const comparePlanIds = usePlanStore((state) => state.comparePlanIds)
  const reportPlanId = usePlanStore((state) => state.reportPlanId)
  const setComparePlanIds = usePlanStore((state) => state.setComparePlanIds)
  const setReportPlanId = usePlanStore((state) => state.setReportPlanId)
  const loadPlan = usePlanStore((state) => state.loadPlan)
  const deletePlan = usePlanStore((state) => state.deletePlan)

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id)
      }
      if (prev.length >= 2) {
        return [prev[1], id]
      }
      return [...prev, id]
    })
  }

  const handleCompare = () => {
    if (selectedIds.length === 2) {
      setComparePlanIds([selectedIds[0], selectedIds[1]])
    }
  }

  const handleCloseComparison = () => {
    setComparePlanIds(null)
    setSelectedIds([])
  }

  const handleGenerateReport = (id: string) => {
    setReportPlanId(id)
  }

  const handleCloseReport = () => {
    setReportPlanId(null)
  }

  const handleLoadPlan = (id: string) => {
    loadPlan(id)
    navigate('/')
  }

  const handleDeletePlan = (id: string) => {
    if (confirm('确定要删除此方案吗？')) {
      deletePlan(id)
      setSelectedIds((prev) => prev.filter((i) => i !== id))
    }
  }

  return (
    <div className="h-full bg-theater-dark overflow-auto">
      <div className="sticky top-0 z-10 glass-panel border-b border-theater-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-theater-border rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <h1 className="font-display text-2xl text-white">方案管理</h1>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.length === 2 && (
              <button
                onClick={handleCompare}
                className="flex items-center gap-2 px-4 py-2 bg-theater-accent text-white rounded-lg hover:bg-theater-accent/80 transition-colors"
              >
                <GitCompare className="w-4 h-4" />
                对比方案
              </button>
            )}
            {selectedIds.length > 0 && (
              <span className="text-sm text-gray-400">
                已选择 {selectedIds.length}/2 个方案
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-theater-border/50 rounded-full flex items-center justify-center mb-6">
              <FileText className="w-10 h-10 text-gray-500" />
            </div>
            <h2 className="font-display text-xl text-white mb-2">暂无保存的方案</h2>
            <p className="text-gray-400 mb-6">请到沙盘页面保存您的调音方案</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-theater-accent text-white rounded-lg hover:bg-theater-accent/80 transition-colors"
            >
              返回沙盘
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <div key={plan.id} className="relative group">
                <PlanCard
                  plan={plan}
                  isSelected={selectedIds.includes(plan.id)}
                  onSelect={() => handleSelect(plan.id)}
                  onLoad={() => handleLoadPlan(plan.id)}
                  onDelete={() => handleDeletePlan(plan.id)}
                />
                <button
                  onClick={() => handleGenerateReport(plan.id)}
                  className="absolute bottom-2 right-2 p-1.5 bg-theater-gold/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-theater-gold"
                  title="生成报告"
                >
                  <FileText className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {comparePlanIds && (
        <PlanComparison
          planIds={comparePlanIds}
          onClose={handleCloseComparison}
        />
      )}

      {reportPlanId && (
        <ReportPreview
          planId={reportPlanId}
          onClose={handleCloseReport}
        />
      )}
    </div>
  )
}

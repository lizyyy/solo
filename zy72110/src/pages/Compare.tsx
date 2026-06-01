import HistoryCompare from '@/components/HistoryCompare'
import SupplementForm from '@/components/SupplementForm'
import ReportPreview from '@/components/ReportPreview'
import { GitCompare } from 'lucide-react'

export default function Compare() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] p-4 lg:p-6">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-gray-100 flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-harbor-amber" />
          对比与报告
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          历史参数并排对比 · 备注补录差异说明 · 交接报告导出
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <HistoryCompare />
          <ReportPreview />
        </div>
        <div className="lg:col-span-4">
          <SupplementForm />
        </div>
      </div>
    </div>
  )
}

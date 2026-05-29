import ExportButtons from '@/components/report/ExportButtons'
import ReportPreview from '@/components/report/ReportPreview'

export default function ReportPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <ExportButtons />
      <ReportPreview />
    </div>
  )
}

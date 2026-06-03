import StepNav from '@/components/StepNav'
import ImportPanel from '@/components/ImportPanel'
import BoundaryNotePanel from '@/components/BoundaryNotePanel'
import CalculationTable from '@/components/CalculationTable'
import AuditTimeline from '@/components/AuditTimeline'
import { useVarStore } from '@/store'

export default function Workspace() {
  const { currentStep } = useVarStore()

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary font-sans">回放工作台</h1>
          <p className="text-xs text-text-muted font-sans mt-1">问卷原始行 → 边界值说明 → 计算明细</p>
        </div>
        <StepNav />
      </header>

      {currentStep === 'import' && <ImportPanel />}
      {currentStep === 'boundary' && <BoundaryNotePanel />}
      {currentStep === 'calculation' && (
        <div className="space-y-6">
          <CalculationTable />
          <AuditTimeline />
        </div>
      )}
    </div>
  )
}

import { useParams, useNavigate } from 'react-router-dom'
import { useRenewalStore } from '@/store/useRenewalStore'
import Sidebar from '@/components/layout/Sidebar'
import StepBar from '@/components/business-line/StepBar'
import PolicyCard from '@/components/business-line/PolicyCard'
import ClaimsPanel from '@/components/business-line/ClaimsPanel'
import DiscountPanel from '@/components/business-line/DiscountPanel'
import QuoteTimeline from '@/components/business-line/QuoteTimeline'
import ComparisonPanel from '@/components/business-line/ComparisonPanel'
import NotesPanel from '@/components/business-line/NotesPanel'
import ExceptionBar from '@/components/business-line/ExceptionBar'
import ExportBar from '@/components/business-line/ExportBar'
import { ArrowLeft } from 'lucide-react'

export default function BusinessLineDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tasks, activeStep, setActiveStep, addNote } = useRenewalStore()

  const task = tasks.find((t) => t.id === id)

  if (!task) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-56 p-6 flex items-center justify-center">
          <div className="text-center">
            <p className="text-surface-400 text-sm">未找到该业务线</p>
            <button
              onClick={() => navigate('/')}
              className="mt-3 text-xs text-accent-blue hover:underline"
            >
              返回仪表盘
            </button>
          </div>
        </main>
      </div>
    )
  }

  const hasException = [
    false,
    task.claims.some((c) => !c.isIncluded),
    !task.discount.isCorrect,
    task.quotes.some((q) => q.isOverwritten),
    task.comparison.differences.length > 0,
    false,
  ]

  const handleAddNote = (content: string) => {
    addNote(task.id, content)
  }

  const renderActivePanel = () => {
    switch (activeStep) {
      case 0:
        return <PolicyCard policy={task.policy} />
      case 1:
        return <ClaimsPanel claims={task.claims} />
      case 2:
        return <DiscountPanel discount={task.discount} />
      case 3:
        return <QuoteTimeline quotes={task.quotes} />
      case 4:
        return <ComparisonPanel comparison={task.comparison} />
      case 5:
        return <ExportBar task={task} />
      default:
        return <PolicyCard policy={task.policy} />
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-56 p-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-lg bg-surface-700/50 text-surface-400 flex items-center justify-center hover:text-surface-200 hover:bg-surface-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-surface-100">{task.customerName}</h2>
              <span className="text-xs text-surface-400 font-mono">{task.plateNumber}</span>
            </div>
            <p className="text-[11px] text-surface-400">
              保单号：{task.policyId} · 保险期间：{task.policy.startDate} ~ {task.policy.endDate}
            </p>
          </div>
        </div>

        <div className="mb-5">
          <StepBar
            activeStep={activeStep}
            onStepChange={setActiveStep}
            hasException={hasException}
          />
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-5">
            <div className="animate-fade-in-up" key={activeStep}>
              {renderActivePanel()}
            </div>
          </div>

          <div className="space-y-5">
            {task.exceptionTypes.length > 0 && (
              <ExceptionBar
                taskId={task.id}
                exceptionTypes={task.exceptionTypes}
                onClose={() => {}}
              />
            )}
            <NotesPanel notes={task.notes} onAddNote={handleAddNote} />
          </div>
        </div>
      </main>
    </div>
  )
}

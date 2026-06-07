import { FileText, Eye, FileBarChart, Check } from 'lucide-react'
import { useRecordStore } from '../../store/useRecordStore'

export default function StepProgress() {
  const { currentStep, setCurrentStep } = useRecordStore()

  const steps = [
    { id: 1, label: '导入施工告示', icon: FileText, description: '首次导入施工方提交的绕行方案' },
    { id: 2, label: '补看坡道记录', icon: Eye, description: '核查无障碍坡道专项记录' },
    { id: 3, label: '生成街道摘要', icon: FileBarChart, description: '汇总后提供给街道办审阅' },
  ]

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isActive = currentStep === step.id
        const isCompleted = currentStep > step.id
        const Icon = step.icon

        return (
          <div key={step.id} className="flex items-center flex-1">
            <button
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : isCompleted
                  ? 'bg-green-700 text-white'
                  : 'bg-blue-800 text-blue-300 hover:bg-blue-700'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isActive
                    ? 'bg-white text-blue-900'
                    : isCompleted
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-700 text-blue-300'
                }`}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">第{step.id}步：{step.label}</p>
                <p className={`text-xs ${isActive ? 'text-blue-200' : 'text-blue-400'}`}>
                  {step.description}
                </p>
              </div>
            </button>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-4 rounded ${
                  isCompleted ? 'bg-green-500' : 'bg-blue-700'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

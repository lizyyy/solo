import { StepTimeline } from './components/StepTimeline'
import { RecordCard } from './components/RecordCard'
import { ExceptionTable } from './components/ExceptionTable'
import { RecordDetail } from './components/RecordDetail'
import { ImportModal } from './components/ImportModal'
import { SensorPanel } from './components/SensorPanel'
import { Toast } from './components/Toast'
import { useAppStore } from '@/store/useAppStore'
import { Upload, RotateCcw, User, Terminal, Code2 } from 'lucide-react'

export function App() {
  const {
    records,
    selectedRecordId,
    showImportModal,
    showDetailModal,
    showSensorPanel,
    selectRecord,
    setShowImportModal,
    setShowDetailModal,
    resetDemoData,
    currentOperator
  } = useAppStore()

  const handleSelectRecord = (id: string) => {
    selectRecord(id)
    setShowDetailModal(true)
  }

  return (
    <div className="min-h-screen">
      <header className="bg-industrial-800 border-b border-industrial-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-industrial-100 font-serif">
                桥面热胀伸缩估算
              </h1>
              <p className="text-sm text-industrial-400 mt-1">
                温度校准记录处理系统 · 演示模式
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-industrial-700 rounded-lg">
                <User className="w-4 h-4 text-supplement-400" />
                <span className="text-sm text-industrial-200">{currentOperator}</span>
              </div>
              <div className="flex gap-2">
                <button
                  title="API 接口"
                  className="p-2 bg-industrial-700 hover:bg-industrial-600 rounded-lg transition-colors"
                >
                  <Code2 className="w-5 h-5 text-industrial-400" />
                </button>
                <button
                  title="命令行"
                  className="p-2 bg-industrial-700 hover:bg-industrial-600 rounded-lg transition-colors"
                >
                  <Terminal className="w-5 h-5 text-industrial-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-supplement-600 hover:bg-supplement-500 text-white rounded-lg transition-colors font-medium"
          >
            <Upload className="w-4 h-4" />
            导入温度校准记录
          </button>
          <button
            onClick={resetDemoData}
            className="flex items-center gap-2 px-4 py-2.5 bg-industrial-700 hover:bg-industrial-600 text-industrial-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置演示数据
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <StepTimeline />
          </div>

          <div className="col-span-9 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-industrial-100 mb-4 font-serif flex items-center gap-2">
                温度校准记录
                <span className="text-sm font-normal text-industrial-400">
                  ({records.length} 条)
                </span>
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {records.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    onSelect={handleSelectRecord}
                    isSelected={selectedRecordId === record.id}
                  />
                ))}
              </div>
            </div>

            <ExceptionTable />
          </div>
        </div>

        <div className="mt-8 p-6 bg-industrial-800/50 rounded-lg border border-industrial-700">
          <h3 className="font-bold text-industrial-200 mb-4 font-serif">演示数据说明</h3>
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-success-500" />
                <span className="text-industrial-200 font-medium">REC-001 · 顺利记录</span>
              </div>
              <p className="text-industrial-400">
                方向标记为"负方向"，口径校验直接通过，估算完成。
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-warning-500" />
                <span className="text-industrial-200 font-medium">REC-002 · 向左标记</span>
              </div>
              <p className="text-industrial-400">
                现场师傅写成"向左"，系统不自动归为负方向，标记待复核。何工人工修正后重跑。
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-supplement-500" />
                <span className="text-industrial-200 font-medium">REC-003 · 补录旧口径</span>
              </div>
              <p className="text-industrial-400">
                导入时缺失传感器编号，补录 SNS-BR-003 后自动关联 2020 版旧口径数据。
              </p>
            </div>
          </div>
        </div>
      </main>

      {showImportModal && <ImportModal />}
      {showDetailModal && <RecordDetail />}
      {showSensorPanel && <SensorPanel />}
      <Toast />
    </div>
  )
}

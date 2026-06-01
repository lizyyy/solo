import { useStore } from '@/store'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Database, Play } from 'lucide-react'
import SensorRecordPanel from '@/components/SensorRecordPanel'
import EquipmentParamPanel from '@/components/EquipmentParamPanel'
import FieldNotePanel from '@/components/FieldNotePanel'
import CorrectionPanel from '@/components/CorrectionPanel'

export default function InputPage() {
  const batches = useStore((s) => s.batches)
  const currentBatchId = useStore((s) => s.currentBatchId)
  const createBatch = useStore((s) => s.createBatch)
  const deleteBatch = useStore((s) => s.deleteBatch)
  const setCurrentBatch = useStore((s) => s.setCurrentBatch)
  const loadSampleData = useStore((s) => s.loadSampleData)
  const runCalc = useStore((s) => s.runCalculation)
  const navigate = useNavigate()

  const handleCreate = () => {
    createBatch('操作员')
  }

  const handleLoadSample = () => {
    const id = loadSampleData()
    runCalc(id)
  }

  const handleRun = () => {
    if (currentBatchId) {
      runCalc(currentBatchId)
      navigate('/dashboard')
    }
  }

  return (
    <div className="flex gap-4">
      <div className="w-56 shrink-0 space-y-3">
        <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60 p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#a8d8ea]/70 font-medium">计算批次</span>
            <button
              onClick={handleCreate}
              className="text-[#16c79a] hover:text-[#16c79a]/80 transition-colors"
              title="新建批次"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {batches.map((b) => (
              <div
                key={b.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors text-xs ${
                  b.id === currentBatchId
                    ? 'bg-[#0f3460] text-[#a8d8ea]'
                    : 'text-[#a8d8ea]/60 hover:bg-[#0f3460]/30'
                }`}
                onClick={() => setCurrentBatch(b.id)}
              >
                <div className="truncate flex-1">
                  <div className="font-medium truncate">{b.operatorName || '未命名'} - {b.source}</div>
                  <div className="text-[10px] text-[#a8d8ea]/40">{new Date(b.createTime).toLocaleDateString('zh-CN')}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteBatch(b.id) }}
                  className="text-[#e94560]/40 hover:text-[#e94560] ml-1"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {batches.length === 0 && (
              <p className="text-[11px] text-[#a8d8ea]/40 text-center py-2">暂无批次</p>
            )}
          </div>
        </div>
        <button
          onClick={handleLoadSample}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#0f3460]/50 text-[#a8d8ea] text-xs hover:bg-[#0f3460]/70 transition-colors"
        >
          <Database size={12} /> 加载样例数据
        </button>
        {currentBatchId && (
          <button
            onClick={handleRun}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#16c79a]/20 text-[#16c79a] text-xs font-medium hover:bg-[#16c79a]/30 transition-colors"
          >
            <Play size={12} /> 执行计算并查看结果
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4">
        {currentBatchId ? (
          <>
            <SensorRecordPanel />
            <EquipmentParamPanel />
            <FieldNotePanel />
            <CorrectionPanel />
          </>
        ) : (
          <div className="flex items-center justify-center h-96 text-[#a8d8ea]/40">
            <div className="text-center">
              <Database size={48} className="mx-auto mb-3 opacity-30" />
              <p>请新建或选择一个计算批次</p>
              <p className="text-xs mt-1">也可以点击"加载样例数据"快速体验</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

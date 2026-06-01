import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Play, RefreshCw, Trash2 } from "lucide-react"
import { useRecordStore } from "@/stores/recordStore"
import RecordCard from "@/components/RecordCard"
import SupplementForm from "@/components/SupplementForm"
import { useTrainingStore } from "@/stores/trainingStore"

export default function History() {
  const navigate = useNavigate()
  const { records, addSupplement, loadSampleRecords, clearAllRecords } = useRecordStore()
  const { resetTraining } = useTrainingStore()

  const [supplementingId, setSupplementingId] = useState<string | null>(null)

  const handleStartTraining = () => {
    resetTraining()
    navigate("/training")
  }

  const handleSupplementSubmit = (
    recordId: string,
    data: {
      content: string
      source: "老师备注" | "投影补录"
      adjustScore?: { from: number; to: number }
    }
  ) => {
    addSupplement(recordId, data)
    setSupplementingId(null)
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">训练记录</h1>
          <p className="text-slate-400">
            共 {records.length} 条记录 · 点击查看每局的完整选择链路
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (confirm("确定要重置为样例数据吗？现有记录会被覆盖。")) {
                loadSampleRecords()
              }
            }}
            className="btn btn-outline text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            重置为样例
          </button>
          <button
            onClick={() => {
              if (confirm("确定要清空所有记录吗？此操作不可恢复。")) {
                clearAllRecords()
              }
            }}
            className="btn btn-danger text-sm"
          >
            <Trash2 className="w-4 h-4" />
            清空
          </button>
          <button onClick={handleStartTraining} className="btn btn-primary text-sm">
            <Play className="w-4 h-4" />
            开始新训练
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-xl font-bold mb-2">还没有训练记录</h3>
          <p className="text-slate-400 mb-6">
            点击上方"开始新训练"，完成一局后这里就会有记录啦。
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={handleStartTraining} className="btn btn-primary">
              <Play className="w-4 h-4" />
              开始第一局
            </button>
            <button onClick={loadSampleRecords} className="btn btn-outline">
              <RefreshCw className="w-4 h-4" />
              加载样例数据
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div key={record.id}>
              <RecordCard
                record={record}
                onSupplement={() =>
                  setSupplementingId(
                    supplementingId === record.id ? null : record.id
                  )
                }
                showSupplementForm={supplementingId === record.id}
              />
              {supplementingId === record.id && (
                <SupplementForm
                  onSubmit={(data) => handleSupplementSubmit(record.id, data)}
                  onCancel={() => setSupplementingId(null)}
                  currentScore={record.totalScore}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card p-6 border border-slate-700/50 bg-slate-800/30">
        <h3 className="font-bold mb-3">💡 关于补录</h3>
        <p className="text-sm text-slate-400 mb-3">
          老师小林会先跑一小包材料，再临时补一条备注。补录时可以：
        </p>
        <ul className="text-sm text-slate-300 space-y-2">
          <li>• 选择备注来源："老师备注"或"投影补录"（旧口径）</li>
          <li>• 填写备注内容，说明为什么要调整</li>
          <li>• 可选：同时调整分数，系统会自动重新计算通过状态</li>
          <li>• 补录后会在记录卡片和详情页显示差异，报告与明细数字保持一致</li>
        </ul>
      </div>
    </div>
  )
}

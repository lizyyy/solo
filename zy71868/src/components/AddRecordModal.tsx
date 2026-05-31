import { useState } from "react"
import { X } from "lucide-react"
import { useGradingStore } from "@/store/gradingStore"
import type { Source, ChangeType } from "@/types"
import { SOURCE_LABELS } from "@/types"

interface AddRecordModalProps {
  open: boolean
  onClose: () => void
}

export function AddRecordModal({ open, onClose }: AddRecordModalProps) {
  const addRecord = useGradingStore((s) => s.addRecord)
  const currentUser = useGradingStore((s) => s.currentUser)

  const [questionNo, setQuestionNo] = useState("")
  const [description, setDescription] = useState("")
  const [source, setSource] = useState<Source>("difficulty_label")
  const [changeType, setChangeType] = useState<ChangeType>("supplementary")
  const [difficulty, setDifficulty] = useState("中等")
  const [originalAnswer, setOriginalAnswer] = useState("")
  const [standardAnswer, setStandardAnswer] = useState("")
  const [equivalentAnswerIssue, setEquivalentAnswerIssue] = useState(false)
  const [equivalentAnswers, setEquivalentAnswers] = useState("")
  const [pendingReason, setPendingReason] = useState("")

  if (!open) return null

  const handleSubmit = () => {
    if (!questionNo.trim() || !description.trim()) return

    addRecord({
      questionNo: questionNo.trim(),
      description: description.trim(),
      source,
      changeType,
      difficulty,
      originalAnswer: originalAnswer.trim(),
      standardAnswer: standardAnswer.trim(),
      equivalentAnswerIssue,
      equivalentAnswers: equivalentAnswerIssue
        ? equivalentAnswers
            .split(/[,，、]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      pendingReason: pendingReason.trim(),
      reviewConclusion: "",
      status: "pending",
      createdBy: currentUser.name,
    })

    setQuestionNo("")
    setDescription("")
    setSource("difficulty_label")
    setChangeType("supplementary")
    setDifficulty("中等")
    setOriginalAnswer("")
    setStandardAnswer("")
    setEquivalentAnswerIssue(false)
    setEquivalentAnswers("")
    setPendingReason("")
    onClose()
  }

  const inputClass =
    "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-navy-400 focus:ring-1 focus:ring-navy-200"
  const labelClass = "block text-xs font-medium text-slate-500 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="font-serif text-base font-semibold text-navy-800">
            新增批改记录
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>题号 *</label>
              <input
                className={inputClass}
                value={questionNo}
                onChange={(e) => setQuestionNo(e.target.value)}
                placeholder="如 3"
              />
            </div>
            <div>
              <label className={labelClass}>难度</label>
              <select
                className={inputClass}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option>简单</option>
                <option>中等</option>
                <option>较难</option>
                <option>困难</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>描述 *</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="集合关系批改问题描述"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>来源</label>
              <select
                className={inputClass}
                value={source}
                onChange={(e) => setSource(e.target.value as Source)}
              >
                {(Object.entries(SOURCE_LABELS) as [Source, string][]).map(
                  ([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className={labelClass}>变更类型</label>
              <select
                className={inputClass}
                value={changeType}
                onChange={(e) => setChangeType(e.target.value as ChangeType)}
              >
                <option value="supplementary">补材料</option>
                <option value="conclusion_change">改结论</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>原始答案</label>
              <input
                className={inputClass}
                value={originalAnswer}
                onChange={(e) => setOriginalAnswer(e.target.value)}
                placeholder="学生给出的答案"
              />
            </div>
            <div>
              <label className={labelClass}>标准答案</label>
              <input
                className={inputClass}
                value={standardAnswer}
                onChange={(e) => setStandardAnswer(e.target.value)}
                placeholder="正确答案"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="equiv"
              checked={equivalentAnswerIssue}
              onChange={(e) => setEquivalentAnswerIssue(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            <label htmlFor="equiv" className="text-sm text-slate-600">
              涉及等价答案误判
            </label>
          </div>

          {equivalentAnswerIssue && (
            <div>
              <label className={labelClass}>等价答案（逗号分隔）</label>
              <input
                className={inputClass}
                value={equivalentAnswers}
                onChange={(e) => setEquivalentAnswers(e.target.value)}
                placeholder="A∩B=B, B⊆A"
              />
            </div>
          )}

          <div>
            <label className={labelClass}>待处理原因（可选）</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={pendingReason}
              onChange={(e) => setPendingReason(e.target.value)}
              placeholder="为什么这条记录需要处理"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!questionNo.trim() || !description.trim()}
            className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            提交
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState } from "react"
import { Save } from "lucide-react"

interface SupplementFormProps {
  onSubmit: (data: {
    content: string
    source: "老师备注" | "投影补录"
    adjustScore?: { from: number; to: number }
  }) => void
  onCancel: () => void
  currentScore: number
}

export default function SupplementForm({
  onSubmit,
  onCancel,
  currentScore,
}: SupplementFormProps) {
  const [content, setContent] = useState("")
  const [source, setSource] = useState<"老师备注" | "投影补录">("老师备注")
  const [adjustScore, setAdjustScore] = useState(false)
  const [newScore, setNewScore] = useState(currentScore.toString())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    const data: Parameters<typeof onSubmit>[0] = {
      content,
      source,
    }

    if (adjustScore && Number(newScore) !== currentScore) {
      data.adjustScore = {
        from: currentScore,
        to: Number(newScore),
      }
    }

    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 border-2 border-brand-400/50 mt-4 animate-fade-in">
      <h4 className="font-bold mb-4 text-brand-300">补录备注</h4>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">备注来源</label>
          <div className="flex gap-2">
            {(["老师备注", "投影补录"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  source === s
                    ? "bg-brand-400 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">
            备注内容 <span className="text-danger">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="比如：客户实际诉求是退货不是换货，之前判错了..."
            className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-400 transition-colors"
            rows={3}
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={adjustScore}
              onChange={(e) => setAdjustScore(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-brand-400 focus:ring-brand-400"
            />
            <span className="text-sm text-slate-300">
              同时调整分数（当前 {currentScore} 分）
            </span>
          </label>

          {adjustScore && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-slate-400">新分数：</span>
              <input
                type="number"
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                min={0}
                max={100}
                className="w-24 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-brand-400"
              />
              <span className="text-sm text-warning">
                {currentScore} → {newScore}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={!content.trim()}
            className="btn btn-primary flex-1"
          >
            <Save className="w-4 h-4" />
            保存补录
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-outline"
          >
            取消
          </button>
        </div>
      </div>
    </form>
  )
}

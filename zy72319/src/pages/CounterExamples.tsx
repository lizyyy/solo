import { useState } from "react"
import { Upload } from "lucide-react"
import useAppStore from "@/store/useAppStore"
import CounterExampleTable from "@/components/CounterExampleTable"
import QuestionnairePanel from "@/components/QuestionnairePanel"
import ConflictModal from "@/components/ConflictModal"
import type { CounterExample, MaterialSource } from "@/types"

export default function CounterExamples() {
  const [selectedCeId, setSelectedCeId] = useState<string | null>(null)
  const [conflictModalCeId, setConflictModalCeId] = useState<string | null>(null)
  const [importText, setImportText] = useState("")
  const importCounterExamples = useAppStore((s) => s.importCounterExamples)
  const addToast = useAppStore((s) => s.addToast)

  const handleImport = () => {
    const lines = importText.trim().split("\n").filter((l) => l.trim())
    if (lines.length === 0) {
      addToast("warning", "请输入反例数据")
      return
    }
    const items: CounterExample[] = lines.map((line, idx) => {
      const parts = line.split(",").map((s) => s.trim())
      const originalValue = parseFloat(parts[0]) || 0
      const threshold = parseFloat(parts[1]) || 0
      const deviation = originalValue - threshold
      const now = new Date().toISOString()
      return {
        id: `ce-import-${Date.now()}-${idx}`,
        source: "normal" as MaterialSource,
        originalValue,
        threshold,
        deviation,
        status: "normal" as const,
        questionnaireRowId: null,
        conflictResolution: null,
        createdAt: now,
        updatedAt: now,
      }
    })
    importCounterExamples(items, "normal")
    addToast("success", `已导入 ${items.length} 条反例`)
    setImportText("")
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-xl font-bold text-[#e0e0f0] mb-6">反例管理</h2>
      <div className="flex gap-6">
        <div className="flex-1">
          <CounterExampleTable
            onSelectId={setSelectedCeId}
            onConflictClick={setConflictModalCeId}
          />
          <div className="mt-6 bg-[#16163a] border border-[#2a2a4a] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#e0e0f0] mb-3">导入手算反例</h3>
            <p className="text-xs text-[#8888aa] mb-3">每行一条，格式：原始值,阈值（如 0.5,1.0）</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={4}
              className="w-full bg-[#0d0d1f] border border-[#2a2a4a] text-[#e0e0f0] text-xs rounded-lg px-3 py-2 font-mono resize-none focus:border-[#0ff0b3] outline-none"
              placeholder="0.5,1.0&#10;1.2,1.2&#10;0.3,0.8"
            />
            <button
              onClick={handleImport}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0ff0b3] text-[#0d0d1f] text-sm font-semibold hover:shadow-[0_0_15px_rgba(15,240,179,0.4)] transition-all"
            >
              <Upload size={14} /> 导入
            </button>
          </div>
        </div>
        <QuestionnairePanel ceId={selectedCeId} onClose={() => setSelectedCeId(null)} />
      </div>
      <ConflictModal isOpen={conflictModalCeId !== null} ceId={conflictModalCeId} onClose={() => setConflictModalCeId(null)} />
    </div>
  )
}

import { useState } from "react"
import useAppStore from "@/store/useAppStore"
import RunModeTabs from "@/components/RunModeTabs"
import RunHistory from "@/components/RunHistory"
import type { MaterialSource } from "@/types"

const modeLabels: Record<MaterialSource, string> = {
  normal: "正常材料",
  mismatch: "错口径材料",
  supplementary: "补录材料",
}

export default function Runs() {
  const [activeMode, setActiveMode] = useState<MaterialSource>("normal")
  const runMaterial = useAppStore((s) => s.runMaterial)
  const addToast = useAppStore((s) => s.addToast)

  const handleRun = (mode: MaterialSource) => {
    runMaterial(mode)
    addToast("success", `${modeLabels[mode]}运行完成`)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-[#e0e0f0]">材料运行</h2>
      <RunModeTabs activeMode={activeMode} onChange={setActiveMode} onRun={handleRun} />
      <RunHistory />
    </div>
  )
}

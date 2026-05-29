import { useEffect, useRef } from "react"
import { useExperimentStore } from "@/store/useExperimentStore"
import ParamPanel from "@/components/ParamPanel"
import TrackCanvas from "@/components/TrackCanvas"
import StabilityPanel from "@/components/StabilityPanel"
import AnomalyCard from "@/components/AnomalyCard"
import ScreenshotBtn from "@/components/ScreenshotBtn"
import { Link } from "react-router-dom"
import { Database, Play, RotateCcw } from "lucide-react"

export default function ExperimentConsole() {
  const currentResult = useExperimentStore((s) => s.currentResult)
  const updateResult = useExperimentStore((s) => s.updateResult)
  const addRecord = useExperimentStore((s) => s.addRecord)
  const params = useExperimentStore((s) => s.params)
  const manualNote = useExperimentStore((s) => s.manualNote)
  const setManualNote = useExperimentStore((s) => s.setManualNote)
  const canvasAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    updateResult()
  }, [])

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      <header className="border-b border-[#1A3A5C] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00E5CC] to-[#0088AA] flex items-center justify-center text-[#0A1628] font-bold text-sm">
            M
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider" style={{ fontFamily: "Orbitron, monospace" }}>
              MAGLEV STABILITY
            </h1>
            <p className="text-[10px] text-[#556677]">磁悬浮轨道稳定实验平台</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ScreenshotBtn targetRef={canvasAreaRef} />
          <Link
            to="/data"
            className="flex items-center gap-2 px-4 py-2 bg-[#0D1F3C] border border-[#1A3A5C] rounded-lg
              text-[#8899AA] text-xs font-medium hover:text-[#00E5CC] hover:border-[#00E5CC]/30 transition-all"
          >
            <Database size={14} />
            数据管理
          </Link>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        <aside className="w-72 border-r border-[#1A3A5C] p-4 overflow-y-auto space-y-4 flex-shrink-0">
          <ParamPanel />

          <div className="space-y-2">
            <label className="text-xs text-[#8899AA]">手工备注</label>
            <textarea
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="输入实验备注..."
              className="w-full h-20 bg-[#0A1628] border border-[#1A3A5C] rounded-lg px-3 py-2 text-xs text-white
                placeholder-[#445566] outline-none focus:border-[#00E5CC]/50 resize-none transition-colors"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => addRecord(manualNote)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#00E5CC]/20 border border-[#00E5CC]/40
                rounded-lg text-[#00E5CC] text-xs font-bold hover:bg-[#00E5CC]/30 transition-all"
            >
              <Play size={14} />
              记录结果
            </button>
            <button
              onClick={() => {
                useExperimentStore.setState({
                  params: { magnetSpacing: 10, vehicleMass: 50, trackLength: 500, current: 5, disturbance: 2 },
                })
                updateResult()
              }}
              className="px-3 py-2.5 bg-[#0A1628] border border-[#1A3A5C] rounded-lg text-[#8899AA] hover:text-[#00E5CC] hover:border-[#00E5CC]/30 transition-all"
              title="重置参数"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <div ref={canvasAreaRef} className="flex-1 p-4">
            <TrackCanvas params={params} result={currentResult} />
          </div>

          <div className="border-t border-[#1A3A5C] p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StabilityPanel result={currentResult} />
              <AnomalyCard result={currentResult} />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

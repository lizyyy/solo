import { Link as RouterLink } from "react-router-dom"
import { History, Layers, Info } from "lucide-react"
import StageScene from "@/components/stage/StageScene"
import SidePanel from "@/components/panel/SidePanel"
import { useStore } from "@/store/useStore"

export default function StagePage() {
  const scene = useStore((s) => s.scene)
  const collisions = useStore((s) => s.scene.collisions)

  const unresolvedCritical = collisions.filter(
    (c) => !c.resolved && c.severity === "critical",
  ).length
  const unresolvedWarning = collisions.filter(
    (c) => !c.resolved && c.severity === "warning",
  ).length

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f0f1a] text-white overflow-hidden">
      <header className="h-12 bg-[#1a1a2e] border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="text-red-500" size={18} />
            <h1 className="font-bold text-sm tracking-wide">舞台灯光碰撞预演</h1>
            <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">
              PREVIEW
            </span>
          </div>
          <div className="h-4 w-px bg-gray-700" />
          <div className="text-xs text-gray-400">
            <span className="text-gray-500">场景:</span> {scene.name}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-gray-400">
                严重 <span className="text-red-400 font-bold">{unresolvedCritical}</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-gray-400">
                警告 <span className="text-yellow-400 font-bold">{unresolvedWarning}</span>
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-gray-700" />

          <div className="flex items-center gap-2">
            <RouterLink
              to="/review"
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
            >
              <History size={14} />
              复盘回看
            </RouterLink>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative">
          <StageScene />
          <div className="absolute bottom-4 left-4 bg-[#1a1a2e]/80 backdrop-blur-sm border border-gray-800 rounded px-3 py-2 text-xs text-gray-400 space-y-1">
            <div className="flex items-center gap-2">
              <Info size={12} className="text-blue-400" />
              <span>操作提示</span>
            </div>
            <div className="text-[10px] space-y-0.5">
              <div>• 左键拖拽灯具：移动位置</div>
              <div>• 右键拖动：旋转视角</div>
              <div>• 滚轮：缩放</div>
              <div>• 点击元素：查看属性</div>
            </div>
          </div>

          <div className="absolute top-4 left-4 flex gap-2">
            <div className="bg-[#1a1a2e]/80 backdrop-blur-sm border border-gray-800 rounded px-3 py-1.5 text-xs flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#4a4a5a" }} />
              <span className="text-gray-400">灯杆</span>
            </div>
            <div className="bg-[#1a1a2e]/80 backdrop-blur-sm border border-gray-800 rounded px-3 py-1.5 text-xs flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: "#666680" }} />
              <span className="text-gray-400">吊点</span>
            </div>
            <div className="bg-[#1a1a2e]/80 backdrop-blur-sm border border-gray-800 rounded px-3 py-1.5 text-xs flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#d4af37" }} />
              <span className="text-gray-400">灯具</span>
            </div>
            <div className="bg-[#1a1a2e]/80 backdrop-blur-sm border border-gray-800 rounded px-3 py-1.5 text-xs flex items-center gap-2">
              <div className="w-3 h-0.5" style={{ backgroundColor: "#44ff44" }} />
              <span className="text-gray-400">动线</span>
            </div>
            <div className="bg-[#1a1a2e]/80 backdrop-blur-sm border border-gray-800 rounded px-3 py-1.5 text-xs flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-red-500/30 border border-red-500" />
              <span className="text-gray-400">碰撞</span>
            </div>
          </div>
        </main>
        <SidePanel />
      </div>
    </div>
  )
}

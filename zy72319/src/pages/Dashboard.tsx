import { Link } from "react-router-dom"
import { FileSearch, Play, ShieldCheck, Database, Trash2 } from "lucide-react"
import useAppStore from "@/store/useAppStore"
import GradientCanvas from "@/components/GradientCanvas"
import StatusCards from "@/components/StatusCards"

export default function Dashboard() {
  const loadSampleData = useAppStore((s) => s.loadSampleData)
  const clearAllData = useAppStore((s) => s.clearAllData)
  const addToast = useAppStore((s) => s.addToast)
  const counterExamples = useAppStore((s) => s.counterExamples)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-[#e0e0f0]">主控台</h2>
      <GradientCanvas />
      <StatusCards />
      <div className="grid grid-cols-3 gap-4">
        <Link to="/counter-examples" className="bg-[#16163a] border border-[#2a2a4a] rounded-xl px-5 py-4 flex items-center gap-3 hover:shadow-[0_0_15px_rgba(15,240,179,0.15)] transition-all group">
          <FileSearch size={20} className="text-[#0ff0b3]" />
          <div>
            <div className="text-sm font-semibold text-[#e0e0f0] group-hover:text-[#0ff0b3]">反例管理</div>
            <div className="text-xs text-[#8888aa]">比对 · 冲突处理 · 复核</div>
          </div>
        </Link>
        <Link to="/runs" className="bg-[#16163a] border border-[#2a2a4a] rounded-xl px-5 py-4 flex items-center gap-3 hover:shadow-[0_0_15px_rgba(15,240,179,0.15)] transition-all group">
          <Play size={20} className="text-[#0ff0b3]" />
          <div>
            <div className="text-sm font-semibold text-[#e0e0f0] group-hover:text-[#0ff0b3]">材料运行</div>
            <div className="text-xs text-[#8888aa]">正常 · 错口径 · 补录</div>
          </div>
        </Link>
        <Link to="/checks" className="bg-[#16163a] border border-[#2a2a4a] rounded-xl px-5 py-4 flex items-center gap-3 hover:shadow-[0_0_15px_rgba(15,240,179,0.15)] transition-all group">
          <ShieldCheck size={20} className="text-[#0ff0b3]" />
          <div>
            <div className="text-sm font-semibold text-[#e0e0f0] group-hover:text-[#0ff0b3]">自检与导出</div>
            <div className="text-xs text-[#8888aa]">自检 · 报告 · 下载</div>
          </div>
        </Link>
      </div>
      {counterExamples.length === 0 && (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => { loadSampleData(); addToast("success", "样例数据已加载") }}
            className="flex items-center gap-2 text-xs text-[#0ff0b3] hover:underline"
          >
            <Database size={14} /> 加载样例数据
          </button>
          <span className="text-xs text-[#555577]">|</span>
          <button
            onClick={() => { clearAllData(); addToast("info", "所有数据已清除") }}
            className="flex items-center gap-2 text-xs text-[#ff4444] hover:underline"
          >
            <Trash2 size={14} /> 清除所有数据
          </button>
        </div>
      )}
    </div>
  )
}

import { useEffect } from "react"
import ParameterPanel from "@/components/ParameterPanel"
import Scene3D from "@/components/Scene3D"
import DetailTable from "@/components/DetailTable"
import ReportPreview from "@/components/ReportPreview"
import FilterBar from "@/components/FilterBar"
import ImportPanel from "@/components/ImportPanel"
import ConflictPanel from "@/components/ConflictPanel"
import SchemeManager from "@/components/SchemeManager"
import { useUIStore } from "@/store/useUIStore"
import { useSchemeStore } from "@/store/useSchemeStore"
import { FileText, Upload, FolderOpen, RotateCcw, LayoutGrid } from "lucide-react"

export default function Workspace() {
  const { reportOpen, importModalOpen, schemeModalOpen, activeTab, setActiveTab, toggleReport, setImportModalOpen, setSchemeModalOpen } = useUIStore()
  const { loadSample, loadFromLocalStorage } = useSchemeStore()

  useEffect(() => {
    loadFromLocalStorage()
  }, [loadFromLocalStorage])

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-200 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-amber-500 flex items-center justify-center">
            <span className="text-slate-900 font-bold text-xs">PV</span>
          </div>
          <h1 className="text-sm font-semibold text-slate-100">光伏园区阴影模型</h1>
          <span className="text-xs text-slate-500">v1.0</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSample}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded transition-colors"
          >
            <RotateCcw size={13} />
            重置样例
          </button>
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded transition-colors"
          >
            <Upload size={13} />
            导入数据
          </button>
          <button
            onClick={() => setSchemeModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded transition-colors"
          >
            <FolderOpen size={13} />
            方案管理
          </button>
          <button
            onClick={toggleReport}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
              reportOpen ? "bg-amber-500/20 text-amber-400" : "text-slate-400 hover:text-amber-400 hover:bg-slate-700"
            }`}
          >
            <FileText size={13} />
            报告
          </button>
        </div>
      </header>

      <FilterBar />

      <div className="flex-1 flex overflow-hidden">
        <ParameterPanel />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/50 border-b border-slate-700 shrink-0">
            <button
              onClick={() => setActiveTab("scene")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors ${
                activeTab === "scene" ? "bg-amber-500/20 text-amber-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              <LayoutGrid size={13} />
              3D场景
            </button>
            <button
              onClick={() => setActiveTab("table")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors ${
                activeTab === "table" ? "bg-amber-500/20 text-amber-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              }`}
            >
              <LayoutGrid size={13} />
              明细表
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === "scene" ? <Scene3D /> : <DetailTable />}
          </div>
        </div>

        {reportOpen && <ReportPreview />}
      </div>

      {importModalOpen && <ImportPanel />}
      {schemeModalOpen && <SchemeManager />}
      <ConflictPanel />
    </div>
  )
}

import { useState, useRef } from "react"
import { Upload, Download, History, AlertTriangle, Settings, ChevronLeft, ChevronRight, RotateCcw, FileJson, Eye } from "lucide-react"
import { useStore } from "@/store/useStore"
import { importScene, exportScene } from "@/utils/importExport"
import PropertyEditor from "./PropertyEditor"
import CollisionReport from "./CollisionReport"
import AuditLogPanel from "./AuditLogPanel"

export default function SidePanel() {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)
  const panelTab = useStore((s) => s.panelTab)
  const setPanelTab = useStore((s) => s.setPanelTab)
  const scene = useStore((s) => s.scene)
  const loadScene = useStore((s) => s.loadScene)
  const runCollisionDetection = useStore((s) => s.runCollisionDetection)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showSourceInfo, setShowSourceInfo] = useState(false)

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const imported = await importScene(file)
      loadScene(imported)
      alert("场景导入成功")
    } catch (err) {
      alert(`导入失败: ${err instanceof Error ? err.message : "未知错误"}`)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleExport = () => {
    exportScene(scene)
  }

  const tabs = [
    { id: "collisions" as const, label: "碰撞检测", icon: AlertTriangle, badge: scene.collisions.filter((c) => !c.resolved).length },
    { id: "properties" as const, label: "属性编辑", icon: Settings, badge: null },
    { id: "audit" as const, label: "审计日志", icon: History, badge: scene.auditLogs.length },
  ]

  return (
    <div
      className={`relative h-full flex transition-all duration-300 ${
        sidebarOpen ? "w-[420px]" : "w-12"
      }`}
    >
      <div
        className={`h-full bg-[#252538] border-l border-gray-700 flex flex-col ${
          sidebarOpen ? "opacity-100 w-full" : "opacity-0 w-0 overflow-hidden"
        } transition-opacity duration-200`}
      >
        <div className="p-3 border-b border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-sm">{scene.name}</h2>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Eye size={10} />
                舞台灯光碰撞预演 · v{scene.version}
              </div>
            </div>
            <button
              onClick={() => setShowSourceInfo(!showSourceInfo)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              场景信息
            </button>
          </div>

          {showSourceInfo && (
            <div className="p-2 bg-gray-800 rounded text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">场景来源</span>
                <span className="font-mono text-blue-400">{scene.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">创建时间</span>
                <span className="text-gray-300">{new Date(scene.createdAt).toLocaleDateString("zh-CN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">更新时间</span>
                <span className="text-gray-300">{new Date(scene.updatedAt).toLocaleDateString("zh-CN")}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleImportClick}
              className="flex-1 flex items-center justify-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 rounded transition-colors"
            >
              <Upload size={14} />
              导入
            </button>
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 rounded transition-colors"
            >
              <Download size={14} />
              导出
            </button>
            <button
              onClick={runCollisionDetection}
              className="flex items-center justify-center gap-1 text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-2 rounded transition-colors"
              title="重新检测碰撞"
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="flex border-b border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPanelTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs transition-colors relative ${
                panelTab === tab.id
                  ? "text-white border-b-2 border-red-600 bg-gray-800/50"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span
                  className={`absolute top-1 right-2 min-w-[16px] h-4 rounded-full text-[10px] flex items-center justify-center ${
                    tab.id === "collisions" ? "bg-red-600 text-white" : "bg-gray-600 text-gray-200"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {panelTab === "collisions" && <CollisionReport />}
          {panelTab === "properties" && <PropertyEditor />}
          {panelTab === "audit" && <AuditLogPanel />}
        </div>

        <div className="p-2 border-t border-gray-700 bg-gray-900/50 text-center">
          <div className="text-[10px] text-gray-500 flex items-center justify-center gap-1">
            <FileJson size={10} />
            导入/处理/回看/导出使用同一套3D舞台数据口径
          </div>
        </div>
      </div>

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-16 bg-[#252538] border-l border-t border-b border-gray-700 rounded-l-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors z-10"
        title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
      >
        {sidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  )
}

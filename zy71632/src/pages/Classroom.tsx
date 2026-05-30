import { useEffect, useState } from 'react'
import { Snowflake, PanelRightClose, PanelRight } from 'lucide-react'
import Scene3D from '@/components/Scene3D'
import ViewSwitcher from '@/components/ViewSwitcher'
import ControlPanel from '@/components/ControlPanel'
import NotesPanel from '@/components/NotesPanel'
import AnomalyToast from '@/components/AnomalyToast'
import { useClassroomStore } from '@/store'

export default function Classroom() {
  const { isLoaded, loadFromStorage, project } = useClassroomStore()
  const [showPanel, setShowPanel] = useState(true)
  const [panelTab, setPanelTab] = useState<'control' | 'notes'>('control')

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  if (!isLoaded) {
    return (
      <div className="w-full h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Snowflake size={48} className="text-[#4fc3f7] animate-pulse" />
          <p className="text-white/40 text-sm">正在加载课堂数据...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen bg-[#0a0e1a] flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#0a0e1a]/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <Snowflake size={22} className="text-[#4fc3f7]" />
          <div>
            <h1 className="text-white text-sm font-semibold tracking-wide" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              向量场滑雪课堂
            </h1>
            <p className="text-white/25 text-[10px]">
              z = {project.surface.expression}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ViewSwitcher />
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            {showPanel ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 relative">
          <Scene3D />
          <AnomalyToast />

          {project.viewState.activeView === 'path' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#0d1225]/80 backdrop-blur-md rounded-xl border border-white/5 px-4 py-2 text-white/50 text-xs">
              点击曲面上任意位置设定滑雪起点
            </div>
          )}

          {project.viewState.activeView === 'params' && (
            <div className="absolute inset-0 bg-[#0a0e1a]/80 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-[#0d1225]/90 backdrop-blur-md rounded-2xl border border-white/5 p-8 max-w-lg w-full mx-4">
                <h2 className="text-[#4fc3f7] text-lg font-semibold mb-6" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                  参数总览
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-white/30 text-xs">曲面函数</p>
                    <p className="text-white/80 font-mono text-xs">{project.surface.expression}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/30 text-xs">网格密度</p>
                    <p className="text-white/80 text-xs">{project.surface.resolution}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/30 text-xs">X 范围</p>
                    <p className="text-white/80 text-xs">[{project.surface.xRange[0]}, {project.surface.xRange[1]}]</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/30 text-xs">Y 范围</p>
                    <p className="text-white/80 text-xs">[{project.surface.yRange[0]}, {project.surface.yRange[1]}]</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/30 text-xs">箭头缩放</p>
                    <p className="text-white/80 text-xs">{project.vectorField.arrowScale}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/30 text-xs">箭头密度</p>
                    <p className="text-white/80 text-xs">{project.vectorField.density}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/30 text-xs">路径数</p>
                    <p className="text-white/80 text-xs">{project.paths.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/30 text-xs">异常数</p>
                    <p className="text-white/80 text-xs">{project.anomalyLog.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/30 text-xs">学生备注</p>
                    <p className="text-white/80 text-xs">{project.notes.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/30 text-xs">教师批注</p>
                    <p className="text-white/80 text-xs">{project.teacherAnnotations.length}</p>
                  </div>
                </div>
                <div className="mt-6 space-y-1">
                  <p className="text-white/30 text-xs">相机位置</p>
                  <p className="text-white/60 font-mono text-xs">
                    ({project.viewState.cameraPosition.map(v => v.toFixed(1)).join(', ')})
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {showPanel && (
          <div className="w-80 border-l border-white/5 bg-[#0a0e1a]/95 backdrop-blur-md flex flex-col overflow-hidden">
            <div className="flex border-b border-white/5">
              <button
                onClick={() => setPanelTab('control')}
                className={`flex-1 py-2.5 text-xs font-medium transition-all ${panelTab === 'control' ? 'text-[#4fc3f7] border-b-2 border-[#4fc3f7]' : 'text-white/40'}`}
              >
                控制面板
              </button>
              <button
                onClick={() => setPanelTab('notes')}
                className={`flex-1 py-2.5 text-xs font-medium transition-all ${panelTab === 'notes' ? 'text-[#4fc3f7] border-b-2 border-[#4fc3f7]' : 'text-white/40'}`}
              >
                备注与报告
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {panelTab === 'control' ? <ControlPanel /> : <NotesPanel />}
            </div>
          </div>
        )}
      </div>

      <footer className="px-5 py-2 border-t border-white/5 bg-[#0a0e1a]/90 backdrop-blur-md flex items-center justify-between text-[10px] text-white/20">
        <span>数据已自动保存至本地</span>
        <span>最后保存: {new Date(project.updatedAt).toLocaleString('zh-CN')}</span>
      </footer>
    </div>
  )
}

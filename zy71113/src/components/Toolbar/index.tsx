import { Upload, Download, RefreshCw, Eye, Grid3X3 } from 'lucide-react'
import useSceneStore from '../../store/useSceneStore'
import { generateReport } from '../../utils/reportGenerator'
import type { SceneData } from '../../types'

interface ToolbarProps {
  onReset: () => void
  canvasRef: React.RefObject<HTMLCanvasElement>
}

function Toolbar({ onReset, canvasRef }: ToolbarProps) {
  const { viewMode, setViewMode, currentTime, signalPhases, conflicts, accidentPoints, intersection, loadSceneData } = useSceneStore()

  const handleExportReport = async () => {
    const reportData = {
      intersectionName: intersection?.name || '未命名路口',
      currentTime,
      signalPhases,
      conflicts,
      accidentPoints,
    }
    await generateReport(reportData, canvasRef.current)
  }

  const handleImportData = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string) as SceneData
            if (data.intersection && data.signalPhases && data.vehicles && data.pedestrians) {
              loadSceneData(data, true)
              alert(`数据导入成功！已加载路口：${data.intersection.name}`)
            } else {
              throw new Error('缺少必要字段')
            }
          } catch (err) {
            alert('数据格式错误，请检查JSON文件。需要包含 intersection、signalPhases、vehicles、pedestrians 等字段。')
            console.error('Import error:', err)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  return (
    <div className="w-16 bg-dark-light border-r border-slate-700 flex flex-col items-center py-4 gap-2">
      <button
        onClick={handleImportData}
        className="w-12 h-12 flex flex-col items-center justify-center hover:bg-slate-700 rounded-lg transition-colors group"
        title="导入数据"
      >
        <Upload size={20} className="text-slate-400 group-hover:text-white" />
        <span className="text-[10px] text-slate-500 mt-1">导入</span>
      </button>

      <button
        onClick={handleExportReport}
        className="w-12 h-12 flex flex-col items-center justify-center hover:bg-slate-700 rounded-lg transition-colors group"
        title="导出报告"
      >
        <Download size={20} className="text-slate-400 group-hover:text-white" />
        <span className="text-[10px] text-slate-500 mt-1">报告</span>
      </button>

      <div className="w-8 h-px bg-slate-700 my-2" />

      <button
        onClick={onReset}
        className="w-12 h-12 flex flex-col items-center justify-center hover:bg-slate-700 rounded-lg transition-colors group"
        title="重置场景"
      >
        <RefreshCw size={20} className="text-slate-400 group-hover:text-white" />
        <span className="text-[10px] text-slate-500 mt-1">重置</span>
      </button>

      <div className="w-8 h-px bg-slate-700 my-2" />

      <button
        onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')}
        className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg transition-colors group ${
          viewMode === '2d' ? 'bg-info' : 'hover:bg-slate-700'
        }`}
        title="切换视角"
      >
        {viewMode === '2d' ? (
          <Eye size={20} className="text-white" />
        ) : (
          <Grid3X3 size={20} className="text-slate-400 group-hover:text-white" />
        )}
        <span className={`text-[10px] mt-1 ${viewMode === '2d' ? 'text-white' : 'text-slate-500'}`}>
          {viewMode.toUpperCase()}
        </span>
      </button>
    </div>
  )
}

export default Toolbar

import { useNavigate } from 'react-router-dom'
import { Save, Image, LayoutGrid, RotateCcw, FileText } from 'lucide-react'
import useSceneStore from '@/stores/sceneStore'

interface ToolbarProps {
  onSave: () => void
  onScreenshot: () => void
  onExportReport: () => void
}

export default function Toolbar({ onSave, onScreenshot, onExportReport }: ToolbarProps) {
  const navigate = useNavigate()
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)
  const resetCamera = useSceneStore((state) => state.resetCamera)

  const handleReset = () => {
    setSelectedObject(null)
    resetCamera()
  }

  return (
    <div className="absolute top-4 right-4 z-20 glass-panel rounded-full p-1.5 flex gap-1">
      <button
        onClick={handleReset}
        className="p-2.5 rounded-full text-gray-400 hover:text-white hover:bg-theater-accent/20 transition-colors"
        title="重置视图"
      >
        <RotateCcw className="w-5 h-5" />
      </button>
      <button
        onClick={onSave}
        className="p-2.5 rounded-full text-gray-400 hover:text-white hover:bg-theater-accent/20 transition-colors"
        title="保存方案"
      >
        <Save className="w-5 h-5" />
      </button>
      <button
        onClick={onScreenshot}
        className="p-2.5 rounded-full text-gray-400 hover:text-white hover:bg-theater-accent/20 transition-colors"
        title="导出截图"
      >
        <Image className="w-5 h-5" />
      </button>
      <button
        onClick={onExportReport}
        className="p-2.5 rounded-full text-gray-400 hover:text-white hover:bg-theater-accent/20 transition-colors"
        title="导出报告"
      >
        <FileText className="w-5 h-5" />
      </button>
      <button
        onClick={() => navigate('/plans')}
        className="p-2.5 rounded-full text-gray-400 hover:text-white hover:bg-theater-accent/20 transition-colors"
        title="方案管理"
      >
        <LayoutGrid className="w-5 h-5" />
      </button>
    </div>
  )
}

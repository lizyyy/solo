import { useState, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward, Camera, Save, FolderOpen, RotateCcw, Eye, Maximize2, GripHorizontal } from 'lucide-react'
import { useProjectStore } from '@/store'

interface ControlBarProps {
  onScreenshot: () => void
}

export function ControlBar({ onScreenshot }: ControlBarProps) {
  const {
    playback, togglePlaying, setCurrentTime, setPlayback, saveProject, getSavedProjects, loadProject, clearAll,
  } = useProjectStore()

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [projectName, setProjectName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    const ms = Math.floor((time % 1) * 100)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  const handleSave = () => {
    if (projectName.trim()) {
      saveProject(projectName.trim())
      setProjectName('')
      setShowSaveModal(false)
    }
  }

  const savedProjects = getSavedProjects()

  return (
    <>
      <div className="h-16 bg-[#1a1a2e] border-t border-[#2c2c3e] flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentTime(0)}
            className="p-2 hover:bg-[#2c2c3e] rounded text-gray-400 hover:text-white transition-colors"
            title="回到开始"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlaying}
            className="p-3 bg-cyan-500 hover:bg-cyan-400 rounded-full text-white transition-colors"
            title={playback.isPlaying ? '暂停' : '播放'}
          >
            {playback.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          <button
            onClick={() => setCurrentTime(playback.duration)}
            className="p-2 hover:bg-[#2c2c3e] rounded text-gray-400 hover:text-white transition-colors"
            title="跳到结尾"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs text-gray-400 w-16 text-right">
            {formatTime(playback.currentTime)}
          </span>

          <div className="flex-1 relative">
            <input
              type="range"
              min={0}
              max={playback.duration}
              step={0.01}
              value={playback.currentTime}
              onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
              className="w-full h-2 bg-[#2c2c3e] rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-cyan-400
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:shadow-lg"
            />
          </div>

          <span className="text-xs text-gray-400 w-16">
            {formatTime(playback.duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">速度:</span>
          <select
            value={playback.speed}
            onChange={(e) => setPlayback({ speed: parseFloat(e.target.value) })}
            className="bg-[#2c2c3e] text-white text-sm px-2 py-1 rounded border-none outline-none"
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>

        <div className="h-8 w-px bg-[#2c2c3e]" />

        <div className="flex items-center gap-2">
          <button
            className="p-2 hover:bg-[#2c2c3e] rounded text-gray-400 hover:text-white transition-colors"
            title="正视图"
          >
            <Eye className="w-5 h-5" />
          </button>
          <button
            className="p-2 hover:bg-[#2c2c3e] rounded text-gray-400 hover:text-white transition-colors"
            title="顶视图"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            className="p-2 hover:bg-[#2c2c3e] rounded text-gray-400 hover:text-white transition-colors"
            title="重置视角"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div className="h-8 w-px bg-[#2c2c3e]" />

        <div className="flex items-center gap-2">
          <button
            onClick={onScreenshot}
            className="p-2 hover:bg-[#2c2c3e] rounded text-gray-400 hover:text-white transition-colors"
            title="截图"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="p-2 hover:bg-[#2c2c3e] rounded text-gray-400 hover:text-white transition-colors"
            title="保存方案"
          >
            <Save className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowLoadModal(true)}
            className="p-2 hover:bg-[#2c2c3e] rounded text-gray-400 hover:text-white transition-colors"
            title="加载方案"
          >
            <FolderOpen className="w-5 h-5" />
          </button>
          <button
            onClick={clearAll}
            className="p-2 hover:bg-[#2c2c3e] rounded text-gray-400 hover:text-red-400 transition-colors"
            title="清空场景"
          >
            <GripHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a2e] rounded-lg p-6 w-96 border border-[#2c2c3e]">
            <h3 className="text-lg font-bold text-white mb-4">保存方案</h3>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="输入方案名称"
              className="w-full bg-[#2c2c3e] text-white px-4 py-2 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-cyan-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a2e] rounded-lg p-6 w-96 max-h-[80vh] flex flex-col border border-[#2c2c3e]">
            <h3 className="text-lg font-bold text-white mb-4">加载方案</h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {savedProjects.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无保存的方案</p>
              ) : (
                savedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="p-3 bg-[#252540] rounded-lg hover:bg-[#2c2c3e] cursor-pointer transition-colors"
                    onClick={() => {
                      loadProject(project.id)
                      setShowLoadModal(false)
                    }}
                  >
                    <div className="text-white font-medium">{project.name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(project.savedAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-[#2c2c3e]">
              <button
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

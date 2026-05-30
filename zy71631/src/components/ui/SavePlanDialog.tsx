import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { formatDateTime } from '@/utils'
import usePlanStore from '@/stores/planStore'
import useSceneStore from '@/stores/sceneStore'

interface SavePlanDialogProps {
  open: boolean
  onClose: () => void
}

export default function SavePlanDialog({ open, onClose }: SavePlanDialogProps) {
  const [name, setName] = useState(`方案 - ${formatDateTime(new Date().toISOString())}`)
  const [error, setError] = useState('')

  const savePlan = usePlanStore((state) => state.savePlan)
  const currentBand = useSceneStore((state) => state.currentBand)

  if (!open) return null

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('方案名称不能为空')
      return
    }
    savePlan(trimmedName, currentBand)
    onClose()
    setName(`方案 - ${formatDateTime(new Date().toISOString())}`)
    setError('')
  }

  const handleCancel = () => {
    onClose()
    setName(`方案 - ${formatDateTime(new Date().toISOString())}`)
    setError('')
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 fade-in">
      <div className="glass-panel rounded-xl w-[380px] shadow-theater">
        <div className="flex items-center justify-between p-4 border-b border-theater-border">
          <h3 className="font-display text-lg text-white">保存方案</h3>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-theater-border rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-gray-400 text-sm block">方案名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError('')
              }}
              placeholder="请输入方案名称"
              className="w-full px-3 py-2 bg-theater-dark/50 border border-theater-border rounded-lg text-white text-sm focus:outline-none focus:border-theater-accent transition-colors"
            />
            {error && <p className="text-theater-red text-xs">{error}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-gray-400 text-sm block">当前频段</label>
            <div className="w-full px-3 py-2 bg-theater-dark/30 border border-theater-border rounded-lg text-gray-300 text-sm font-mono">
              {currentBand}
            </div>
            <p className="text-gray-500 text-xs">将保存当前频段下所有座位的声压级数据</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCancel}
              className="flex-1 py-2 bg-theater-border text-gray-300 rounded-lg text-sm hover:bg-theater-border/80 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2 bg-theater-accent text-white rounded-lg text-sm hover:bg-theater-accent/80 transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

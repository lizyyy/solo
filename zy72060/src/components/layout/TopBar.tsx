import { useStore } from '@/store/useStore'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Database,
  FolderOpen,
  FileText,
  Camera,
  RotateCcw,
  Eye,
  Filter,
} from 'lucide-react'
import { useRef, useCallback } from 'react'
import { captureScene, downloadScreenshot, getFilterLabel, getViewPresetLabel } from '@/utils/screenshot'
import type { ViewPreset, PointStatus } from '@/types'
import { VIEW_PRESETS } from '@/types'

const NAV_ITEMS = [
  { path: '/', icon: Box, label: '作业立方' },
  { path: '/data', icon: Database, label: '数据管理' },
  { path: '/plans', icon: FolderOpen, label: '方案工作台' },
  { path: '/report', icon: FileText, label: '报告' },
]

export default function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { viewPreset, setViewPreset, filterStatus, setFilterStatus, loadSampleData } = useStore()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const handleScreenshot = useCallback(() => {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      const filterCtx = getFilterLabel()
      captureScene(canvas, filterCtx).then((dataUrl) => {
        downloadScreenshot(dataUrl)
      })
    }
  }, [])

  const handleReset = () => {
    if (confirm('确定要重置为样例数据吗？当前数据将被覆盖。')) {
      loadSampleData()
      window.location.reload()
    }
  }

  const presetButtons: { key: ViewPreset; label: string }[] = [
    { key: 'front', label: '正面' },
    { key: 'side', label: '侧面' },
    { key: 'top', label: '俯视' },
  ]

  const filterButtons: { key: PointStatus | 'all'; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'normal', label: '正常' },
    { key: 'anomaly', label: '异常' },
    { key: 'conflict', label: '冲突' },
  ]

  return (
    <div className="h-12 bg-[#0F1923]/90 backdrop-blur-md border-b border-slate-700/50 flex items-center px-4 gap-1 z-30">
      <div className="flex items-center gap-2 mr-4">
        <Box size={18} className="text-[#00E5A0]" />
        <span className="text-sm font-bold text-slate-200 tracking-wide">
          岸桥作业立方
        </span>
      </div>

      <div className="h-6 w-px bg-slate-700/50 mx-2" />

      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
              location.pathname === path
                ? 'bg-[#00E5A0]/15 text-[#00E5A0]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      {location.pathname === '/' && (
        <>
          <div className="flex items-center gap-1 mr-3">
            <Eye size={12} className="text-slate-500" />
            <span className="text-[10px] text-slate-500 mr-1">视角</span>
            {presetButtons.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setViewPreset(key)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  viewPreset === key
                    ? 'bg-[#00E5A0]/20 text-[#00E5A0] border border-[#00E5A0]/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-600/30'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 mr-3">
            <Filter size={12} className="text-slate-500" />
            <span className="text-[10px] text-slate-500 mr-1">筛选</span>
            {filterButtons.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  filterStatus === key
                    ? key === 'anomaly'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : key === 'conflict'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : key === 'normal'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-600/30'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={handleScreenshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 border border-transparent hover:border-slate-600/30 transition-colors"
          >
            <Camera size={13} />
            截图
          </button>
        </>
      )}

      <button
        onClick={handleReset}
        className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        title="重置为样例数据"
      >
        <RotateCcw size={11} />
      </button>
    </div>
  )
}

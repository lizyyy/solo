import React from 'react'
import { Waves, Search, RotateCcw, Download } from 'lucide-react'
import { useStationStore } from '@/store/stationStore'
import { ViewMode } from '@/types/station'

const viewModes: { key: ViewMode; label: string }[] = [
  { key: 'global', label: '全局' },
  { key: 'anomaly', label: '仅异常' },
  { key: 'batch', label: '按批次' },
]

const TopToolbar: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    searchKeyword,
    setSearchKeyword,
    setShowExportPanel,
  } = useStationStore()

  const handleResetCamera = () => {
    window.dispatchEvent(new CustomEvent('reset-camera'))
  }

  return (
    <div className="absolute top-4 left-4 right-[36%] z-20">
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-4 shadow-lg">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative">
            <Waves
              size={26}
              className="text-teal-glow drop-shadow-[0_0_8px_rgba(0,212,170,0.7)]"
              strokeWidth={2}
            />
            <div className="absolute inset-0 bg-teal-glow/20 blur-lg rounded-full -z-10" />
          </div>
          <div className="leading-tight">
            <h1
              className="font-display font-semibold text-[18px] tracking-wide"
              style={{ color: '#E8F4FF' }}
            >
              潮汐能站报告汇总
            </h1>
            <p className="text-[11px] text-deepsea-200/80 tracking-wider">
              Web3D 遥感对账工具
            </p>
          </div>
        </div>

        <div className="divider-line w-px h-10 mx-1 flex-shrink-0" />

        <div className="flex items-center gap-1 bg-deepsea-900/50 rounded-lg p-1 border border-deepsea-500/30 flex-shrink-0">
          {viewModes.map((vm) => {
            const active = viewMode === vm.key
            return (
              <button
                key={vm.key}
                onClick={() => setViewMode(vm.key)}
                className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? 'bg-teal-glow/90 text-deepsea-950 shadow-teal-glow'
                    : 'text-deepsea-100/80 hover:text-deepsea-50 hover:bg-deepsea-700/50'
                }`}
              >
                {vm.label}
              </button>
            )
          })}
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
          <div className="relative w-full max-w-[240px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-deepsea-200/70 pointer-events-none"
            />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="站点编号/名称"
              className="input-glow w-full h-9 pl-9 pr-3 rounded-lg text-[13px]"
            />
          </div>

          <button
            onClick={handleResetCamera}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-deepsea-500/40 text-deepsea-100/90 hover:bg-deepsea-700/50 hover:border-deepsea-400/60 transition-all text-[13px] font-medium"
          >
            <RotateCcw size={15} />
            重置视角
          </button>

          <button
            onClick={() => setShowExportPanel(true)}
            className="btn-coral-glow inline-flex items-center gap-1.5 px-4 h-9 rounded-lg text-[13px]"
          >
            <Download size={15} />
            导出
          </button>
        </div>
      </div>
    </div>
  )
}

export default TopToolbar

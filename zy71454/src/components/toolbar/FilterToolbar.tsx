import { useState } from 'react';
import { Filter, Search, Download, Camera, ThermometerSun, Zap, Eye, History, X } from 'lucide-react';
import usePianoStore from '../../store/usePianoStore';
import ExportModal from './ExportModal';
import SnapshotModal from './SnapshotModal';

export default function FilterToolbar() {
  const { 
    filters, 
    viewMode, 
    updateFilters, 
    setViewMode, 
    getFilteredKeys,
    keys,
    togglePanel,
    showPanel
  } = usePianoStore();
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);

  const filteredCount = getFilteredKeys().length;
  const totalCount = keys.length;

  const viewModes = [
    { id: 'heatmap', label: '热力图', icon: ThermometerSun },
    { id: 'normal', label: '普通', icon: Eye },
    { id: 'rebound', label: '回弹', icon: Zap },
  ] as const;

  return (
    <>
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="bg-zinc-900/90 backdrop-blur-sm rounded-xl border border-zinc-700 p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">
                钢琴键盘力反馈图
              </h1>
              <span className="text-xs text-zinc-500">
                {filteredCount}/{totalCount} 键可见
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-zinc-800 rounded-lg p-1">
                {viewModes.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setViewMode(id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                      viewMode === id
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-zinc-700" />

              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索键号/音名..."
                  value={filters.searchText}
                  onChange={(e) => updateFilters({ searchText: e.target.value })}
                  className="w-40 bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
                />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                {filters.searchText && (
                  <button
                    onClick={() => updateFilters({ searchText: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  showFilters || filters.status.length > 0
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Filter size={14} />
                筛选
              </button>

              <div className="h-6 w-px bg-zinc-700" />

              <button
                onClick={togglePanel}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  showPanel
                    ? 'bg-zinc-700 text-zinc-200'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Eye size={14} />
                面板
              </button>

              <button
                onClick={() => setShowSnapshots(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all flex items-center gap-1.5"
              >
                <History size={14} />
                快照
              </button>

              <button
                onClick={() => setShowExport(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-orange-500/20"
              >
                <Download size={14} />
                导出
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 pt-3 border-t border-zinc-700 grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">键号范围</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={88}
                    value={filters.keyRange[0]}
                    onChange={(e) => updateFilters({ keyRange: [parseInt(e.target.value) || 1, filters.keyRange[1]] })}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-zinc-500">-</span>
                  <input
                    type="number"
                    min={1}
                    max={88}
                    value={filters.keyRange[1]}
                    onChange={(e) => updateFilters({ keyRange: [filters.keyRange[0], parseInt(e.target.value) || 88] })}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">压力范围 (g)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={filters.pressureRange[0]}
                    onChange={(e) => updateFilters({ pressureRange: [parseInt(e.target.value) || 40, filters.pressureRange[1]] })}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-zinc-500">-</span>
                  <input
                    type="number"
                    value={filters.pressureRange[1]}
                    onChange={(e) => updateFilters({ pressureRange: [filters.pressureRange[0], parseInt(e.target.value) || 80] })}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">回弹时间 (ms)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={filters.reboundRange[0]}
                    onChange={(e) => updateFilters({ reboundRange: [parseInt(e.target.value) || 60, filters.reboundRange[1]] })}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-zinc-500">-</span>
                  <input
                    type="number"
                    value={filters.reboundRange[1]}
                    onChange={(e) => updateFilters({ reboundRange: [filters.reboundRange[0], parseInt(e.target.value) || 180] })}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">状态筛选</label>
                <div className="flex gap-2">
                  {(['normal', 'warning', 'error'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        const newStatus = filters.status.includes(status)
                          ? filters.status.filter(s => s !== status)
                          : [...filters.status, status];
                        updateFilters({ status: newStatus });
                      }}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        filters.status.includes(status)
                          ? status === 'normal'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : status === 'warning'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {status === 'normal' ? '正常' : status === 'warning' ? '警告' : '异常'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showSnapshots && <SnapshotModal onClose={() => setShowSnapshots(false)} />}
    </>
  );
}

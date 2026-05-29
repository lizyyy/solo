import React, { useState } from 'react';
import { usePatternStore } from '@/store/patternStore';
import { downloadMidi, downloadPatternJson } from '@/utils/midiExport';
import { Download, FileJson, Music, Filter, Check } from 'lucide-react';

export const ExportPanel: React.FC = () => {
  const { pattern, filterTracks, setFilterTracks } = usePatternStore();
  const [exportRange, setExportRange] = useState<'all' | 'visible'>('all');

  const handleExportMidi = () => {
    const trackIds = exportRange === 'visible' && filterTracks.length > 0 ? filterTracks : [];
    downloadMidi(pattern, trackIds);
  };

  const handleExportJson = () => {
    downloadPatternJson(pattern);
  };

  const toggleTrackFilter = (trackId: string) => {
    if (filterTracks.includes(trackId)) {
      setFilterTracks(filterTracks.filter((id) => id !== trackId));
    } else {
      setFilterTracks([...filterTracks, trackId]);
    }
  };

  const clearFilters = () => {
    setFilterTracks([]);
  };

  const selectAll = () => {
    setFilterTracks(pattern.tracks.map((t) => t.id));
  };

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neon-blue flex items-center gap-2">
          <Download size={20} />
          导出设置
        </h2>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400 flex items-center gap-1">
              <Filter size={14} />
              轨道筛选
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-neon-blue hover:underline"
              >
                全选
              </button>
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                清除
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {pattern.tracks.map((track) => (
              <button
                key={track.id}
                onClick={() => toggleTrackFilter(track.id)}
                className={`flex items-center gap-2 p-2 rounded text-sm transition-all ${
                  filterTracks.includes(track.id) || filterTracks.length === 0
                    ? 'bg-dark-600 border border-neon-blue/30'
                    : 'bg-dark-700 border border-transparent opacity-50'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: track.color }}
                />
                <span className="flex-1 text-left truncate">{track.name}</span>
                {(filterTracks.includes(track.id) || filterTracks.length === 0) && (
                  <Check size={12} className="text-neon-blue" />
                )}
              </button>
            ))}
          </div>
          {filterTracks.length > 0 && (
            <p className="text-xs text-neon-green">
              已筛选 {filterTracks.length} 个轨道，导出时仅包含选中轨道
            </p>
          )}
        </div>

        <div className="space-y-2">
          <span className="text-sm text-gray-400">导出范围</span>
          <div className="flex gap-2">
            <button
              onClick={() => setExportRange('all')}
              className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
                exportRange === 'all'
                  ? 'bg-neon-blue text-dark-900'
                  : 'bg-dark-700 text-gray-400 hover:text-white'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setExportRange('visible')}
              className={`flex-1 py-2 px-3 rounded text-sm transition-colors ${
                exportRange === 'visible'
                  ? 'bg-neon-blue text-dark-900'
                  : 'bg-dark-700 text-gray-400 hover:text-white'
              }`}
            >
              可见轨道
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-dark-600">
          <div className="space-y-2">
            <button
              onClick={handleExportMidi}
              className="w-full flex items-center justify-center gap-2 py-3 bg-neon-blue text-dark-900 rounded-lg font-medium hover:shadow-neon-blue transition-all"
            >
              <Music size={18} />
              导出 MIDI 文件
            </button>
            <button
              onClick={handleExportJson}
              className="w-full flex items-center justify-center gap-2 py-2 bg-dark-700 text-gray-300 rounded-lg hover:bg-dark-600 transition-colors"
            >
              <FileJson size={16} />
              导出 Pattern JSON
            </button>
          </div>
        </div>

        <div className="p-3 bg-dark-700/50 rounded-lg">
          <p className="text-xs text-gray-500 mb-2">导出预览</p>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">文件名:</span>
              <span className="text-white">{pattern.name.replace(/\s+/g, '_')}.mid</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">BPM:</span>
              <span className="text-white">{pattern.bpm}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">轨道数:</span>
              <span className="text-white">
                {exportRange === 'visible' && filterTracks.length > 0
                  ? filterTracks.length
                  : pattern.tracks.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">总音符:</span>
              <span className="text-white">
                {pattern.tracks
                  .filter(
                    (t) =>
                      exportRange === 'all' ||
                      filterTracks.length === 0 ||
                      filterTracks.includes(t.id)
                  )
                  .reduce((sum, t) => sum + t.notes.filter((n) => n.isActive).length, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

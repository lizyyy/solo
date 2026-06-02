import { Download, FileText } from 'lucide-react';
import type { Playlist, Track } from '../types';
import { exportToCsv } from '../utils/csvExporter';

interface ExportBarProps {
  playlist: Playlist;
  filteredTracks: Track[];
  totalTracks: number;
}

export function ExportBar({ playlist, filteredTracks, totalTracks }: ExportBarProps) {
  const handleExportFiltered = () => {
    exportToCsv({
      playlist,
      tracks: filteredTracks,
      filename: `${playlist.name}_筛选结果_${new Date().toISOString().slice(0, 10)}.csv`,
    });
  };

  const handleExportAll = () => {
    exportToCsv({
      playlist,
      tracks: playlist.tracks,
      filename: `${playlist.name}_全部_${new Date().toISOString().slice(0, 10)}.csv`,
    });
  };

  const isFiltered = filteredTracks.length !== totalTracks;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              <span>
                当前筛选：<strong className="text-[#1E3A3A]">{filteredTracks.length}</strong> 条
                {isFiltered && (
                  <span className="text-gray-400 ml-1">
                    （共 {totalTracks} 条）
                  </span>
                )}
              </span>
            </div>
            {isFiltered && (
              <span className="px-2 py-0.5 bg-[#F2CC8F]/30 text-[#8B6914] rounded text-xs">
                已筛选
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportAll}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              导出全部
            </button>
            <button
              onClick={handleExportFiltered}
              className="flex items-center gap-2 px-4 py-2 bg-[#1E3A3A] hover:bg-[#2A4A4A] text-white rounded text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              导出当前筛选
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { RefreshCw, RotateCcw, Filter, Download, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  onRestart?: () => void;
  onExport?: () => void;
  showFilter?: boolean;
  onFilterClick?: () => void;
}

export default function Header({
  title,
  subtitle,
  onRefresh,
  onRestart,
  onExport,
  showFilter = false,
  onFilterClick,
}: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-[#1a1f2e] border-b border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Clock className="w-4 h-4" />
            <span className="font-mono">
              {currentTime.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {showFilter && (
              <button
                onClick={onFilterClick}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm transition-colors"
              >
                <Filter className="w-4 h-4" />
                筛选
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                导出
              </button>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                刷新
              </button>
            )}
            {onRestart && (
              <button
                onClick={onRestart}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                重启
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

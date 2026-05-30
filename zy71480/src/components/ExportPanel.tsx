import { Download, FileJson, FileSpreadsheet, Clock, Database, Tag } from 'lucide-react';
import { useStore } from '../store';

export function ExportPanel() {
  const { results, versionMeta, exportJSON, exportCSV, errors, speakers } = useStore();

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="bg-acoustic-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-acoustic-700">
        <h2 className="text-lg font-semibold text-white">版本与导出</h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-acoustic-900 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Tag size={14} className="text-accent-primary" />
            <span className="text-gray-400">版本号:</span>
            <span className="text-white font-mono">{versionMeta.version || '未设置'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Database size={14} className="text-accent-primary" />
            <span className="text-gray-400">数据来源:</span>
            <span className="text-white">{versionMeta.source || '未设置'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock size={14} className="text-accent-primary" />
            <span className="text-gray-400">计算时间:</span>
            <span className="text-white font-mono text-xs">
              {results.length > 0 ? formatDateTime(versionMeta.timestamp) : '未计算'}
            </span>
          </div>
        </div>

        {results.length > 0 && (
          <div className="bg-acoustic-900 rounded-lg p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">音箱数量</span>
              <span className="text-white font-mono">{speakers.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">测点数量</span>
              <span className="text-white font-mono">{results.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">分析频率</span>
              <span className="text-white font-mono">{versionMeta.frequency} Hz</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">声压阈值</span>
              <span className="text-white font-mono">{versionMeta.splThreshold} dB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">校验错误</span>
              <span className={errors.length > 0 ? 'text-accent-danger font-mono' : 'text-accent-success font-mono'}>
                {errors.length} 项
              </span>
            </div>
            <div className="pt-2 border-t border-acoustic-700">
              <div className="flex justify-between">
                <span className="text-gray-400">最大声压级</span>
                <span className="text-accent-danger font-mono font-medium">
                  {Math.max(...results.map((r) => r.totalSpl)).toFixed(1)} dB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">最小声压级</span>
                <span className="text-accent-primary font-mono">
                  {Math.min(...results.map((r) => r.totalSpl)).toFixed(1)} dB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">平均声压级</span>
                <span className="text-white font-mono">
                  {(results.reduce((sum, r) => sum + r.totalSpl, 0) / results.length).toFixed(1)} dB
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs text-gray-400 mb-2">导出数据（与页面显示完全一致）</div>
          <button
            onClick={exportJSON}
            disabled={results.length === 0}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent-primary text-white rounded hover:bg-cyan-500 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileJson size={16} />
            导出 JSON
          </button>
          <button
            onClick={exportCSV}
            disabled={results.length === 0}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent-success text-white rounded hover:bg-green-500 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={16} />
            导出 CSV
          </button>
        </div>

        {results.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-2">
            <Download size={20} className="mx-auto mb-1 opacity-50" />
            计算完成后可导出
          </div>
        )}
      </div>
    </div>
  );
}

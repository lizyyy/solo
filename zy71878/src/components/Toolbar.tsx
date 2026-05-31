import { Upload, Filter, AlertTriangle, RotateCcw } from 'lucide-react';
import { useRecordsStore } from '../store/useRecordsStore';
import type { RecordStatus } from '../types';
import { STATUS_LABELS, ANOMALY_LABELS } from '../types';
import { getAnomalySummary } from '../logic/statusManager';

export const Toolbar = () => {
  const {
    records,
    filterStatus,
    setFilter,
    showAnomalyPanel,
    toggleAnomalyPanel,
    importPacket,
    resetData,
  } = useRecordsStore();

  const anomalySummary = getAnomalySummary(records);
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          importPacket(data);
        }
      } catch (err) {
        console.error('Failed to parse file:', err);
        alert('文件解析失败，请确保是有效的JSON格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filters: (RecordStatus | 'all')[] = ['all', 'normal', 'pending', 'corrected', 'duplicate'];

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold text-slate-100 font-mono tracking-tight">
            工厂瓶颈识别 · 数据追踪
          </h1>
          
          <div className="flex items-center gap-1 bg-slate-900/50 rounded p-0.5">
            <Filter className="w-4 h-4 text-slate-500 ml-2" />
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  filterStatus === f
                    ? 'bg-industrial-700 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                {f === 'all' ? '全部' : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleAnomalyPanel}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors ${
              showAnomalyPanel
                ? 'bg-orange-900/50 text-orange-400 border border-orange-700/50'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>待确认 ({anomalySummary.total})</span>
            {anomalySummary.total > 0 && (
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">
                {anomalySummary.total}
              </span>
            )}
          </button>

          <label className="flex items-center gap-2 px-3 py-1.5 bg-industrial-700 hover:bg-industrial-600 text-white rounded text-xs cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            <span>导入数据包</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => {
              if (confirm('确定要重置所有数据吗？此操作不可撤销。')) {
                resetData();
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>重置</span>
          </button>
        </div>
      </div>

      {anomalySummary.total > 0 && showAnomalyPanel && (
        <div className="mt-3 p-3 bg-orange-900/20 border border-orange-800/50 rounded">
          <div className="text-xs text-orange-400 mb-2 font-medium">异常类型分布</div>
          <div className="flex gap-4">
            {Object.entries(anomalySummary.byType).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="text-sm">{ANOMALY_LABELS[type as keyof typeof ANOMALY_LABELS]}</span>
                <span className="px-2 py-0.5 bg-orange-900/50 rounded text-orange-300 text-xs font-mono">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

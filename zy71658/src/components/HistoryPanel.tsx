
import type { ExperimentRecord } from '../types';

interface HistoryPanelProps {
  records: ExperimentRecord[];
  onSelect: (record: ExperimentRecord) => void;
  onDelete: (id: string) => void;
}

export function HistoryPanel({ records, onSelect, onDelete }: HistoryPanelProps) {
  const statusColors = {
    safe: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    unknown: 'bg-gray-100 text-gray-700',
  };

  const statusLabels = {
    safe: '✓ 安全',
    warning: '⚠ 警告',
    danger: '✗ 危险',
    unknown: '? 未知',
  };

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">📚</span>
          历史记录
        </h2>
        <div className="text-center py-8 text-gray-400">
          <span className="text-4xl block mb-3">📭</span>
          <p>暂无实验记录</p>
          <p className="text-sm">完成实验后记录将自动保存</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <span className="text-2xl">📚</span>
        历史记录
        <span className="text-sm font-normal text-gray-500">
          （最近 {records.length} 条）
        </span>
      </h2>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {records.map((record) => (
          <div
            key={record.id}
            className="border border-gray-200 rounded-lg p-3 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer group"
            onClick={() => onSelect(record)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">
                  {record.name || '未命名实验'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(record.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[record.result.status]}`}>
                  {statusLabels[record.result.status]}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(record.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity p-1"
                >
                  🗑️
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2 truncate">
              {record.params.temperature !== null && `🌡️${record.params.temperature}${record.params.temperatureUnit} `}
              {record.params.payload !== null && `⚖️${record.params.payload}${record.params.payloadUnit} `}
              {record.params.windSpeed !== null && `💨${record.params.windSpeed}${record.params.windSpeedUnit}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

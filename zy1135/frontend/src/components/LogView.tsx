import { LogEntry, ResourcesDelta } from '../types';

interface LogViewProps {
  logs: LogEntry[];
  limit?: number;
}

const LogView = ({ logs, limit }: LogViewProps) => {
  const displayLogs = limit ? logs.slice(-limit) : logs;

  const getLogTypeClass = (type: LogEntry['type']) => {
    const classes: Record<LogEntry['type'], string> = {
      action: 'log-action',
      event: 'log-event',
      resource_change: 'log-action',
      settlement: 'log-settlement',
      end: 'log-end',
    };
    return classes[type];
  };

  const getLogTypeLabel = (type: LogEntry['type']) => {
    const labels: Record<LogEntry['type'], string> = {
      action: '行动',
      event: '事件',
      resource_change: '资源',
      settlement: '结算',
      end: '结局',
    };
    return labels[type];
  };

  const formatResourceChange = (delta: ResourcesDelta): string => {
    const parts: string[] = [];
    if (delta.food) parts.push(`食物${delta.food > 0 ? '+' : ''}${delta.food}`);
    if (delta.water) parts.push(`水${delta.water > 0 ? '+' : ''}${delta.water}`);
    if (delta.energy) parts.push(`体力${delta.energy > 0 ? '+' : ''}${delta.energy}`);
    if (delta.spirit) parts.push(`精神${delta.spirit > 0 ? '+' : ''}${delta.spirit}`);
    if (delta.toolDurability)
      parts.push(`工具${delta.toolDurability > 0 ? '+' : ''}${delta.toolDurability}`);
    if (delta.safety) parts.push(`安全${delta.safety > 0 ? '+' : ''}${delta.safety}`);
    return parts.join(', ');
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold text-gray-800 mb-4">📖 航海日志</h2>

      <div className="max-h-96 overflow-y-auto space-y-1">
        {displayLogs.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            暂无日志记录
          </div>
        ) : (
          displayLogs.map((log) => (
            <div key={log.id} className={`log-entry ${getLogTypeClass(log.type)}`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase mr-2">
                    {getLogTypeLabel(log.type)}
                  </span>
                  <span className="font-semibold text-gray-800">{log.title}</span>
                </div>
                <span className="text-xs text-gray-400">第 {log.day} 天</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{log.content}</p>
              {log.resourceChanges && Object.keys(log.resourceChanges).length > 0 && (
                <p className="text-xs text-gray-500 mt-1 italic">
                  {formatResourceChange(log.resourceChanges)}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogView;

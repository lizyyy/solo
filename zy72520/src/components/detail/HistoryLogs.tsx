import { Clock, User } from 'lucide-react';
import { OperationLog } from '../../types';

interface HistoryLogsProps {
  logs: OperationLog[];
}

const HistoryLogs = ({ logs }: HistoryLogsProps) => {
  return (
    <div className="card-border">
      <h3 className="text-lg font-serif font-semibold text-primary-800 mb-4">历史操作记录</h3>
      
      <div className="space-y-3">
        {logs.map((log, index) => (
          <div 
            key={log.id} 
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-primary-800">{log.action}</p>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {log.timestamp}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="text-primary-600">{log.operator}</span> · {log.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryLogs;

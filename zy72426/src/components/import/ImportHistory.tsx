import type { ImportLog } from '@/types';
import { FileText, User, Clock } from 'lucide-react';

interface ImportHistoryProps {
  history: ImportLog[];
}

export const ImportHistory = ({ history }: ImportHistoryProps) => {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>暂无导入记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((log) => (
        <div
          key={log.id}
          className="flex items-center justify-between p-4 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded border border-gray-200 flex items-center justify-center">
              <FileText className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="font-medium text-gray-800">{log.fileName}</p>
              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {log.operator}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(log.timestamp).toLocaleString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[#1e3a5f]">{log.recordCount}</p>
            <p className="text-xs text-gray-500">{log.importVersion}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

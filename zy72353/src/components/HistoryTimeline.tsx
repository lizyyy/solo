import { Clock, User, Edit3 } from 'lucide-react';
import type { HistoryRecord } from '../types';
import { cn } from '../lib/utils';

interface HistoryTimelineProps {
  records: HistoryRecord[];
}

const fieldNameMap: Record<string, string> = {
  remark: '备注',
  value: '阈值数值',
  unit: '单位',
  status: '状态',
  hasUnitMix: '单位混用标记',
  name: '名称',
  deviceId: '关联设备',
};

const HistoryTimeline = ({ records }: HistoryTimelineProps) => {
  if (records.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 text-industrial-400 mx-auto mb-3" />
        <p className="text-industrial-300">暂无修改记录</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );

  return (
    <div className="relative">
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-industrial-500" />
      
      <div className="space-y-6">
        {sortedRecords.map((record, index) => (
          <div key={record.id} className="relative pl-16">
            <div className="absolute left-4 w-5 h-5 bg-primary-500 rounded-full border-4 border-industrial-600" />
            
            <div className="bg-industrial-700 rounded-xl p-5 border border-industrial-500">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-primary-400" />
                  <span className="text-white font-medium">
                    修改 {fieldNameMap[record.fieldName] || record.fieldName}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-industrial-300">
                    <User className="w-4 h-4" />
                    {record.modifiedBy}
                  </div>
                  <div className="flex items-center gap-1.5 text-industrial-400">
                    <Clock className="w-4 h-4" />
                    {formatDate(record.modifiedAt)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
                  <p className="text-red-400 text-xs font-medium mb-2">修改前</p>
                  <p className="text-white font-mono">
                    {record.oldValue || '(空)'}
                  </p>
                </div>
                <div className="bg-success-500/10 rounded-lg p-4 border border-success-500/30">
                  <p className="text-success-400 text-xs font-medium mb-2">修改后</p>
                  <p className="text-white font-mono">
                    {record.newValue || '(空)'}
                  </p>
                </div>
              </div>

              {record.changeReason && (
                <div className="mt-4 pt-4 border-t border-industrial-500">
                  <p className="text-industrial-400 text-sm">
                    <span className="text-primary-400">修改原因：</span>
                    {record.changeReason}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryTimeline;

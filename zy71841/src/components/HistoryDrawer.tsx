import { X, Clock, User, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/store';
import { formatDate } from '@/utils/helpers';
import { sourceLabels } from '@/types';

interface HistoryDrawerProps {
  recordId: string;
  onClose: () => void;
}

export default function HistoryDrawer({ recordId, onClose }: HistoryDrawerProps) {
  const { getRecordHistory, records } = useAppStore();
  const record = records.find(r => r.id === recordId);
  const history = getRecordHistory(recordId);

  if (!record) return null;

  const fieldLabels: Record<string, string> = {
    status: '状态',
    position: '位置',
    pendingReason: '待处理原因',
    carModel: '车型',
    vin: 'VIN码',
    color: '颜色',
    notes: '备注',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-white shadow-2xl animate-slide-in flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">记录详情</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {record.content.carModel || '未命名记录'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-slate-700">基本信息</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">来源：</span>
                  <span className="text-slate-800">{sourceLabels[record.source]}</span>
                </div>
                <div>
                  <span className="text-slate-500">修改人：</span>
                  <span className="text-slate-800">{record.modifiedBy}</span>
                </div>
                <div>
                  <span className="text-slate-500">创建时间：</span>
                  <span className="text-slate-800">{formatDate(record.createdAt)}</span>
                </div>
                <div>
                  <span className="text-slate-500">更新时间：</span>
                  <span className="text-slate-800">{formatDate(record.updatedAt)}</span>
                </div>
              </div>
            </div>

            {record.pendingReason && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-yellow-800 mb-1">待处理原因</h4>
                <p className="text-sm text-yellow-700">{record.pendingReason}</p>
              </div>
            )}

            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-slate-700">车辆信息</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">车型：</span>
                  <span className="text-slate-800">{record.content.carModel || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">颜色：</span>
                  <span className="text-slate-800">{record.content.color || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">VIN码：</span>
                  <span className="text-slate-800 font-mono text-xs">{record.content.vin || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">展位：</span>
                  <span className="text-slate-800">{record.content.position || '-'}</span>
                </div>
              </div>
              {record.content.notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 text-sm">备注：</span>
                  <span className="text-slate-800 text-sm">{record.content.notes}</span>
                </div>
              )}
            </div>

            {record.attachments.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-700 mb-3">
                  附件 ({record.attachments.length})
                </h4>
                <div className="space-y-2">
                  {record.attachments.map(att => (
                    <div key={att.id} className="flex items-center space-x-3 text-sm">
                      <span className="text-2xl">🖼️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 truncate">{att.fileName}</p>
                        {att.isLate && (
                          <p className="text-xs text-orange-600">晚到附件</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {history.length > 0 && (
              <div className="pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  修改历史 ({history.length})
                </h4>
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />
                  <div className="space-y-4">
                    {history.map((entry, index) => (
                      <div 
                        key={entry.id} 
                        className="relative pl-8 animate-fade-in-up"
                        style={{ '--stagger-index': index } as React.CSSProperties}
                      >
                        <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-primary-500 border-2 border-white shadow" />
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-primary-600">
                              {fieldLabels[entry.fieldName] || entry.fieldName}
                            </span>
                            <span className="text-xs text-slate-400">
                              {formatDate(entry.modifiedAt)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm mb-2">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                              {String(entry.oldValue) || '(空)'}
                            </span>
                            <ArrowRight className="w-4 h-4 text-slate-400" />
                            <span className="bg-primary-100 px-2 py-0.5 rounded text-primary-700">
                              {String(entry.newValue) || '(空)'}
                            </span>
                          </div>
                          <div className="flex items-center text-xs text-slate-500">
                            <User className="w-3 h-3 mr-1" />
                            <span>{entry.modifiedBy}</span>
                            <span className="mx-1.5">·</span>
                            <span>{entry.reason}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {history.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无修改历史</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

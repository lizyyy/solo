import { X, FileText, User, Clock, GitBranch } from 'lucide-react';
import { useAllocationStore } from '@/store/useAllocationStore';
import { formatDateTime } from '@/utils/storage';
import { PERSON_TYPE_LABELS, STATUS_LABELS } from '@/types';
import { useMemo } from 'react';

interface SourceDrawerProps {
  recordId: string;
  isOpen: boolean;
  onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  remarks: '备注',
  status: '状态',
  manualTag: '人工标记',
  roomType: '房型',
  checkInDate: '入住日期',
  checkOutDate: '退房日期',
};

export const SourceDrawer = ({ recordId, isOpen, onClose }: SourceDrawerProps) => {
  const allocations = useAllocationStore(state => state.allocations);
  const sourceTraces = useAllocationStore(state => state.sourceTraces);
  const changeLogs = useAllocationStore(state => state.changeLogs);

  const record = useMemo(() => 
    allocations.find(a => a.id === recordId),
    [allocations, recordId]
  );

  const sourceTrace = useMemo(() => 
    sourceTraces.find(t => t.recordId === recordId),
    [sourceTraces, recordId]
  );

  const recordChangeLogs = useMemo(() => 
    changeLogs
      .filter(l => l.recordId === recordId)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()),
    [changeLogs, recordId]
  );

  if (!record) return null;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 animate-fade-in"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-serif text-lg font-semibold text-gray-800">记录详情</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-64px)] p-4">
          <div className="space-y-6">
            <div className="card">
              <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-600" />
                基本信息
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">巡演名称</span>
                  <span className="font-medium">{record.tourName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">酒店名称</span>
                  <span className="font-medium">{record.hotelName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">房型</span>
                  <span className="font-medium">{record.roomType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">入住人</span>
                  <span className="font-medium">{record.personName || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">人员类型</span>
                  <span className="font-medium">
                    {PERSON_TYPE_LABELS[record.personType]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">入住日期</span>
                  <span className="font-medium">{record.checkInDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">退房日期</span>
                  <span className="font-medium">{record.checkOutDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">状态</span>
                  <span className={`badge ${
                    record.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    record.status === 'issue' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {STATUS_LABELS[record.status]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">备注</span>
                  <span className="font-medium text-right max-w-[60%]">
                    {record.remarks || '-'}
                  </span>
                </div>
                {record.manualTag && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">人工标记</span>
                    <span className="font-medium text-accent-600">{record.manualTag}</span>
                  </div>
                )}
              </div>
            </div>

            {sourceTrace && (
              <div className="card">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary-600" />
                  来源追溯
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">来源文件</span>
                    <span className="font-medium">{sourceTrace.fileName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      <User className="w-3.5 h-3.5 inline mr-1" />
                      导入人
                    </span>
                    <span className="font-medium">{sourceTrace.operator}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                      导入时间
                    </span>
                    <span className="font-medium">
                      {formatDateTime(sourceTrace.importedAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">数据来源</span>
                    <span className="font-medium">{record.source}</span>
                  </div>
                </div>
              </div>
            )}

            {recordChangeLogs.length > 0 && (
              <div className="card">
                <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary-600" />
                  变更历史
                </h4>
                <div className="space-y-3">
                  {recordChangeLogs.map((log, index) => (
                    <div
                      key={log.id}
                      className={`pl-3 border-l-2 ${
                        index === 0 ? 'border-primary-500' : 'border-gray-200'
                      }`}
                    >
                      <div className="text-xs text-gray-500 mb-1">
                        {log.operator} · {formatDateTime(log.changedAt)}
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">
                          {FIELD_LABELS[log.fieldName] || log.fieldName}
                        </span>
                        <span className="mx-2">→</span>
                        {log.oldValue && (
                          <span className="text-red-500 line-through mr-2">
                            {log.oldValue}
                          </span>
                        )}
                        <span className="text-green-600 font-medium">
                          {log.newValue || '(空)'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

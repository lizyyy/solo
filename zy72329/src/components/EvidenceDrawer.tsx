import { X, Clock, FileText, User, Upload, CheckCircle, GitBranch } from 'lucide-react';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import StatusBadge from './StatusBadge';
import { BillRecord, TeacherNote, SamplingList, EvidenceItem } from '../../shared/types';

interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  record?: BillRecord | null;
  teacherNote?: TeacherNote | null;
  samplingList?: SamplingList | null;
}

interface TimelineEvent {
  id: string;
  icon: typeof Clock;
  title: string;
  time: string;
  operator: string;
  source: string;
}

export default function EvidenceDrawer({
  open,
  onClose,
  record,
  teacherNote,
  samplingList,
}: EvidenceDrawerProps) {
  const { selectedRecord } = useAppStore();
  const displayRecord = record || selectedRecord;

  const timelineEvents: TimelineEvent[] = displayRecord
    ? [
        {
          id: 'import',
          icon: Upload,
          title: '数据导入',
          time: displayRecord.createdAt,
          operator: '系统导入',
          source: teacherNote?.importBatchId || samplingList?.importBatchId || '未知批次',
        },
        {
          id: 'match',
          icon: GitBranch,
          title: '数据匹配',
          time: displayRecord.updatedAt,
          operator: '系统自动',
          source: '基于记录编号匹配',
        },
        {
          id: 'process',
          icon: CheckCircle,
          title: '处理完成',
          time: displayRecord.updatedAt,
          operator: '系统',
          source: `状态: ${displayRecord.status}`,
        },
      ]
    : [];

  const evidenceItems: EvidenceItem[] = displayRecord
    ? [
        {
          id: 'record',
          type: '整合记录',
          source: '系统整合',
          content: `记录编号: ${displayRecord.recordNo}, 金额: ${displayRecord.amount}`,
          timestamp: displayRecord.createdAt,
          operator: '系统',
        },
        ...(teacherNote
          ? [
              {
                id: 'teacher',
                type: '老师批注',
                source: `导入批次: ${teacherNote.importBatchId}`,
                content: `批注: ${teacherNote.annotation}, 项目类型: ${teacherNote.itemType}`,
                timestamp: teacherNote.importedAt,
                operator: teacherNote.importedBy,
              },
            ]
          : []),
        ...(samplingList
          ? [
              {
                id: 'sampling',
                type: '抽样名单',
                source: `导入批次: ${samplingList.importBatchId}`,
                content: `场景描述: ${samplingList.sceneDescription}, 旧格式: ${samplingList.isOldFormat ? '是' : '否'}`,
                timestamp: samplingList.importedAt,
                operator: samplingList.importedBy,
              },
            ]
          : []),
      ]
    : [];

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50',
          'transform transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">证据链详情</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {displayRecord ? (
              <div className="p-6 space-y-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{displayRecord.recordNo}</h3>
                      <p className="text-sm text-gray-500">{displayRecord.teacherName}</p>
                    </div>
                    <StatusBadge status={displayRecord.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">日期：</span>
                      <span className="font-mono text-gray-800">{displayRecord.date}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">金额：</span>
                      <span className="font-mono text-gray-800">¥{displayRecord.amount.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">项目类型：</span>
                      <span className="text-gray-800">{displayRecord.itemType}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    时间线
                  </h3>
                  <div className="relative">
                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />
                    <div className="space-y-6">
                      {timelineEvents.map((event, index) => (
                        <div key={event.id} className="relative flex gap-4">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                              index === timelineEvents.length - 1
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-600'
                            )}
                          >
                            <event.icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{event.title}</span>
                              <span className="text-xs text-gray-400 font-mono">
                                {event.time}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                              <User className="w-3.5 h-3.5" />
                              <span>{event.operator}</span>
                            </div>
                            <div className="mt-1 text-xs text-gray-400">
                              来源：{event.source}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {teacherNote && (
                  <div className="border border-blue-200 rounded-xl overflow-hidden">
                    <div className="bg-blue-50 px-4 py-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">老师批注数据</span>
                    </div>
                    <div className="p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">批注内容</span>
                        <span className="text-gray-800 max-w-[60%] text-right">{teacherNote.annotation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">导入人</span>
                        <span className="text-gray-800">{teacherNote.importedBy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">导入时间</span>
                        <span className="text-gray-800 font-mono">{teacherNote.importedAt}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">来源批次</span>
                        <span className="text-gray-800 font-mono text-xs">{teacherNote.importBatchId}</span>
                      </div>
                    </div>
                  </div>
                )}

                {samplingList && (
                  <div className="border border-green-200 rounded-xl overflow-hidden">
                    <div className="bg-green-50 px-4 py-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">抽样名单数据</span>
                    </div>
                    <div className="p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">场景描述</span>
                        <span className="text-gray-800 max-w-[60%] text-right">{samplingList.sceneDescription}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">旧格式</span>
                        <span className="text-gray-800">{samplingList.isOldFormat ? '是' : '否'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">导入人</span>
                        <span className="text-gray-800">{samplingList.importedBy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">导入时间</span>
                        <span className="text-gray-800 font-mono">{samplingList.importedAt}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">来源批次</span>
                        <span className="text-gray-800 font-mono text-xs">{samplingList.importBatchId}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">来源追溯</h3>
                  <div className="space-y-2">
                    {evidenceItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-gray-50 rounded-lg text-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-700">{item.type}</span>
                          <span className="text-xs text-gray-400 font-mono">{item.timestamp}</span>
                        </div>
                        <p className="text-gray-600 text-xs">{item.content}</p>
                        <p className="text-gray-400 text-xs mt-1">
                          {item.source} · {item.operator}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>请选择一条记录查看详情</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { eventTypeLabels, parameterTypeLabels } from '@/types';
import RecordCard from '@/components/common/RecordCard';
import { 
  Clock, FileText, Droplets, ClipboardCheck, 
  AlertTriangle, ArrowRight, MessageSquare, Plus,
  ChevronDown, ChevronUp
} from 'lucide-react';

const eventIcons: Record<string, typeof Droplets> = {
  create: FileText,
  clean: Droplets,
  review: ClipboardCheck,
  drift: AlertTriangle,
  status_change: ArrowRight,
  note: MessageSquare,
};

const eventColors: Record<string, string> = {
  create: 'bg-ocean-500',
  clean: 'bg-nautical-success',
  review: 'bg-ocean-400',
  drift: 'bg-nautical-warning',
  status_change: 'bg-purple-500',
  note: 'bg-blue-400',
};

export default function Handover() {
  const { records, getRecordTimeline } = useAppStore();
  const [selectedRecordId, setSelectedRecordId] = useState<string>('rec-002');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const selectedRecord = records.find((r) => r.id === selectedRecordId);
  const timelineEvents = selectedRecord ? getRecordTimeline(selectedRecord.id) : [];

  const toggleEventExpand = (eventId: string) => {
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-80 border-r border-ocean-700 flex flex-col bg-ocean-900/30">
        <div className="p-4 border-b border-ocean-700">
          <h2 className="text-lg font-semibold text-white">选择交接记录</h2>
          <p className="text-sm text-ocean-400 mt-1">点击查看处理时间线</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {records.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              selected={selectedRecordId === record.id}
              onClick={() => setSelectedRecordId(record.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-ocean-900/80 backdrop-blur border-b border-ocean-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="w-6 h-6 text-nautical-warning" />
                交接时间线
              </h1>
              <p className="text-sm text-ocean-400 mt-0.5">
                船上记录本原话 → 处理历史 → 结论推导
              </p>
            </div>
            {selectedRecord && (
              <div className="text-right">
                <p className="text-sm text-ocean-400">当前记录</p>
                <p className="text-white font-mono">{selectedRecord.recordNo}</p>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {selectedRecord && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="paper-texture tape-corner rounded-xl p-6 relative transform rotate-[-0.3deg] shadow-xl animate-slide-in-up">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-amber-800/50 mb-1">船上记录本原话</p>
                    <p className="text-lg font-bold text-amber-900">
                      {selectedRecord.recordNo}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-800/50">
                      {selectedRecord.measureDate}
                    </p>
                    <p className="text-sm text-amber-800/70">
                      {selectedRecord.shipName}
                    </p>
                  </div>
                </div>

                <div className="bg-amber-100/50 rounded-lg p-4 mb-4">
                  <p className="text-amber-900 leading-relaxed handwriting text-base">
                    "{selectedRecord.originalNote}"
                  </p>
                </div>

                {selectedRecord.hasSupplementaryNote && (
                  <div className="pl-4 border-l-2 border-amber-500/50">
                    <p className="text-xs text-amber-600 mb-1 flex items-center gap-1">
                      <Plus className="w-3 h-3" />
                      后补备注
                    </p>
                    <p className="text-sm text-amber-800 italic">
                      "{selectedRecord.supplementaryNote}"
                    </p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-amber-300/50 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-amber-800/70">
                      点位：{selectedRecord.location}
                    </span>
                    <span className="text-amber-800/70">
                      参数：{parameterTypeLabels[selectedRecord.parameterType]}
                    </span>
                  </div>
                  <span className="text-amber-800/70 font-mono">
                    {selectedRecord.measureTime}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-ocean-600" />
                <FileText className="w-5 h-5 text-ocean-500" />
                <span className="text-sm text-ocean-500">处理时间线</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-ocean-600" />
              </div>

              <div className="relative pl-8">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gradient-to-b from-ocean-500 via-ocean-600 to-ocean-700" />

                {timelineEvents.map((event, index) => {
                  const Icon = eventIcons[event.eventType] || FileText;
                  const isExpanded = expandedEventId === event.id;
                  const isLast = index === timelineEvents.length - 1;

                  return (
                    <div
                      key={event.id}
                      className={`relative mb-6 ${isLast ? 'mb-0' : ''}`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className={`absolute -left-5 w-10 h-10 rounded-full flex items-center justify-center border-4 border-ocean-950 ${eventColors[event.eventType]}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>

                      <div
                        className="ml-8 bg-ocean-800/50 border border-ocean-700 rounded-xl overflow-hidden cursor-pointer hover:border-ocean-600 transition-colors"
                        onClick={() => toggleEventExpand(event.id)}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-white font-semibold flex items-center gap-2">
                              {eventTypeLabels[event.eventType]}
                              <span className="text-xs font-normal text-ocean-500 bg-ocean-700/50 px-2 py-0.5 rounded">
                                {event.operator}
                              </span>
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-ocean-500 font-mono">
                                {formatTime(event.eventTime)}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-ocean-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-ocean-500" />
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-ocean-300">
                            {event.description}
                          </p>
                        </div>

                        {isExpanded && event.detail && (
                          <div className="px-4 pb-4">
                            <div className="bg-ocean-900/50 rounded-lg p-4 border border-ocean-700/50">
                              <p className="text-xs text-ocean-500 mb-2">事件详情</p>
                              <div className="space-y-1">
                                {Object.entries(event.detail).map(([key, value]) => (
                                  <div key={key} className="flex items-center justify-between text-sm">
                                    <span className="text-ocean-400">
                                      {key === 'rawValue' && '原始数值'}
                                      {key === 'source' && '数据来源'}
                                      {key === 'driftAmount' && '漂移量'}
                                      {key === 'stepsCompleted' && '完成步骤'}
                                      {key === 'decision' && '决策'}
                                      {key === 'reason' && '决策理由'}
                                      {key === 'supplementaryNote' && '备注内容'}
                                      {key === 'from' && '原状态'}
                                      {key === 'to' && '新状态'}
                                      {key === 'missingEvidence' && '缺失证据'}
                                      {!['rawValue', 'source', 'driftAmount', 'stepsCompleted', 'decision', 'reason', 'supplementaryNote', 'from', 'to', 'missingEvidence'].includes(key) && key}
                                    </span>
                                    <span className="text-ocean-200 font-mono">
                                      {Array.isArray(value) ? value.join(', ') : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-8">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-nautical-warning/50" />
                <ClipboardCheck className="w-5 h-5 text-nautical-warning" />
                <span className="text-sm text-nautical-warning">结论推导链路</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-nautical-warning/50" />
              </div>

              <div className="bg-ocean-800/30 rounded-xl border border-ocean-700 p-6">
                <h4 className="text-white font-semibold mb-4">处理结论</h4>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-ocean-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-white font-bold">1</span>
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">原始数据采集</p>
                      <p className="text-sm text-ocean-400">
                        {selectedRecord.shipName} 于 {selectedRecord.measureDate} 在 {selectedRecord.location} 采集 {parameterTypeLabels[selectedRecord.parameterType]} 数据，原始值 {selectedRecord.rawValue.toFixed(2)} {selectedRecord.unit}
                      </p>
                    </div>
                  </div>

                  <div className="w-px h-6 bg-ocean-700 ml-[11px]" />

                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      selectedRecord.hasDrift ? 'bg-nautical-warning' : 'bg-ocean-600'
                    }`}>
                      <span className="text-xs text-white font-bold">2</span>
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">数据清洗处理</p>
                      <p className="text-sm text-ocean-400">
                        经过5步清洗流程，最终结果 {selectedRecord.cleanedValue.toFixed(2)} {selectedRecord.unit}
                        {selectedRecord.hasDrift && '，检测到传感器漂移已校正'}
                      </p>
                    </div>
                  </div>

                  <div className="w-px h-6 bg-ocean-700 ml-[11px]" />

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-ocean-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-white font-bold">3</span>
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">状态判定</p>
                      <p className="text-sm text-ocean-400">
                        当前状态：
                        <span className={`ml-1 ${
                          selectedRecord.status === 'confirmed' ? 'text-nautical-success' :
                          selectedRecord.status === 'returned' ? 'text-nautical-danger' :
                          selectedRecord.status === 'supplement' ? 'text-nautical-warning' :
                          'text-ocean-300'
                        }`}>
                          {selectedRecord.status === 'confirmed' ? '已确认通过' :
                           selectedRecord.status === 'returned' ? '退回重测' :
                           selectedRecord.status === 'supplement' ? '待补充证据' :
                           '待处理'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {selectedRecord.missingEvidence.length > 0 && (
                    <>
                      <div className="w-px h-6 bg-ocean-700 ml-[11px]" />
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-nautical-warning flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs text-white font-bold">!</span>
                        </div>
                        <div>
                          <p className="text-sm text-nautical-warning font-medium">待补充事项</p>
                          <ul className="text-sm text-ocean-400 list-disc list-inside">
                            {selectedRecord.missingEvidence.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

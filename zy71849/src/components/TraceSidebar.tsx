import { X, ArrowRight, Clock, User, FileText, PenTool, UserEdit } from 'lucide-react';
import { useAppStore } from '@/store';
import {
  SIGHT_STATUS_LABELS,
  TRACE_SOURCE_LABELS,
  FLIP_TYPE_LABELS,
} from '@/types';
import { formatChangeSummary, formatCoordinateDiff } from '@/utils/historyTracker';

export default function TraceSidebar() {
  const { selectedRecord, traceChain, selectRecord, remarkHistories, loadRemarkHistories } = useAppStore();

  if (!selectedRecord) return null;

  const statusBadgeClass = {
    confirmed: 'badge-confirmed',
    pending: 'badge-pending',
    'manual-modified': 'badge-manual',
    'flip-detected': 'badge-flip',
  }[selectedRecord.status];

  const sourceIcon = {
    'device-remark': FileText,
    'cad-point': PenTool,
    'manual-input': UserEdit,
  }[selectedRecord.traceSource];

  const SourceIcon = sourceIcon || FileText;

  const handleLoadHistory = (remarkId: string) => {
    if (!remarkHistories[remarkId]) {
      loadRemarkHistories(remarkId);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-xl animate-slide-in-right z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h3 className="font-serif text-lg font-semibold text-slate-800">追溯链路</h3>
        <button
          onClick={() => selectRecord(null)}
          className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-medium text-slate-800">{selectedRecord.deviceName}</h4>
              <p className="text-sm text-slate-500 mt-0.5">{selectedRecord.deviceCode}</p>
            </div>
            <span className={`badge ${statusBadgeClass}`}>
              {SIGHT_STATUS_LABELS[selectedRecord.status]}
            </span>
          </div>

          <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
            {selectedRecord.conclusion}
          </p>

          {selectedRecord.sightValue > 0 && (
            <div className="mt-3 flex items-center gap-4">
              <div>
                <p className="text-xs text-slate-500">视线值</p>
                <p className="text-xl font-semibold text-primary-700">
                  {selectedRecord.sightValue.toFixed(1)}%
                </p>
              </div>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-confirmed rounded-full transition-all duration-500"
                  style={{ width: `${selectedRecord.sightValue}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <SourceIcon className="w-4 h-4" />
            <span>数据来源：{TRACE_SOURCE_LABELS[selectedRecord.traceSource]}</span>
          </div>

          {selectedRecord.isManualModified && (
            <div className="mt-3 p-3 bg-red-50 rounded-md border border-red-100">
              <p className="text-sm text-red-700 font-medium">已人工修改</p>
              <p className="text-xs text-red-600 mt-1">
                修改人：{selectedRecord.manualModifier}
              </p>
              <p className="text-xs text-red-600 mt-1">
                修改原因：{selectedRecord.manualReason}
              </p>
            </div>
          )}
        </div>

        <div className="p-4">
          <h5 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            追溯路径
          </h5>

          {traceChain && (
            <div className="space-y-4">
              {traceChain.links.map((link, index) => (
                <div key={index} className="relative">
                  {index < traceChain.links.length - 1 && (
                    <div className="absolute left-5 top-12 bottom-0 w-px bg-slate-200" />
                  )}

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                      {link.type === 'device-remark' && <FileText className="w-5 h-5 text-primary-600" />}
                      {link.type === 'cad-point' && <PenTool className="w-5 h-5 text-primary-600" />}
                      {link.type === 'manual-input' && <UserEdit className="w-5 h-5 text-primary-600" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">
                        {TRACE_SOURCE_LABELS[link.type]}
                      </p>

                      {link.data && 'deviceCode' in link.data && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-md text-sm">
                          <p className="font-medium text-slate-700">{link.data.deviceCode}</p>
                          <p className="text-slate-600 mt-1">{link.data.content}</p>
                          <div className="flex gap-4 mt-2 text-xs text-slate-500">
                            <span>X: {link.data.coordinate.x}</span>
                            <span>Y: {link.data.coordinate.y}</span>
                            <span>Z: {link.data.coordinate.z}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                            <User className="w-3 h-3" />
                            <span>{link.data.modifier}</span>
                            <Clock className="w-3 h-3 ml-2" />
                            <span>{new Date(link.data.modifiedAt).toLocaleString('zh-CN')}</span>
                          </div>

                          <button
                            onClick={() => handleLoadHistory(link.data!.id)}
                            className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            查看修改历史 →
                          </button>

                          {remarkHistories[link.data.id] && remarkHistories[link.data.id].length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                              <p className="text-xs font-medium text-slate-500">修改历史</p>
                              {remarkHistories[link.data.id].map((history, hIndex) => (
                                <div key={hIndex} className="timeline-item">
                                  <div className="timeline-dot active" />
                                  <p className="text-xs text-slate-500">
                                    <span className="font-medium text-slate-700">{history.modifier}</span>
                                    {' · '}
                                    {new Date(history.modifiedAt).toLocaleString('zh-CN')}
                                  </p>
                                  <p className="text-xs text-slate-600 mt-1">
                                    修改：{formatChangeSummary(history)}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    原因：{history.changeReason}
                                  </p>
                                  {(() => {
                                    const diff = formatCoordinateDiff(history);
                                    const hasCoordChange = diff.x.changed || diff.y.changed || diff.z.changed;
                                    if (!hasCoordChange) return null;
                                    return (
                                      <div className="mt-2 text-xs font-mono bg-white p-2 rounded border border-slate-200">
                                        {['x', 'y', 'z'].map((axis) => {
                                          const axisDiff = diff[axis as keyof typeof diff];
                                          if (!axisDiff.changed) return null;
                                          return (
                                            <div key={axis} className="text-red-600">
                                              {axis.toUpperCase()}: {axisDiff.oldValue} → <span className="text-green-600">{axisDiff.newValue}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {link.data && 'pointCode' in link.data && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-md text-sm">
                          <p className="font-medium text-slate-700">{link.data.pointCode}</p>
                          <p className="text-slate-600 mt-1">{link.data.pointName}</p>
                          <div className="flex gap-4 mt-2 text-xs text-slate-500">
                            <span>X: {link.data.x}</span>
                            <span>Y: {link.data.y}</span>
                            <span>Z: {link.data.z}</span>
                          </div>
                          {link.data.hasFlip && (
                            <div className="mt-2 p-2 bg-purple-50 rounded text-xs text-purple-700 border border-purple-100">
                              <p className="font-medium">
                                检测到 {FLIP_TYPE_LABELS[link.data.flipType || 'none']}
                              </p>
                              <p className="mt-1">来源：{link.data.flipSource === 'cad-point' ? 'CAD点位' : '设备备注'}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                            <User className="w-3 h-3" />
                            <span>{link.data.importer}</span>
                            <Clock className="w-3 h-3 ml-2" />
                            <span>{new Date(link.data.importedAt).toLocaleString('zh-CN')}</span>
                          </div>
                        </div>
                      )}

                      {link.type === 'manual-input' && (
                        <div className="mt-2 p-3 bg-red-50 rounded-md text-sm border border-red-100">
                          <p className="font-medium text-red-700">人工输入记录</p>
                          {link.history && link.history.length > 0 && (
                            <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap">
                              {JSON.stringify(link.history[0], null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

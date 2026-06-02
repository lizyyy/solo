import { useState } from 'react';
import { X, CheckCircle, AlertTriangle, GitMerge, FileText, Clock, MapPin, User, AlertCircle, RotateCcw, StickyNote } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { statusLabels, statusColors, sourceLabels, sourceColors, actionLabels } from '@/types';
import { formatDateTime } from '@/utils/algorithm';

export default function BusStopDetail() {
  const {
    busStops,
    selectedBusStopId,
    setSelectedBusStop,
    confirmBusStop,
    markAsException,
    mergeBusStops,
    unmergeBusStop,
    addNote,
    getDataSourceByBusStopId,
    getProcessRecordsByBusStopId,
  } = useStore();

  const [remark, setRemark] = useState('');
  const [showRemarkInput, setShowRemarkInput] = useState(false);
  const [noteText, setNoteText] = useState('');

  const busStop = busStops.find((b) => b.id === selectedBusStopId);
  const dataSources = busStop ? getDataSourceByBusStopId(busStop.id) : [];
  const processRecords = busStop ? getProcessRecordsByBusStopId(busStop.id) : [];

  const mergeTargets = busStop?.mergeSuggestions?.map((s) => ({
    ...s,
    target: busStops.find((b) => b.id === s.targetId),
  })).filter((s) => s.target && s.target.status !== 'merged');

  const mergedTarget = busStop?.mergedIntoId
    ? busStops.find((b) => b.id === busStop.mergedIntoId)
    : null;

  const mergedStops = busStop?.mergedIds
    ?.map((id) => busStops.find((b) => b.id === id))
    .filter(Boolean);

  if (!busStop) {
    return (
      <div className="w-96 bg-white border-l border-slate-200 flex items-center justify-center">
        <div className="text-center text-slate-500 p-8">
          <MapPin className="w-16 h-16 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">点击地图上的点位或从列表选择</p>
          <p className="text-xs text-slate-400 mt-1">查看详细信息和处理记录</p>
        </div>
      </div>
    );
  }

  const handleConfirm = () => {
    confirmBusStop(busStop.id, remark || undefined);
    setRemark('');
    setShowRemarkInput(false);
  };

  const handleMarkException = () => {
    markAsException(busStop.id, remark || undefined);
    setRemark('');
    setShowRemarkInput(false);
  };

  const handleMerge = (targetId: string) => {
    mergeBusStops(busStop.id, targetId, remark || undefined);
    setRemark('');
    setShowRemarkInput(false);
  };

  const handleUnmerge = () => {
    unmergeBusStop(busStop.id);
  };

  const handleAddNote = () => {
    if (noteText.trim()) {
      addNote(busStop.id, noteText.trim());
      setNoteText('');
    }
  };

  return (
    <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-800">
              {busStop.name || '未命名站点'}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="px-2 py-0.5 text-xs rounded-full"
              style={{
                backgroundColor: `${statusColors[busStop.status]}15`,
                color: statusColors[busStop.status],
              }}
            >
              {statusLabels[busStop.status]}
            </span>
            {busStop.needsReview && (
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                <AlertCircle className="w-3 h-3" /> 待人工确认
              </span>
            )}
            {busStop.isBoundary && (
              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                边界记录
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setSelectedBusStop(null)}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-slate-100">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">基本信息</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-slate-700">{busStop.address || '暂无地址'}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  坐标: {busStop.lat.toFixed(4)}, {busStop.lng.toFixed(4)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">标准化名称:</span>
              <span className="text-sm text-slate-700">{busStop.standardizedName || '-'}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">数据来源</h4>
          <div className="space-y-2">
            {dataSources.map((ds) => (
              <div
                key={ds.id}
                className="p-3 bg-slate-50 rounded-lg border border-slate-100"
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span
                    className="px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: `${sourceColors[ds.type]}15`,
                      color: sourceColors[ds.type],
                    }}
                  >
                    {sourceLabels[ds.type]}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  原始名称: {ds.rawName || '(空)'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {ds.fileName} · {formatDateTime(ds.importedAt)}
                </div>
                {Object.keys(ds.rawData).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <div className="text-xs text-slate-500 mb-1">原始数据:</div>
                    <div className="text-xs text-slate-600 font-mono bg-white p-2 rounded border border-slate-200 max-h-24 overflow-y-auto">
                      {JSON.stringify(ds.rawData, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {busStop.notes && (
          <div className="p-4 border-b border-slate-100">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">备注</h4>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-800">
              {busStop.notes}
            </div>
          </div>
        )}

        {mergedTarget && (
          <div className="p-4 border-b border-slate-100 bg-violet-50">
            <h4 className="text-xs font-semibold text-violet-600 uppercase mb-2">已归并到</h4>
            <div className="flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-medium text-violet-700">{mergedTarget.name}</span>
            </div>
            <button
              onClick={handleUnmerge}
              className="mt-2 flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800"
            >
              <RotateCcw className="w-3 h-3" /> 取消归并
            </button>
          </div>
        )}

        {mergedStops && mergedStops.length > 0 && (
          <div className="p-4 border-b border-slate-100 bg-emerald-50">
            <h4 className="text-xs font-semibold text-emerald-600 uppercase mb-2">已归并的点位</h4>
            <div className="space-y-1">
              {mergedStops.map((stop) => (
                <div key={stop?.id} className="flex items-center gap-2 text-sm text-emerald-700">
                  <GitMerge className="w-3 h-3" />
                  {stop?.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {mergeTargets && mergeTargets.length > 0 && busStop.status !== 'merged' && (
          <div className="p-4 border-b border-slate-100 bg-amber-50">
            <h4 className="text-xs font-semibold text-amber-600 uppercase mb-3">
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> 相似点位推荐
              </span>
            </h4>
            <div className="space-y-2">
              {mergeTargets.map((suggestion) => (
                <div
                  key={suggestion.targetId}
                  className="p-3 bg-white rounded-lg border border-amber-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-800">{suggestion.target?.name}</span>
                    <span className="text-xs text-amber-600 font-medium">
                      {(suggestion.similarity * 100).toFixed(0)}% 相似
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">
                    距离: {suggestion.distance.toFixed(1)} 米 · {suggestion.reason}
                  </div>
                  <button
                    onClick={() => handleMerge(suggestion.targetId)}
                    className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded transition-colors"
                  >
                    归并到此点位
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">处理记录</h4>
          <div className="space-y-3">
            {processRecords.map((record, index) => (
              <div key={record.id} className="relative pl-4">
                {index < processRecords.length - 1 && (
                  <div className="absolute left-[7px] top-5 bottom-0 w-0.5 bg-slate-200" />
                )}
                <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-slate-300 border-2 border-white" />
                <div className="text-sm">
                  <div className="font-medium text-slate-700">
                    {actionLabels[record.action]}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <User className="w-3 h-3" /> {record.operator}
                  </div>
                  {record.remark && (
                    <div className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded">
                      {record.remark}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                    <Clock className="w-3 h-3" /> {formatDateTime(record.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {busStop.status !== 'merged' && (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          {!showRemarkInput ? (
            <div className="grid grid-cols-2 gap-2">
              {busStop.status !== 'confirmed' && (
                <button
                  onClick={() => setShowRemarkInput(true)}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors"
                >
                  <CheckCircle className="w-4 h-4" /> 确认
                </button>
              )}
              {busStop.status !== 'exception' && (
                <button
                  onClick={() => {
                    setShowRemarkInput(true);
                    setRemark('标记为例外');
                  }}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" /> 例外
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="添加备注(可选)..."
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={remark.includes('例外') ? handleMarkException : handleConfirm}
                  className="py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                >
                  确认操作
                </button>
                <button
                  onClick={() => {
                    setShowRemarkInput(false);
                    setRemark('');
                  }}
                  className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <StickyNote className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">添加备注</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="输入备注内容..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm rounded transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

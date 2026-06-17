import { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  MapPin, 
  User,
  FileText,
  Lightbulb,
  ChevronRight,
  Info
} from 'lucide-react';
import { useAppStore } from '@/store';
import { SourceType } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import SourceBadge from '@/components/SourceBadge';
import { mergeEngine } from '@/utils/mergeEngine';
import { formatDateTime, highlightConflicts } from '@/utils/stringUtils';
import { formatDistance } from '@/utils/geoUtils';
import { haversineDistance } from '@/utils/geoUtils';
import { cn } from '@/utils/cn';

export default function ReviewPage() {
  const { 
    getPendingReviewPoints, 
    getPhotoUrl,
    confirmMerge,
    rejectMerge,
    createNewPointFromSource,
    splitSourceFromPoint,
    operator,
  } = useAppStore();

  const pendingPoints = getPendingReviewPoints();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [reviewReason, setReviewReason] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState<'confirm' | 'reject' | 'split' | 'new' | null>(null);

  const currentPoint = pendingPoints[selectedIndex];

  const getPendingSources = () => {
    if (!currentPoint) return [];
    return currentPoint.sources.filter(s => s.confidence < 0.9);
  };

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  
  const selectedSource = currentPoint?.sources.find(s => s.id === selectedSourceId) || getPendingSources()[0];

  const handleConfirmMerge = async () => {
    if (!currentPoint || !selectedSource) return;
    const reason = reviewReason || `人工确认归并：${selectedSource.sourceName} → ${currentPoint.canonicalName}`;
    await confirmMerge(currentPoint.id, selectedSource.id, reason);
    setReviewReason('');
    setShowConfirmModal(null);
    if (pendingPoints.length > 0 && selectedIndex >= pendingPoints.length) {
      setSelectedIndex(Math.max(0, pendingPoints.length - 1));
    }
  };

  const handleRejectMerge = async () => {
    if (!currentPoint || !selectedSource) return;
    const reason = reviewReason || '人工驳回归并';
    await rejectMerge(currentPoint.id, selectedSource.id, reason);
    setReviewReason('');
    setShowConfirmModal(null);
    if (pendingPoints.length > 0 && selectedIndex >= pendingPoints.length) {
      setSelectedIndex(Math.max(0, pendingPoints.length - 1));
    }
  };

  const handleCreateNewPoint = async () => {
    if (!selectedSource) return;
    await createNewPointFromSource(selectedSource.id);
    setShowConfirmModal(null);
    setSelectedIndex(0);
  };

  const handleSplitSource = async () => {
    if (!currentPoint || !selectedSource) return;
    await splitSourceFromPoint(currentPoint.id, selectedSource.id);
    setShowConfirmModal(null);
    if (pendingPoints.length > 0 && selectedIndex >= pendingPoints.length) {
      setSelectedIndex(Math.max(0, pendingPoints.length - 1));
    }
  };

  const getSuggestedActions = () => {
    if (!currentPoint || !selectedSource) return [];

    const candidates = mergeEngine.findMergeCandidates(selectedSource, pendingPoints);
    if (candidates.length === 0) return [];

    return mergeEngine.getSuggestedActions(candidates[0]);
  };

  const getConflictInfo = () => {
    if (!currentPoint) return null;
    return mergeEngine.detectConflicts(currentPoint);
  };

  const conflicts = getConflictInfo();
  const suggestedActions = getSuggestedActions();

  if (pendingPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <CheckCircle size={64} className="mx-auto mb-4 text-success-400" />
          <h3 className="text-xl font-serif font-semibold text-neutral-800 mb-2">所有数据已复核完成</h3>
          <p className="text-neutral-500">当前没有待复核的点位</p>
        </div>
      </div>
    );
  }

  if (!currentPoint) return null;

  const gisSource = currentPoint.sources.find(s => s.sourceType === SourceType.GIS);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-sm px-3 py-2">
            <span className="text-sm text-neutral-500">待复核</span>
            <span className="text-lg font-bold text-primary-600">{pendingPoints.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
              disabled={selectedIndex === 0}
              className="p-2 border border-neutral-200 rounded-sm hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={18} className="rotate-180 text-neutral-600" />
            </button>
            <span className="text-sm text-neutral-600 w-20 text-center">
              {selectedIndex + 1} / {pendingPoints.length}
            </span>
            <button
              onClick={() => setSelectedIndex(Math.min(pendingPoints.length - 1, selectedIndex + 1))}
              disabled={selectedIndex === pendingPoints.length - 1}
              className="p-2 border border-neutral-200 rounded-sm hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={18} className="text-neutral-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="card p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={currentPoint.status} />
                  <span className="text-xs text-neutral-500">{currentPoint.street}</span>
                </div>
                <h3 className="text-lg font-serif font-semibold text-neutral-800">
                  {currentPoint.canonicalName}
                </h3>
                <p className="text-sm text-neutral-600 mt-1">{currentPoint.address}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-500 mb-1">置信度分布</div>
                <div className="flex gap-1">
                  {currentPoint.sources.map(s => (
                    <div
                      key={s.id}
                      className={cn(
                        'w-8 h-2 rounded-sm',
                        s.confidence >= 0.9 ? 'bg-success-500' :
                        s.confidence >= 0.7 ? 'bg-warning-500' : 'bg-danger-500'
                      )}
                      title={`${s.sourceName}: ${(s.confidence * 100).toFixed(0)}%`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {conflicts && conflicts.length > 0 && (
              <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-sm">
                <div className="flex items-center gap-2 text-danger-700 font-medium text-sm mb-2">
                  <AlertTriangle size={16} />
                  检测到 {conflicts.length} 个数据冲突
                </div>
                {conflicts.map((conflict, idx) => (
                  <div key={idx} className="text-sm text-danger-600 mb-1 last:mb-0">
                    • {conflict.description}
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-neutral-500">
              <span className="text-neutral-700 font-medium">归并依据：</span>
              {currentPoint.mergeReason}
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
            <div className="card flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-200 bg-primary-50">
                <div className="flex items-center gap-2">
                  {gisSource && <SourceBadge type={gisSource.sourceType} />}
                  <span className="font-medium text-primary-700 text-sm">GIS标准数据</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {gisSource ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-neutral-500 mb-1">标准名称</div>
                      <div className="font-medium text-neutral-800">{gisSource.sourceName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-500 mb-1">坐标</div>
                      <div className="text-sm text-neutral-700 font-mono">
                        {gisSource.rawData.coordinates 
                          ? `${gisSource.rawData.coordinates[1].toFixed(6)}, ${gisSource.rawData.coordinates[0].toFixed(6)}`
                          : `${gisSource.rawData.lat?.toFixed(6)}, ${gisSource.rawData.lng?.toFixed(6)}`
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-500 mb-1">操作人</div>
                      <div className="text-sm text-neutral-700">{gisSource.operator}</div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-500 mb-1">导入时间</div>
                      <div className="text-sm text-neutral-700">{formatDateTime(gisSource.importedAt)}</div>
                    </div>
                    <div className="pt-2 border-t border-neutral-100">
                      <div className="text-xs text-neutral-500 mb-1">原始数据</div>
                      <pre className="text-xs bg-neutral-50 p-2 rounded-sm overflow-x-auto text-neutral-600">
                        {JSON.stringify(gisSource.rawData, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-neutral-400">
                    <MapPin size={32} className="mx-auto mb-2" />
                    <p>暂无GIS数据</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-200 bg-warning-50">
                <div className="flex items-center gap-2">
                  {selectedSource && <SourceBadge type={selectedSource.sourceType} />}
                  <span className="font-medium text-warning-700 text-sm">待复核来源数据</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {selectedSource ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-neutral-500">选择待复核来源</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {getPendingSources().map(source => (
                        <button
                          key={source.id}
                          onClick={() => setSelectedSourceId(source.id)}
                          className={cn(
                            'px-2.5 py-1.5 text-xs rounded-sm border transition-all',
                            selectedSourceId === source.id || (!selectedSourceId && source.id === getPendingSources()[0]?.id)
                              ? 'bg-warning-500 text-white border-warning-500'
                              : 'bg-white text-neutral-600 border-neutral-200 hover:border-warning-300'
                          )}
                        >
                          {source.sourceName.slice(0, 8)}...
                        </button>
                      ))}
                    </div>

                    <div className="divider my-2" />

                    <div>
                      <div className="text-xs text-neutral-500 mb-1">来源名称</div>
                      <div 
                        className="font-medium text-neutral-800"
                        dangerouslySetInnerHTML={{
                          __html: gisSource 
                            ? highlightConflicts(selectedSource.sourceName, gisSource.sourceName).text1
                            : selectedSource.sourceName
                        }}
                      />
                    </div>

                    {selectedSource.photoUrl && (
                      <div>
                        <div className="text-xs text-neutral-500 mb-1">巡检照片</div>
                        <img
                          src={getPhotoUrl(selectedSource.photoUrl)}
                          alt={selectedSource.sourceName}
                          className="w-full h-36 object-cover rounded-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE0NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+5Zu+54mH5Liq5aSx6LSlPC90ZXh0Pjwvc3ZnPg==';
                          }}
                        />
                      </div>
                    )}

                    {(selectedSource.rawData.exifLat || selectedSource.rawData.lat) && (
                      <div>
                        <div className="text-xs text-neutral-500 mb-1">坐标
                          {gisSource && (
                            <span className="text-warning-600 ml-2">
                              距离GIS: {formatDistance(haversineDistance(
                                gisSource.rawData.coordinates?.[1] ?? gisSource.rawData.lat,
                                gisSource.rawData.coordinates?.[0] ?? gisSource.rawData.lng,
                                selectedSource.rawData.exifLat ?? selectedSource.rawData.lat,
                                selectedSource.rawData.exifLng ?? selectedSource.rawData.lng
                              ))}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-neutral-700 font-mono">
                          {(selectedSource.rawData.exifLat ?? selectedSource.rawData.lat)?.toFixed(6)}, 
                          {(selectedSource.rawData.exifLng ?? selectedSource.rawData.lng)?.toFixed(6)}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs text-neutral-500 mb-1">匹配置信度</div>
                      <div className="w-full bg-neutral-200 rounded-sm h-2">
                        <div
                          className={cn(
                            'h-full rounded-sm transition-all',
                            selectedSource.confidence >= 0.9 ? 'bg-success-500' :
                            selectedSource.confidence >= 0.7 ? 'bg-warning-500' : 'bg-danger-500'
                          )}
                          style={{ width: `${selectedSource.confidence * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-right text-neutral-500 mt-1">
                        {(selectedSource.confidence * 100).toFixed(0)}%
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-100">
                      <div className="text-xs text-neutral-500 mb-1">原始数据</div>
                      <pre className="text-xs bg-neutral-50 p-2 rounded-sm overflow-x-auto text-neutral-600">
                        {JSON.stringify(selectedSource.rawData, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-neutral-400">
                    <FileText size={32} className="mx-auto mb-2" />
                    <p>暂无待复核数据</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 flex flex-col gap-4">
          {suggestedActions.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 text-primary-600 font-medium text-sm mb-3">
                <Lightbulb size={16} />
                建议动作
              </div>
              <div className="space-y-2">
                {suggestedActions.map((action, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'p-3 rounded-sm border text-sm',
                      action.priority === 'high' ? 'bg-success-50 border-success-200' :
                      action.priority === 'medium' ? 'bg-warning-50 border-warning-200' :
                      'bg-neutral-50 border-neutral-200'
                    )}
                  >
                    <div className="font-medium text-neutral-800 mb-1">{action.action}</div>
                    <div className="text-xs text-neutral-600">{action.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-4 flex-1 flex flex-col">
            <div className="font-medium text-neutral-800 text-sm mb-3">复核判定</div>
            
            <div className="mb-4">
              <label className="block text-xs text-neutral-500 mb-1.5">复核理由（记入操作日志）</label>
              <textarea
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder="请输入复核理由..."
                className="input h-20 resize-none"
              />
            </div>

            <div className="space-y-2 mt-auto">
              {selectedSource && (
                <>
                  <button
                    onClick={() => setShowConfirmModal('confirm')}
                    className="w-full btn-success flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} />
                    确认归并
                  </button>
                  <button
                    onClick={() => setShowConfirmModal('new')}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    <ArrowRight size={16} />
                    作为新点位
                  </button>
                  <button
                    onClick={() => setShowConfirmModal('split')}
                    className="w-full btn-secondary flex items-center justify-center gap-2"
                  >
                    <ArrowRight size={16} />
                    拆分为独立点位
                  </button>
                  <button
                    onClick={() => setShowConfirmModal('reject')}
                    className="w-full btn-danger flex items-center justify-center gap-2"
                  >
                    <XCircle size={16} />
                    驳回归并
                  </button>
                </>
              )}
              {!selectedSource && getPendingSources().length === 0 && (
                <button
                  onClick={() => setShowConfirmModal('confirm')}
                  className="w-full btn-success flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} />
                  确认点位无误
                </button>
              )}
              <div className="divider my-2" />
              <button
                onClick={() => {
                  setSelectedIndex(Math.min(pendingPoints.length - 1, selectedIndex + 1));
                  setReviewReason('');
                }}
                className="w-full btn-default flex items-center justify-center gap-2"
              >
                跳过，下一条
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-200">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <User size={12} />
                操作人: {operator}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-sm shadow-lg w-96 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                showConfirmModal === 'confirm' && 'bg-success-100',
                showConfirmModal === 'reject' && 'bg-danger-100',
                (showConfirmModal === 'new' || showConfirmModal === 'split') && 'bg-primary-100'
              )}>
                {showConfirmModal === 'confirm' && <CheckCircle size={20} className="text-success-600" />}
                {showConfirmModal === 'reject' && <XCircle size={20} className="text-danger-600" />}
                {(showConfirmModal === 'new' || showConfirmModal === 'split') && <Info size={20} className="text-primary-600" />}
              </div>
              <div>
                <h4 className="font-medium text-neutral-800">
                  {showConfirmModal === 'confirm' && '确认归并'}
                  {showConfirmModal === 'reject' && '驳回归并'}
                  {showConfirmModal === 'new' && '创建新点位'}
                  {showConfirmModal === 'split' && '拆分为独立点位'}
                </h4>
                <p className="text-sm text-neutral-500">此操作将记入操作日志</p>
              </div>
            </div>

            <div className="bg-neutral-50 p-3 rounded-sm text-sm text-neutral-600 mb-4">
              {showConfirmModal === 'confirm' && `将「${selectedSource?.sourceName}」归并到「${currentPoint.canonicalName}」`}
              {showConfirmModal === 'reject' && `驳回「${selectedSource?.sourceName}」的归并，将从点位中移除`}
              {showConfirmModal === 'new' && `将「${selectedSource?.sourceName}」创建为独立的新点位`}
              {showConfirmModal === 'split' && `将「${selectedSource?.sourceName}」从「${currentPoint.canonicalName}」拆分为独立点位`}
            </div>

            {!reviewReason && (
              <div className="text-xs text-warning-600 mb-4 flex items-center gap-1">
                <AlertTriangle size={12} />
                建议填写复核理由，便于后续追溯
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="flex-1 btn-default"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (showConfirmModal === 'confirm') handleConfirmMerge();
                  else if (showConfirmModal === 'reject') handleRejectMerge();
                  else if (showConfirmModal === 'new') handleCreateNewPoint();
                  else if (showConfirmModal === 'split') handleSplitSource();
                }}
                className={cn(
                  'flex-1',
                  showConfirmModal === 'confirm' && 'btn-success',
                  showConfirmModal === 'reject' && 'btn-danger',
                  (showConfirmModal === 'new' || showConfirmModal === 'split') && 'btn-primary'
                )}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

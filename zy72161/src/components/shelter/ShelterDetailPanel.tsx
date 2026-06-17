import React, { useState } from 'react';
import { X, MapPin, Users, Clock, FileText, Plus, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useShelter } from '@/hooks/useShelter';
import { StatusBadge, ConflictTypeBadge } from '@/components/common/StatusBadge';
import { CapacityChart } from '@/components/common/CapacityChart';
import { ShelterStatus, ConflictType } from '@/types';
import { calculateDistance, formatDistance } from '@/utils/geo';
import { cn } from '@/lib/utils';

export const ShelterDetailPanel: React.FC = () => {
  const { showDetailPanel, detailPanelShelterId, closeDetailPanel } = useUIStore();
  const { selectedShelter, getShelterFeedbacks, getShelterRecords, updateShelterStatus, addSupplementMaterial } = useShelter();
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'records'>('overview');
  const [showSupplementForm, setShowSupplementForm] = useState(false);
  const [supplementText, setSupplementText] = useState('');

  const tabs: { id: 'overview' | 'evidence' | 'records'; label: string; icon: typeof MapPin }[] = [
    { id: 'overview', label: '概览', icon: MapPin },
    { id: 'evidence', label: '来源证据', icon: FileText },
    { id: 'records', label: '处理记录', icon: Clock }
  ];

  if (!showDetailPanel || !selectedShelter || selectedShelter.id !== detailPanelShelterId) {
    return null;
  }

  const feedbacks = getShelterFeedbacks(selectedShelter.id);
  const records = getShelterRecords(selectedShelter.id);
  const isOverCapacity = selectedShelter.reportedCount > selectedShelter.designCapacity;
  const utilizationRate = Math.round((selectedShelter.reportedCount / selectedShelter.designCapacity) * 100);

  const coordinateOffset = selectedShelter.reportedLatitude && selectedShelter.reportedLongitude
    ? calculateDistance(
        selectedShelter.latitude,
        selectedShelter.longitude,
        selectedShelter.reportedLatitude,
        selectedShelter.reportedLongitude
      )
    : 0;

  const hasCoordinateOffset = coordinateOffset > 50;

  const handleStatusChange = (newStatus: ShelterStatus) => {
    const remarks: Record<ShelterStatus, string> = {
      [ShelterStatus.PROCESSED]: '已核实无误，标记为已处理。',
      [ShelterStatus.PENDING_VERIFY]: '需要进一步核实相关数据。',
      [ShelterStatus.ONSITE_CHECK]: '需要工作人员现场复看确认。'
    };
    updateShelterStatus(selectedShelter.id, newStatus, remarks[newStatus]);
  };

  const handleSupplementSubmit = () => {
    if (supplementText.trim()) {
      addSupplementMaterial(selectedShelter.id, supplementText);
      setSupplementText('');
      setShowSupplementForm(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl transform transition-transform duration-300 ease-out">
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={closeDetailPanel} />

      <div className="relative ml-auto flex h-full w-full flex-col border-l border-gray-700 bg-gray-800 shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-700 p-6">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{selectedShelter.standardName}</h2>
              <StatusBadge status={selectedShelter.status} size="md" />
            </div>
            <p className="text-sm text-gray-400">
              别名：{selectedShelter.aliases.join(' / ')}
            </p>
            {selectedShelter.conflictType !== ConflictType.NONE && (
              <div className="mt-2">
                <ConflictTypeBadge type={selectedShelter.conflictType} size="sm" />
              </div>
            )}
          </div>
          <button
            onClick={closeDetailPanel}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-700 bg-gray-700/30 p-4">
                  <p className="text-xs text-gray-400">设计容量</p>
                  <p className="mt-1 text-2xl font-bold font-mono text-white">
                    {selectedShelter.designCapacity}
                    <span className="text-sm font-normal text-gray-400">人</span>
                  </p>
                </div>
                <div className="rounded-xl border border-gray-700 bg-gray-700/30 p-4">
                  <p className="text-xs text-gray-400">反馈人数</p>
                  <p className={cn(
                    'mt-1 text-2xl font-bold font-mono',
                    isOverCapacity ? 'text-red-400' : 'text-white'
                  )}>
                    {selectedShelter.reportedCount}
                    <span className="text-sm font-normal text-gray-400">人</span>
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-700/30 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-gray-400">容量利用率</p>
                  <p className={cn(
                    'text-sm font-bold font-mono',
                    utilizationRate > 100 ? 'text-red-400' : utilizationRate > 80 ? 'text-orange-400' : 'text-green-400'
                  )}>
                    {utilizationRate}%
                  </p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-700">
                  <div
                    className={cn(
                      'h-full transition-all duration-700',
                      utilizationRate > 100 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                      utilizationRate > 80 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                      'bg-gradient-to-r from-green-500 to-green-600'
                    )}
                    style={{ width: `${Math.min(utilizationRate, 120)}%` }}
                  />
                </div>
                {utilizationRate > 100 && (
                  <p className="mt-2 text-xs text-red-400">
                    ⚠️ 已超出设计容量 {utilizationRate - 100}%
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-700/30 p-4">
                <h4 className="mb-3 text-sm font-medium text-gray-200">分时段容量分布</h4>
                <CapacityChart
                  capacityByTime={selectedShelter.capacityByTime}
                  designCapacity={selectedShelter.designCapacity}
                />
              </div>

              <div className={cn(
                'rounded-xl border p-4',
                isOverCapacity || hasCoordinateOffset
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-green-500/30 bg-green-500/10'
              )}>
                <div className="mb-2 flex items-center gap-2">
                  {isOverCapacity || hasCoordinateOffset ? (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  )}
                  <h4 className="text-sm font-medium text-gray-200">智能判断结果</h4>
                </div>
                <p className="text-sm leading-relaxed text-gray-300">
                  {selectedShelter.naturalLanguageResult}
                </p>

                {selectedShelter.oldDesignCapacity && selectedShelter.newDesignCapacity && (
                  <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                    <p className="mb-2 text-xs font-medium text-yellow-400">⚠️ 容量标准冲突</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-400">{selectedShelter.oldCapacityYear}</p>
                        <p className="font-mono text-gray-200">{selectedShelter.oldDesignCapacity}人</p>
                        <p className="text-gray-500">占比 {Math.round((selectedShelter.reportedCount / selectedShelter.oldDesignCapacity) * 100)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-400">{selectedShelter.newCapacityYear}</p>
                        <p className="font-mono text-gray-200">{selectedShelter.newDesignCapacity}人</p>
                        <p className="text-gray-500">占比 {Math.round((selectedShelter.reportedCount / selectedShelter.newDesignCapacity) * 100)}%</p>
                      </div>
                    </div>
                  </div>
                )}

                {hasCoordinateOffset && (
                  <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                    <p className="mb-2 text-xs font-medium text-yellow-400">📍 坐标偏移</p>
                    <div className="text-xs text-gray-300">
                      <p>官方坐标：{selectedShelter.longitude.toFixed(6)}, {selectedShelter.latitude.toFixed(6)}</p>
                      <p>反馈坐标：{selectedShelter.reportedLongitude?.toFixed(6)}, {selectedShelter.reportedLatitude?.toFixed(6)}</p>
                      <p className="mt-1 text-yellow-400">偏移距离：{formatDistance(coordinateOffset)}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-700/30 p-4">
                <h4 className="mb-3 text-sm font-medium text-gray-200">状态更新</h4>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleStatusChange(ShelterStatus.PROCESSED)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-all',
                      selectedShelter.status === ShelterStatus.PROCESSED
                        ? 'border-green-500 bg-green-500/20 text-green-400'
                        : 'border-gray-600 hover:border-green-500/50 hover:bg-green-500/10 text-gray-400 hover:text-green-400'
                    )}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    已处理
                  </button>
                  <button
                    onClick={() => handleStatusChange(ShelterStatus.PENDING_VERIFY)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-all',
                      selectedShelter.status === ShelterStatus.PENDING_VERIFY
                        ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                        : 'border-gray-600 hover:border-orange-500/50 hover:bg-orange-500/10 text-gray-400 hover:text-orange-400'
                    )}
                  >
                    <Clock className="h-5 w-5" />
                    待核实
                  </button>
                  <button
                    onClick={() => handleStatusChange(ShelterStatus.ONSITE_CHECK)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-all',
                      selectedShelter.status === ShelterStatus.ONSITE_CHECK
                        ? 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-gray-600 hover:border-red-500/50 hover:bg-red-500/10 text-gray-400 hover:text-red-400'
                    )}
                  >
                    <XCircle className="h-5 w-5" />
                    需现场复看
                  </button>
                </div>
              </div>

              {!showSupplementForm ? (
                <button
                  onClick={() => setShowSupplementForm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-600 py-3 text-sm text-gray-400 transition-all hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400"
                >
                  <Plus className="h-4 w-4" />
                  补充材料
                </button>
              ) : (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                  <p className="mb-2 text-sm font-medium text-blue-400">补充历史材料</p>
                  <textarea
                    value={supplementText}
                    onChange={(e) => setSupplementText(e.target.value)}
                    placeholder="输入从居民反馈表找到的历史记录..."
                    className="mb-3 h-24 w-full rounded-lg border border-gray-600 bg-gray-800 p-3 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSupplementSubmit}
                      className="flex-1 rounded-lg bg-blue-500 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                    >
                      确认补充
                    </button>
                    <button
                      onClick={() => { setShowSupplementForm(false); setSupplementText(''); }}
                      className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-700"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-200">居民反馈来源（{feedbacks.length}条）</h4>

              {feedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className={cn(
                    'rounded-xl border p-4',
                    feedback.isDuplicate
                      ? 'border-gray-700/50 bg-gray-700/20 opacity-70'
                      : 'border-gray-700 bg-gray-700/30'
                  )}
                >
                  {feedback.isDuplicate && (
                    <div className="mb-2 inline-block rounded-full bg-gray-600 px-2 py-0.5 text-[10px] text-gray-300">
                      重复投诉
                    </div>
                  )}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-gray-400">反馈人：{feedback.reporter}</span>
                    <span className="text-xs text-gray-500">{feedback.reportTime}</span>
                  </div>
                  <div className="mb-2 rounded-lg border-l-4 border-blue-500 bg-gray-800/50 p-3">
                    <p className="text-sm leading-relaxed text-gray-200">"{feedback.rawText}"</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {feedback.locationDescription}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {feedback.reportedPeople}人 · {feedback.timePeriod === 'morning' ? '早高峰' :
                                                         feedback.timePeriod === 'noon' ? '午间' :
                                                         feedback.timePeriod === 'afternoon' ? '下午' :
                                                         feedback.timePeriod === 'evening' ? '晚高峰' : '夜间'}
                    </span>
                  </div>
                </div>
              ))}

              {selectedShelter.oldDesignCapacity && selectedShelter.newDesignCapacity && (
                <div className="mt-6">
                  <h4 className="mb-3 text-sm font-medium text-gray-200">官方数据对比</h4>
                  <div className="overflow-hidden rounded-xl border border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">数据来源</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">口径年份</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-400">容量</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-400">占比</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        <tr className="bg-gray-700/20">
                          <td className="px-4 py-3 text-gray-300">居民反馈表（旧）</td>
                          <td className="px-4 py-3 text-gray-400">{selectedShelter.oldCapacityYear}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-200">{selectedShelter.oldDesignCapacity}人</td>
                          <td className="px-4 py-3 text-right text-green-400">
                            {Math.round((selectedShelter.reportedCount / (selectedShelter.oldDesignCapacity || 1)) * 100)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-gray-300">官方导入数据（新）</td>
                          <td className="px-4 py-3 text-gray-400">{selectedShelter.newCapacityYear}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-200">{selectedShelter.newDesignCapacity}人</td>
                          <td className="px-4 py-3 text-right text-red-400">
                            {Math.round((selectedShelter.reportedCount / (selectedShelter.newDesignCapacity || 1)) * 100)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'records' && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-200">处理历史（{records.length}条）</h4>

              {records.length === 0 ? (
                <p className="text-center text-sm text-gray-500">暂无处理记录</p>
              ) : (
                records.map((record, idx) => (
                  <div key={record.id} className="relative">
                    {idx < records.length - 1 && (
                      <div className="absolute left-3 top-10 h-full w-px bg-gray-700" />
                    )}
                    <div className="relative flex gap-4">
                      <div className="relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                        {records.length - idx}
                      </div>
                      <div className="flex-1 rounded-xl border border-gray-700 bg-gray-700/30 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-blue-400">{record.action}</span>
                          <span className="text-xs text-gray-500">{record.operateTime}</span>
                        </div>
                        <p className="text-sm text-gray-300">{record.remark}</p>
                        {record.supplementMaterial && (
                          <div className="mt-3 rounded-lg border-l-4 border-yellow-500 bg-yellow-500/10 p-3">
                            <p className="text-xs font-medium text-yellow-400">📎 补充材料</p>
                            <p className="mt-1 text-xs text-gray-300">{record.supplementMaterial}</p>
                          </div>
                        )}
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>操作人：{record.operator}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {record.oldStatus && (
                              <>
                                <StatusBadge status={record.oldStatus} size="sm" />
                                <span className="text-gray-600">→</span>
                              </>
                            )}
                            <StatusBadge status={record.newStatus} size="sm" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

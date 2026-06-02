import { useState, useEffect } from 'react';
import { GitMerge, AlertTriangle, CheckCircle, RefreshCw, ArrowRight, Users, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAppStore } from '../store/useAppStore';
import { ConflictCard } from '../components/ConflictCard';
import { SourceTimeline } from '../components/SourceTimeline';
import type { BikeRecord, MergeRequest } from '@shared/types';

interface MergeCandidate {
  key: string;
  records: BikeRecord[];
}

interface ConflictWithRecord {
  record: BikeRecord;
  conflict: {
    type: string;
    humanMessage: string;
    relatedRecordIds: string[];
  };
}

export default function MergePage() {
  const navigate = useNavigate();
  const { fetchRecords } = useAppStore();
  const [candidates, setCandidates] = useState<MergeCandidate[]>([]);
  const [conflicts, setConflicts] = useState<ConflictWithRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<Map<string, Set<string>>>(new Map());
  const [merging, setMerging] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [candidatesData, conflictsData] = await Promise.all([
        api.merge.getCandidates(),
        api.merge.getConflicts(),
      ]);
      setCandidates(candidatesData);
      setConflicts(conflictsData);
    } catch (e) {
      console.error('Failed to load merge data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAutoMerge = async () => {
    if (!confirm('自动归并将合并所有同名路口的记录，是否继续？')) return;
    setMerging(true);
    try {
      const result = await api.merge.autoMerge();
      alert(`自动归并完成！共合并 ${result.mergedCount} 组记录。`);
      await fetchRecords();
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '归并失败');
    } finally {
      setMerging(false);
    }
  };

  const toggleRecordSelection = (candidateKey: string, recordId: string) => {
    setSelectedRecords(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(candidateKey) || []);
      if (set.has(recordId)) {
        set.delete(recordId);
      } else {
        set.add(recordId);
      }
      if (set.size > 0) {
        next.set(candidateKey, set);
      } else {
        next.delete(candidateKey);
      }
      return next;
    });
  };

  const handleManualMerge = async (candidate: MergeCandidate) => {
    const selected = selectedRecords.get(candidate.key);
    if (!selected || selected.size < 2) {
      alert('请至少选择 2 条记录进行合并');
      return;
    }
    const recordIds = Array.from(selected);
    const records = candidate.records.filter(r => recordIds.includes(r.id));
    const primary = records[0];

    const request: MergeRequest = {
      recordIds,
      keepStationName: primary.stationName,
      keepExitNo: primary.exitNo,
      keepLat: primary.lat,
      keepLng: primary.lng,
      keepTimeSlot: primary.timeSlot,
      keepReason: primary.reason,
    };

    try {
      await api.merge.manualMerge(request);
      alert('手动合并成功！');
      setSelectedRecords(prev => {
        const next = new Map(prev);
        next.delete(candidate.key);
        return next;
      });
      await fetchRecords();
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '合并失败');
    }
  };

  const totalConflicts = conflicts.length;
  const capacityConflicts = conflicts.filter(c => c.conflict.type === 'capacity').length;
  const coordConflicts = conflicts.filter(c => c.conflict.type === 'coord_offset').length;
  const duplicateConflicts = conflicts.filter(c => c.conflict.type === 'duplicate' || c.conflict.type === 'same_name').length;

  return (
    <div className="p-8 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-primary-900 mb-2">
            自动归并与冲突检测
          </h1>
          <p className="text-gray-600">
            系统自动识别同名路口、重复投诉、坐标偏移等异常，用人话说明问题，可手动或自动归并。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-primary-900">{totalConflicts}</div>
                <div className="text-xs text-gray-500">总异常数</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-primary-900">{capacityConflicts}</div>
                <div className="text-xs text-gray-500">容量超限</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-primary-900">{coordConflicts}</div>
                <div className="text-xs text-gray-500">坐标偏移</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-primary-900">{duplicateConflicts}</div>
                <div className="text-xs text-gray-500">同名/重复</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-primary-900 flex items-center gap-2">
                  <GitMerge className="w-5 h-5 text-accent-500" />
                  归并候选 ({candidates.length} 组)
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={loadData}
                    disabled={loading}
                    className="btn-outline text-sm py-1 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    刷新
                  </button>
                  <button
                    onClick={handleAutoMerge}
                    disabled={merging || candidates.length === 0}
                    className="btn-accent text-sm py-1 flex items-center gap-1"
                  >
                    <GitMerge className="w-4 h-4" />
                    {merging ? '归并中...' : '一键自动归并'}
                  </button>
                </div>
              </div>

              {candidates.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>暂无需要归并的记录</p>
                  <p className="text-sm">所有记录已完成归并</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {candidates.map((candidate, idx) => (
                    <div
                      key={candidate.key}
                      className="border border-gray-200 rounded-xl p-4 bg-gradient-to-br from-orange-50 to-transparent"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-primary-900">
                            {candidate.records[0].stationName} {candidate.records[0].exitNo}
                          </h4>
                          <p className="text-xs text-gray-500">
                            发现 {candidate.records.length} 条相似记录，建议合并
                          </p>
                        </div>
                        <button
                          onClick={() => handleManualMerge(candidate)}
                          disabled={(selectedRecords.get(candidate.key)?.size || 0) < 2}
                          className="btn-primary text-sm py-1"
                        >
                          合并选中
                        </button>
                      </div>
                      <div className="space-y-2">
                        {candidate.records.map(record => {
                          const isSelected = selectedRecords.get(candidate.key)?.has(record.id) || false;
                          return (
                            <div
                              key={record.id}
                              onClick={() => toggleRecordSelection(candidate.key, record.id)}
                              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-accent-500 bg-accent-50'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="mt-1"
                                  />
                                  <div>
                                    <div className="text-sm font-medium">
                                      {record.timeSlot}
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono">
                                      {record.lat.toFixed(4)}, {record.lng.toFixed(4)}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                      {record.bikeCount} / {record.capacity} 辆
                                    </div>
                                    {record.conflicts.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {record.conflicts.map((c, i) => (
                                          <ConflictCard key={i} conflict={c} compact />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <SourceTimeline sources={record.sources} compact />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-6">
              <h3 className="font-semibold text-primary-900 flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                冲突列表 ({totalConflicts} 条)
                <span className="text-xs font-normal text-gray-500 ml-2">
                  以下为人话说明，无需翻查技术文档
                </span>
              </h3>

              {conflicts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>太棒了！没有检测到任何冲突</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[700px] overflow-y-auto">
                  {conflicts.map((item, idx) => (
                    <div
                      key={idx}
                      className="animate-slide-up"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <div className="text-xs text-gray-500 mb-1">
                        关联站点：<span className="font-medium text-primary-700">
                          {item.record.stationName} {item.record.exitNo}
                        </span>
                      </div>
                      <ConflictCard conflict={item.conflict as any} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => navigate('/review')}
                className="btn-accent text-lg px-8 py-3 flex items-center gap-2"
              >
                前往人工复核
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

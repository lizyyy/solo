import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { changeApi, materialApi } from '../utils/api';
import ChangeTimeline from '../components/ChangeTimeline';
import StatusBadge from '../components/StatusBadge';
import type { Material, Track, RehearsalChange, HistoryRecord } from '../types';

export default function RehearsalChanges() {
  const { materials, setMaterials, showNotification, setLoading, loading } = useStore();
  const [selectedMaterial, setSelectedMaterial] = useState<(Material & { tracks: Track[] }) | null>(null);
  const [allChanges, setAllChanges] = useState<RehearsalChange[]>([]);
  const [allHistory, setAllHistory] = useState<HistoryRecord[]>([]);
  const [detailData, setDetailData] = useState<any>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading('all-changes', true);
    try {
      const [materialsResult, changesResult] = await Promise.all([
        materialApi.getAll(),
        changeApi.getAll(),
      ]);
      setMaterials(materialsResult);
      setAllChanges(changesResult);
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('all-changes', false);
    }
  };

  const loadMaterialDetail = async (materialId: string) => {
    setLoading('material-detail', true);
    try {
      const [detail, history] = await Promise.all([
        materialApi.getById(materialId),
        changeApi.getHistory(materialId),
      ]);
      setDetailData(detail);
      setAllHistory(history);
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('material-detail', false);
    }
  };

  const handleSelectMaterial = (material: Material & { tracks: Track[] }) => {
    setSelectedMaterial(material);
    loadMaterialDetail(material.id);
  };

  const fieldLabels: Record<string, string> = {
    track_remarks: '轨道备注',
    license_end_date: '授权截止日期',
    episode_count: '集数',
    license_fee: '授权费用',
    revenue_ratio: '分成比例',
    error_tolerance: '误差说明',
    status: '状态',
  };

  const stats = {
    totalChanges: allChanges.length + allHistory.length,
    trackRemarks: allChanges.filter(c => c.field_name === 'track_remarks').length + 
                   allHistory.filter(h => h.field_name === 'track_remarks').length,
    conflictsResolved: allChanges.filter(c => c.change_reason?.includes('冲突')).length,
    recalculations: allChanges.filter(c => c.change_reason?.includes('重算')).length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-display text-studio-gold mb-2">排练变更记录</h2>
        <p className="text-studio-silver text-sm">查看所有排练变更记录和历史快照，追溯数据修改轨迹</p>
      </div>

      <div className="divider-wave" />

      <div className="grid grid-cols-4 gap-4">
        <div className="card-studio p-4 text-center">
          <p className="text-3xl font-display text-studio-gold">{stats.totalChanges}</p>
          <p className="text-sm text-studio-silver">总变更次数</p>
        </div>
        <div className="card-studio p-4 text-center">
          <p className="text-3xl font-display text-status-new">{stats.trackRemarks}</p>
          <p className="text-sm text-studio-silver">轨道备注变更</p>
        </div>
        <div className="card-studio p-4 text-center">
          <p className="text-3xl font-display text-status-conflict">{stats.conflictsResolved}</p>
          <p className="text-sm text-studio-silver">冲突处理记录</p>
        </div>
        <div className="card-studio p-4 text-center">
          <p className="text-3xl font-display text-status-rework">{stats.recalculations}</p>
          <p className="text-sm text-studio-silver">补录后重算</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-4">
          <div className="card-studio p-4">
            <h3 className="text-lg font-display text-white mb-3">📋 选择素材</h3>
            {materials.length === 0 ? (
              <p className="text-studio-silver text-sm text-center py-8">
                暂无素材，请先导入
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {materials.map((m) => {
                  const changeCount = allChanges.filter(c => c.material_id === m.id).length +
                                     allHistory.filter(h => h.material_id === m.id).length;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelectMaterial(m)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedMaterial?.id === m.id
                          ? 'bg-studio-gold text-studio-black'
                          : 'bg-studio-darker hover:bg-studio-gray'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-mono text-sm font-medium">{m.material_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          selectedMaterial?.id === m.id 
                            ? 'bg-studio-black/20 text-studio-black' 
                            : 'bg-studio-gray text-studio-silver'
                        }`}>
                          {changeCount} 次变更
                        </span>
                      </div>
                      <p className={`text-xs font-mono ${
                        selectedMaterial?.id === m.id ? 'text-studio-black/70' : 'text-studio-silver'
                      }`}>
                        {m.project_name} | {m.isrc_code}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card-studio p-4">
            <h3 className="text-lg font-display text-white mb-3">📊 变更类型分布</h3>
            <div className="space-y-2">
              {Object.entries(fieldLabels).map(([key, label]) => {
                const count = allChanges.filter(c => c.field_name === key).length +
                             allHistory.filter(h => h.field_name === key).length;
                const percentage = stats.totalChanges > 0 ? (count / stats.totalChanges * 100).toFixed(0) : 0;
                if (count === 0) return null;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-studio-silver">{label}</span>
                      <span className="text-studio-gold font-mono">{count}次 ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-studio-darker rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-studio-gold rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-span-8 space-y-4">
          {!selectedMaterial ? (
            <div className="card-studio p-12 text-center">
              <p className="text-studio-silver mb-4">请先从左侧选择一个素材查看变更记录</p>
              <p className="text-xs text-studio-silver/70">
                变更记录包括「排练变更记录」和「历史快照」两个独立存储。
                每次修改轨道备注、处理冲突、补录重算等操作都会同时写入两张表。
              </p>
            </div>
          ) : loading['material-detail'] ? (
            <div className="card-studio p-12 text-center">
              <p className="text-studio-silver">加载中...</p>
            </div>
          ) : detailData ? (
            <>
              <div className="card-studio p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-display text-white mb-1">
                      {selectedMaterial.material_name}
                    </h3>
                    <p className="text-sm text-studio-silver font-mono">
                      {selectedMaterial.project_name} | ISRC: {selectedMaterial.isrc_code}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-studio-silver">排练变更记录</p>
                    <p className="text-2xl font-display text-studio-gold">
                      {detailData.changes?.length || 0}
                    </p>
                  </div>
                </div>

                <div className="bg-studio-darker rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-mono text-studio-gold mb-2">💡 数据联动机制说明</h4>
                  <ul className="text-xs text-studio-silver space-y-1 font-mono">
                    <li>• 每次修改会同时写入 rehearsal_change（排练变更）和 history_record（历史快照）两张表</li>
                    <li>• rehearsal_change 记录变更字段、原值、新值、操作人、原因，用于快速查看变更轨迹</li>
                    <li>• history_record 除上述字段外，还保存完整的 record_snapshot 数据快照，用于审计追溯</li>
                    <li>• 轨道备注、误差说明等字段变更会触发同步更新，三处数据（轨道备注+变更+历史）保持一致</li>
                  </ul>
                </div>

                <ChangeTimeline
                  changes={detailData.changes || []}
                  history={detailData.history || []}
                />
              </div>

              {detailData.tracks?.length > 0 && (
                <div className="card-studio p-5">
                  <h3 className="text-lg font-display text-white mb-4">
                    🎵 当前轨道信息 ({detailData.tracks.length})
                  </h3>
                  <div className="space-y-3">
                    {detailData.tracks.map((track: Track) => (
                      <div key={track.id} className="bg-studio-darker rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-studio-gold font-mono">
                              轨道 {track.track_number}: {track.track_name}
                            </span>
                            {track.need_recheck && (
                              <StatusBadge status="pending">待复核</StatusBadge>
                            )}
                            {track.rework_confirmed && (
                              <StatusBadge status="completed">已复核</StatusBadge>
                            )}
                          </div>
                        </div>
                        {track.remarks && (
                          <p className="text-sm text-studio-silver">
                            备注: {track.remarks}
                          </p>
                        )}
                        {track.updated_at && (
                          <p className="text-xs text-studio-silver/70 mt-2 font-mono">
                            最后更新: {track.updated_at}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

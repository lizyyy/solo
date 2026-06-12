import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { materialApi } from '../utils/api';
import TrackRemark from '../components/TrackRemark';
import StatusBadge from '../components/StatusBadge';
import ChangeTimeline from '../components/ChangeTimeline';
import type { Material, Track, RehearsalChange, HistoryRecord } from '../types';

export default function MaterialList() {
  const { materials, setMaterials, showNotification, setLoading, loading } = useStore();
  const [selectedMaterial, setSelectedMaterial] = useState<(Material & { tracks: Track[] }) | null>(null);
  const [detailData, setDetailData] = useState<{
    material: Material;
    tracks: Track[];
    changes: RehearsalChange[];
    history: HistoryRecord[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'changes'>('basic');

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    setLoading('materials-list', true);
    try {
      const result = await materialApi.getAll();
      setMaterials(result);
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('materials-list', false);
    }
  };

  const loadMaterialDetail = async (materialId: string) => {
    setLoading('material-detail', true);
    try {
      const detail = await materialApi.getById(materialId);
      setDetailData(detail);
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('material-detail', false);
    }
  };

  const handleSelectMaterial = (material: Material & { tracks: Track[] }) => {
    setSelectedMaterial(material);
    loadMaterialDetail(material.id);
    setActiveTab('basic');
  };

  const handleTrackUpdate = () => {
    if (selectedMaterial) {
      loadMaterialDetail(selectedMaterial.id);
      loadMaterials();
    }
  };

  const handleRecalculate = async () => {
    if (!selectedMaterial) return;
    setLoading('recalculate', true);
    try {
      await materialApi.recalculate(selectedMaterial.id, '版权运营');
      showNotification('success', '补录后重算完成，轨道备注、排练变更记录、历史记录已同步更新');
      handleTrackUpdate();
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('recalculate', false);
    }
  };

  const getMaterialStatus = (material: Material & { tracks: Track[] }) => {
    const hasRework = material.tracks?.some(t => t.need_recheck && !t.rework_confirmed);
    if (hasRework) return 'pending';
    return 'normal';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display text-studio-gold mb-2">素材入库管理</h2>
          <p className="text-studio-silver text-sm">查看和编辑素材信息，处理轨道备注和返工原因</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-studio-silver font-mono">
            共 {materials.length} 条素材
          </span>
        </div>
      </div>

      <div className="divider-wave" />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-4">
          <div className="card-studio p-4">
            <h3 className="text-lg font-display text-white mb-3">📋 素材列表</h3>
            {loading['materials-list'] ? (
              <p className="text-studio-silver text-sm text-center py-8">加载中...</p>
            ) : materials.length === 0 ? (
              <p className="text-studio-silver text-sm text-center py-8">
                暂无素材，请先在「授权期限导入」页面导入
              </p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {materials.map((m) => {
                  const status = getMaterialStatus(m);
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
                        <StatusBadge status={status as any} />
                      </div>
                      <p className={`text-xs font-mono ${
                        selectedMaterial?.id === m.id ? 'text-studio-black/70' : 'text-studio-silver'
                      }`}>
                        {m.project_name} | 轨道 {m.tracks?.length || 0}条
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-8 space-y-4">
          {!selectedMaterial ? (
            <div className="card-studio p-12 text-center">
              <p className="text-studio-silver">请先从左侧选择一个素材</p>
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
                      {detailData.material.material_name}
                    </h3>
                    <p className="text-sm text-studio-silver font-mono">
                      {detailData.material.project_name} | ISRC: {detailData.material.isrc_code}
                    </p>
                  </div>
                  <button
                    onClick={handleRecalculate}
                    disabled={loading['recalculate']}
                    className="btn-outline text-sm px-4 py-2"
                  >
                    {loading['recalculate'] ? '重算中...' : '🔁 补录后重算'}
                  </button>
                </div>

                <div className="flex border-b border-studio-gray mb-4">
                  <button
                    onClick={() => setActiveTab('basic')}
                    className={`px-4 py-2 font-mono text-sm transition-all ${
                      activeTab === 'basic'
                        ? 'text-studio-gold border-b-2 border-studio-gold'
                        : 'text-studio-silver hover:text-white'
                    }`}
                  >
                    基本信息 & 轨道备注
                  </button>
                  <button
                    onClick={() => setActiveTab('changes')}
                    className={`px-4 py-2 font-mono text-sm transition-all ${
                      activeTab === 'changes'
                        ? 'text-studio-gold border-b-2 border-studio-gold'
                        : 'text-studio-silver hover:text-white'
                    }`}
                  >
                    变更记录 & 历史 ({detailData.changes?.length + detailData.history?.length || 0})
                  </button>
                </div>

                {activeTab === 'basic' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-studio-darker rounded-lg p-4">
                        <p className="text-xs text-studio-silver mb-1">授权期限</p>
                        <p className="font-mono text-white">
                          {detailData.material.license_start_date} ~ {detailData.material.license_end_date}
                        </p>
                      </div>
                      <div className="bg-studio-darker rounded-lg p-4">
                        <p className="text-xs text-studio-silver mb-1">集数 / 费用 / 分成</p>
                        <p className="font-mono text-white">
                          {detailData.material.episode_count}集 / {detailData.material.license_fee}万 / {detailData.material.revenue_ratio}
                        </p>
                      </div>
                    </div>

                    {detailData.material.error_tolerance && (
                      <div className="bg-studio-darker rounded-lg p-4">
                        <p className="text-xs text-studio-silver mb-1">误差说明</p>
                        <p className="font-mono text-white">{detailData.material.error_tolerance}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-lg font-display text-white mb-3">
                        🎵 轨道信息 ({detailData.tracks?.length || 0})
                      </h4>
                      <div className="space-y-3">
                        {detailData.tracks?.map((track) => (
                          <TrackRemark
                            key={track.id}
                            track={track}
                            onUpdate={handleTrackUpdate}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'changes' && (
                  <div>
                    <div className="bg-studio-darker rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-display text-studio-gold">
                            {detailData.changes?.length || 0}
                          </p>
                          <p className="text-xs text-studio-silver">排练变更记录</p>
                        </div>
                        <div>
                          <p className="text-2xl font-display text-studio-silver">
                            {detailData.history?.length || 0}
                          </p>
                          <p className="text-xs text-studio-silver">历史快照记录</p>
                        </div>
                        <div>
                          <p className="text-2xl font-display text-status-new">
                            {(detailData.changes?.length || 0) + (detailData.history?.length || 0)}
                          </p>
                          <p className="text-xs text-studio-silver">总变更次数</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-studio-silver mb-4">
                      📝 所有变更操作都会同时记录到「排练变更记录」和「历史记录」两个地方，确保数据可追溯。
                      修改轨道备注、处理冲突、补录重算等操作都会自动产生变更记录。
                    </p>

                    <ChangeTimeline
                      changes={detailData.changes || []}
                      history={detailData.history || []}
                    />
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

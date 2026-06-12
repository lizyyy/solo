import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { materialApi, messageApi, changeApi } from '../utils/api';
import ConflictEvidence from '../components/ConflictEvidence';
import StatusBadge from '../components/StatusBadge';
import WaveformLoader from '../components/WaveformLoader';
import type { Material, Track, Conflict, TunerMessage } from '../types';

export default function MessageSupplement() {
  const { materials, setPendingConflicts, showNotification, setLoading, loading } = useStore();
  const [selectedMaterial, setSelectedMaterial] = useState<(Material & { tracks: Track[] }) | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [messageDate, setMessageDate] = useState(new Date().toISOString().split('T')[0]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [messages, setMessages] = useState<TunerMessage[]>([]);
  const [detailData, setDetailData] = useState<any>(null);

  useEffect(() => {
    loadPendingConflicts();
  }, []);

  const loadPendingConflicts = async () => {
    try {
      const result = await messageApi.getConflicts(undefined, 'pending');
      setPendingConflicts(result);
    } catch (error) {
      console.error('加载冲突失败:', error);
    }
  };

  const loadMaterialDetail = async (materialId: string) => {
    setLoading('material-detail', true);
    try {
      const detail = await materialApi.getById(materialId);
      setDetailData(detail);
      const msgs = await messageApi.getMessages(materialId);
      setMessages(msgs);
      const confl = await messageApi.getConflicts(materialId);
      setConflicts(confl);
    } catch (error) {
      console.error('加载素材详情失败:', error);
    } finally {
      setLoading('material-detail', false);
    }
  };

  const handleSelectMaterial = (material: Material & { tracks: Track[] }) => {
    setSelectedMaterial(material);
    loadMaterialDetail(material.id);
    setMessageContent('');
  };

  const loadSampleMessage = (type: 'date' | 'episodes' | 'fee' | 'ratio' | 'rework') => {
    const samples: Record<string, string> = {
      date: '许老师：主题曲实际授权截止是2027-12-31，不是合同上的2026年，记得改一下',
      episodes: '许老师：集数最后定的是42集，不是40集，后续费用按42集算',
      fee: '许老师：主题曲授权费用最终谈的是150万，比原合同涨了30万',
      ratio: '许老师：分成比例重新谈成35%了，不是原来的30%',
      rework: '许老师：片尾曲需要返工重新录制，导演不满意副歌部分，补录后重新提交',
    };
    setMessageContent(samples[type]);
  };

  const handleAddMessage = async () => {
    if (!selectedMaterial || !messageContent.trim()) return;
    setLoading('add-message', true);
    try {
      const result = await messageApi.addMessage(
        selectedMaterial.id,
        messageContent,
        messageDate,
        '许老师'
      );
      showNotification('success', `留言已提交，检测到 ${result.conflicts.length} 个冲突，请许老师确认`);
      setConflicts(prev => [...prev, ...result.conflicts]);
      setMessages(prev => [...prev, result.message]);
      loadPendingConflicts();
      setMessageContent('');
      loadMaterialDetail(selectedMaterial.id);
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('add-message', false);
    }
  };

  const handleResolveConflict = async (conflictId: string, resolution: 'confirmed' | 'rejected') => {
    setLoading('resolve-conflict', true);
    try {
      const conflict = await messageApi.resolveConflict(conflictId, resolution, '许老师');
      showNotification('success', `冲突已${resolution === 'confirmed' ? '确认' : '驳回'}，已同步更新相关记录`);
      setConflicts(prev => prev.map(c => c.id === conflictId ? conflict : c));
      loadPendingConflicts();
      if (selectedMaterial) {
        loadMaterialDetail(selectedMaterial.id);
      }
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('resolve-conflict', false);
    }
  };

  const handleRecalculate = async (materialId: string) => {
    setLoading('recalculate', true);
    try {
      await materialApi.recalculate(materialId, '版权运营');
      showNotification('success', '补录后重算完成，轨道备注、排练变更记录、历史记录已同步更新');
      if (selectedMaterial) {
        loadMaterialDetail(selectedMaterial.id);
      }
    } catch (error: any) {
      showNotification('error', error);
    } finally {
      setLoading('recalculate', false);
    }
  };

  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  const resolvedConflicts = conflicts.filter(c => c.status !== 'pending');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-display text-studio-gold mb-2">调音师留言补录</h2>
        <p className="text-studio-silver text-sm">录入调音师留言，系统自动检测与授权页的冲突，列出证据供许老师确认</p>
      </div>

      <div className="divider-wave" />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-4">
          <div className="card-studio p-4">
            <h3 className="text-lg font-display text-white mb-3">📋 选择素材</h3>
            {materials.length === 0 ? (
              <p className="text-studio-silver text-sm text-center py-8">
                暂无素材，请先在「授权期限导入」页面导入
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {materials.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMaterial(m)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedMaterial?.id === m.id
                        ? 'bg-studio-gold text-studio-black'
                        : 'bg-studio-darker hover:bg-studio-gray'
                    }`}
                  >
                    <p className="font-mono text-sm font-medium">{m.material_name}</p>
                    <p className={`text-xs font-mono ${
                      selectedMaterial?.id === m.id ? 'text-studio-black/70' : 'text-studio-silver'
                    }`}>
                      {m.project_name} | {m.isrc_code}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {detailData && (
            <div className="card-studio p-4">
              <h3 className="text-lg font-display text-white mb-3">📝 当前授权页数据</h3>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-studio-silver">截止日期:</span>
                  <span className="text-white">{detailData.material.license_end_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-studio-silver">集数:</span>
                  <span className="text-white">{detailData.material.episode_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-studio-silver">费用(万):</span>
                  <span className="text-white">{detailData.material.license_fee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-studio-silver">分成比例:</span>
                  <span className="text-white">{detailData.material.revenue_ratio}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-studio-silver">误差说明:</span>
                  <span className="text-white">{detailData.material.error_tolerance}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-8 space-y-4">
          {!selectedMaterial ? (
            <div className="card-studio p-12 text-center">
              <p className="text-studio-silver">请先从左侧选择一个素材</p>
            </div>
          ) : (
            <>
              <div className="card-studio p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-display text-white mb-1">
                      {selectedMaterial.material_name}
                    </h3>
                    <p className="text-sm text-studio-silver font-mono">
                      {selectedMaterial.project_name} | ISRC: {selectedMaterial.isrc_code}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRecalculate(selectedMaterial.id)}
                    disabled={loading['recalculate']}
                    className="btn-outline text-sm px-4 py-2"
                  >
                    {loading['recalculate'] ? '重算中...' : '🔁 补录后重算'}
                  </button>
                </div>

                <div className="mb-4">
                  <label className="label-studio">快捷留言模板</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => loadSampleMessage('date')} className="btn-outline text-xs px-3 py-1">
                      日期冲突
                    </button>
                    <button onClick={() => loadSampleMessage('episodes')} className="btn-outline text-xs px-3 py-1">
                      集数冲突
                    </button>
                    <button onClick={() => loadSampleMessage('fee')} className="btn-outline text-xs px-3 py-1">
                      费用冲突
                    </button>
                    <button onClick={() => loadSampleMessage('ratio')} className="btn-outline text-xs px-3 py-1">
                      比例冲突
                    </button>
                    <button onClick={() => loadSampleMessage('rework')} className="btn-outline text-xs px-3 py-1">
                      含返工原因
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="label-studio">留言日期</label>
                  <input
                    type="date"
                    value={messageDate}
                    onChange={(e) => setMessageDate(e.target.value)}
                    className="input-studio"
                  />
                </div>

                <div className="mb-4">
                  <label className="label-studio">留言内容</label>
                  <textarea
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    className="input-studio min-h-[120px] resize-y"
                    placeholder="录入调音师或许老师的留言... 系统将自动检测与授权页的冲突"
                  />
                </div>

                <button
                  onClick={handleAddMessage}
                  disabled={loading['add-message'] || !messageContent.trim()}
                  className="btn-studio w-full"
                >
                  {loading['add-message'] ? '提交中...' : '📝 提交留言并检测冲突'}
                </button>
              </div>

              {pendingConflicts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-display text-status-conflict">
                    ⚠️ 待处理冲突 ({pendingConflicts.length})
                  </h3>
                  {pendingConflicts.map((conflict) => (
                    <ConflictEvidence
                      key={conflict.id}
                      conflict={conflict}
                      onResolve={handleResolveConflict}
                    />
                  ))}
                </div>
              )}

              {resolvedConflicts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-display text-studio-silver">
                    ✅ 已处理冲突 ({resolvedConflicts.length})
                  </h3>
                  {resolvedConflicts.map((conflict) => (
                    <ConflictEvidence
                      key={conflict.id}
                      conflict={conflict}
                      onResolve={() => {}}
                    />
                  ))}
                </div>
              )}

              {messages.length > 0 && (
                <div className="card-studio p-5">
                  <h3 className="text-lg font-display text-white mb-4">📜 历史留言</h3>
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id} className="bg-studio-darker rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-studio-gold font-mono text-sm">
                              👤 {msg.recorded_by}
                            </span>
                            <span className="text-xs text-studio-silver font-mono">
                              {msg.message_date}
                            </span>
                          </div>
                          {msg.has_conflict && (
                            <StatusBadge status={msg.conflict_status === 'pending' ? 'conflict' : 'completed'}>
                              {msg.conflict_status === 'pending' ? '有冲突' : '已处理'}
                            </StatusBadge>
                          )}
                        </div>
                        <p className="text-studio-silver text-sm italic">
                          "{msg.content}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailData && (
                <div className="card-studio p-5">
                  <h3 className="text-lg font-display text-white mb-4">
                    🎵 轨道信息 ({detailData.tracks?.length || 0})
                  </h3>
                  <div className="space-y-3">
                    {detailData.tracks?.map((track: Track) => (
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
                          <p className="text-sm text-studio-silver mt-2">
                            备注: {track.remarks}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

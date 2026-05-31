import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { STATUS_META, ANOMALY_META, ANOMALY_SEVERITY_META } from '@/types';
import type { RegistrationStatus, AnomalyType } from '@/types';

export default function RegistrationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    registrations,
    statusHistories,
    anomalies,
    currentOperator,
    changeStatus,
    swapArtwork,
    resolveAnomaly,
    updateRegistration,
  } = useStore();

  const reg = registrations.find((r) => r.id === id);
  const histories = id
    ? useStore.getState().getHistoriesByRegistrationId(id)
    : [];
  const regAnomalies = id
    ? useStore.getState().getAnomaliesByRegistrationId(id)
    : [];

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapForm, setSwapForm] = useState({ swapFrom: '', swapTo: '', reason: '' });
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTarget, setStatusTarget] = useState<RegistrationStatus>('confirmed');
  const [statusReason, setStatusReason] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    artworkName: reg?.artworkName || '',
    artist: reg?.artist || '',
    registrant: reg?.registrant || '',
    contact: reg?.contact || '',
    location: reg?.location || '',
    notes: reg?.notes || '',
  });
  const [editReason, setEditReason] = useState('');
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);

  if (!reg) {
    return (
      <div className="h-full flex items-center justify-center text-console-muted">
        <div className="text-center">
          <p className="text-lg mb-2">记录不存在</p>
          <button onClick={() => navigate('/')} className="btn btn-secondary">
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[reg.status];
  const hasSwap = regAnomalies.some((a) => a.type === 'swap_record');

  const handleSwap = () => {
    if (!id || !swapForm.swapFrom || !swapForm.swapTo || !swapForm.reason) return;
    swapArtwork(id, swapForm.swapFrom, swapForm.swapTo, swapForm.reason, currentOperator);
    setShowSwapModal(false);
    setSwapForm({ swapFrom: '', swapTo: '', reason: '' });
  };

  const handleStatusChange = () => {
    if (!id || !statusReason.trim()) return;
    changeStatus(id, statusTarget, currentOperator, statusReason);
    setShowStatusModal(false);
    setStatusReason('');
  };

  const handleEdit = () => {
    if (!id || !editReason.trim()) return;
    updateRegistration(
      id,
      {
        artworkName: editForm.artworkName,
        artist: editForm.artist,
        registrant: editForm.registrant,
        contact: editForm.contact,
        location: editForm.location || undefined,
        notes: editForm.notes || undefined,
      },
      currentOperator,
      editReason
    );
    setShowEditModal(false);
    setEditReason('');
  };

  const formatTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-full overflow-auto scrollbar-thin">
      <div className="panel border-t-0 border-x-0 px-4 py-2 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="btn btn-secondary text-[10px]">
            ← 返回
          </button>
          <h1 className="text-sm font-bold">报名详情</h1>
          <span className={`tag ${statusMeta.tagClass}`}>{statusMeta.label}</span>
          {hasSwap && <span className="tag tag-info">[调]</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-console-muted">ID: {reg.id}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-console-muted uppercase tracking-wider">
              基本信息
            </h2>
            <button
              onClick={() => {
                setEditForm({
                  artworkName: reg.artworkName,
                  artist: reg.artist,
                  registrant: reg.registrant,
                  contact: reg.contact,
                  location: reg.location || '',
                  notes: reg.notes || '',
                });
                setShowEditModal(true);
              }}
              className="btn btn-secondary text-[10px]"
            >
              更正信息
            </button>
          </div>
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-xs">
            <div>
              <span className="text-console-muted">作品名称</span>
              <p className="font-medium mt-0.5">{reg.artworkName || <span className="text-console-danger italic">空</span>}</p>
            </div>
            <div>
              <span className="text-console-muted">艺术家</span>
              <p className="font-medium mt-0.5">{reg.artist || <span className="text-console-danger italic">空</span>}</p>
            </div>
            <div>
              <span className="text-console-muted">报名人</span>
              <p className="font-medium mt-0.5">{reg.registrant || <span className="text-console-danger italic">空</span>}</p>
            </div>
            <div>
              <span className="text-console-muted">联系方式</span>
              <p className="font-medium mt-0.5">{reg.contact || <span className="text-console-danger italic">空</span>}</p>
            </div>
            <div>
              <span className="text-console-muted">展位</span>
              <p className="font-medium mt-0.5 text-console-info">{reg.location || '-'}</p>
            </div>
            <div>
              <span className="text-console-muted">数据来源</span>
              <p className="font-medium mt-0.5">
                {{ manual: '手动录入', import: '批量导入', correction: '人工更正' }[reg.source]}
              </p>
            </div>
            <div>
              <span className="text-console-muted">创建时间</span>
              <p className="mt-0.5">{formatTime(reg.createdAt)}</p>
            </div>
            <div>
              <span className="text-console-muted">最后更新</span>
              <p className="mt-0.5">{formatTime(reg.updatedAt)}</p>
            </div>
            {reg.notes && (
              <div className="col-span-3">
                <span className="text-console-muted">备注</span>
                <p className="mt-0.5">{reg.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="text-xs font-bold text-console-muted uppercase tracking-wider mb-3">
            状态时间线
          </h2>
          <div className="relative">
            {histories.map((hist, idx) => {
              const fromMeta = hist.fromStatus ? STATUS_META[hist.fromStatus] : null;
              const toMeta = STATUS_META[hist.toStatus];
              const isSwap = hist.toStatus === 'swapped' || !!hist.swapFrom;

              return (
                <div key={hist.id} className="relative pl-6 pb-4 last:pb-0">
                  {idx < histories.length - 1 && (
                    <div className="absolute left-[7px] top-4 bottom-0 w-px bg-console-border" />
                  )}
                  <div
                    className={`absolute left-0 top-1 w-[15px] h-[15px] rounded-full border-2 ${
                      isSwap
                        ? 'bg-console-danger/20 border-console-danger'
                        : idx === 0
                        ? 'bg-console-info/20 border-console-info'
                        : 'bg-console-success/20 border-console-success'
                    }`}
                  />
                  <div
                    className={`ml-3 p-2 border ${
                      isSwap ? 'border-console-danger/50 bg-console-danger/5' : 'border-console-border/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`tag ${toMeta?.tagClass || 'tag-muted'}`}>
                        {toMeta?.label || hist.toStatus}
                      </span>
                      {fromMeta && (
                        <>
                          <span className="text-console-muted text-[10px]">←</span>
                          <span className={`tag ${fromMeta.tagClass}`}>
                            {fromMeta.label}
                          </span>
                        </>
                      )}
                      <span className="text-console-muted text-[10px] ml-auto">
                        {formatTime(hist.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-console-muted">操作人：</span>
                      <span className="font-medium">{hist.operator}</span>
                    </div>
                    <div className="text-xs mt-0.5">
                      <span className="text-console-muted">原因：</span>
                      <span>{hist.reason}</span>
                    </div>
                    {isSwap && hist.swapFrom && hist.swapTo && (
                      <div className="text-xs mt-1 p-1.5 bg-console-danger/10 border border-console-danger/30">
                        <span className="text-console-danger font-bold">调换记录：</span>
                        <span className="line-through text-console-muted">{hist.swapFrom}</span>
                        <span className="mx-1 text-console-danger">→</span>
                        <span className="font-bold">{hist.swapTo}</span>
                      </div>
                    )}
                    {hist.attachmentUrl && (
                      <div className="text-[10px] mt-1 text-console-muted">
                        附件：{hist.attachmentUrl}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {regAnomalies.length > 0 && (
          <div className="panel p-4">
            <h2 className="text-xs font-bold text-console-muted uppercase tracking-wider mb-3">
              异常记录（{regAnomalies.length}）
            </h2>
            <div className="space-y-2">
              {regAnomalies.map((anomaly) => {
                const meta = ANOMALY_META[anomaly.type as AnomalyType];
                const sevMeta = ANOMALY_SEVERITY_META[anomaly.severity];
                const isExpanded = expandedAnomaly === anomaly.id;

                return (
                  <div
                    key={anomaly.id}
                    className={`border p-3 cursor-pointer transition-colors ${
                      anomaly.resolvedAt
                        ? 'border-console-success/30 bg-console-success/5 opacity-60'
                        : 'border-console-border'
                    }`}
                    onClick={() => setExpandedAnomaly(isExpanded ? null : anomaly.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`tag ${
                          anomaly.type === 'duplicate' ||
                          anomaly.type === 'missing_info' ||
                          anomaly.type === 'conflict'
                            ? 'tag-danger'
                            : anomaly.type === 'late_attachment'
                            ? 'tag-warning'
                            : 'tag-info'
                        }`}
                      >
                        [{meta?.shortLabel}] {meta?.label}
                      </span>
                      <span
                        className="tag tag-muted"
                        style={{ color: sevMeta.color, borderColor: sevMeta.color }}
                      >
                        严重度：{sevMeta.label}
                      </span>
                      {anomaly.resolvedAt ? (
                        <span className="tag tag-success">已处理</span>
                      ) : (
                        <span className="tag tag-warning">待处理</span>
                      )}
                      <span className="text-console-muted text-[10px] ml-auto">
                        {formatTime(anomaly.detectedAt)}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 text-xs border-t border-console-border/50 pt-2">
                        <div>
                          <span className="text-console-muted">异常描述：</span>
                          {anomaly.description}
                        </div>
                        <div>
                          <span className="text-console-muted">检测规则：</span>
                          <span className="text-console-info">{anomaly.rule}</span>
                        </div>
                        <div>
                          <span className="text-console-muted">处理建议：</span>
                          {anomaly.suggestion}
                        </div>
                        {!anomaly.resolvedAt && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              resolveAnomaly(anomaly.id, currentOperator);
                            }}
                            className="btn btn-success text-[10px] mt-1"
                          >
                            标记已处理
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="panel p-4">
          <h2 className="text-xs font-bold text-console-muted uppercase tracking-wider mb-3">
            操作
          </h2>
          <div className="flex gap-2 flex-wrap">
            {reg.status === 'pending' && (
              <button
                onClick={() => { setStatusTarget('confirmed'); setShowStatusModal(true); }}
                className="btn btn-primary"
              >
                确认报名
              </button>
            )}
            {reg.status === 'confirmed' && (
              <button
                onClick={() => { setStatusTarget('arrived'); setShowStatusModal(true); }}
                className="btn btn-success"
              >
                标记到场
              </button>
            )}
            {(reg.status === 'pending' || reg.status === 'confirmed') && (
              <button
                onClick={() => setShowSwapModal(true)}
                className="btn btn-danger"
              >
                调换作品
              </button>
            )}
            {reg.status !== 'cancelled' && reg.status !== 'missing' && (
              <button
                onClick={() => { setStatusTarget('missing'); setShowStatusModal(true); }}
                className="btn btn-secondary"
              >
                标记缺失
              </button>
            )}
            {reg.status !== 'cancelled' && (
              <button
                onClick={() => { setStatusTarget('cancelled'); setShowStatusModal(true); }}
                className="btn btn-secondary"
              >
                取消报名
              </button>
            )}
          </div>
        </div>
      </div>

      {showSwapModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="panel w-[480px] p-4">
            <h2 className="text-sm font-bold mb-1">作品调换</h2>
            <p className="text-[10px] text-console-danger mb-3">
              调换操作将永久留痕，三栏必填
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-console-muted">原作品名称 *</label>
                <input
                  value={swapForm.swapFrom}
                  onChange={(e) => setSwapForm({ ...swapForm, swapFrom: e.target.value })}
                  className="input text-xs"
                  placeholder="输入被调换的原作品名"
                />
              </div>
              <div>
                <label className="text-[10px] text-console-muted">新作品名称 *</label>
                <input
                  value={swapForm.swapTo}
                  onChange={(e) => setSwapForm({ ...swapForm, swapTo: e.target.value })}
                  className="input text-xs"
                  placeholder="输入调换后的新作品名"
                />
              </div>
              <div>
                <label className="text-[10px] text-console-muted">调换原因 *</label>
                <textarea
                  value={swapForm.reason}
                  onChange={(e) => setSwapForm({ ...swapForm, reason: e.target.value })}
                  className="input text-xs min-h-[80px]"
                  placeholder="必须填写调换原因，用于后续争议复核"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => { setShowSwapModal(false); setSwapForm({ swapFrom: '', swapTo: '', reason: '' }); }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSwap}
                className="btn btn-danger"
                disabled={!swapForm.swapFrom || !swapForm.swapTo || !swapForm.reason}
              >
                确认调换
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="panel w-[400px] p-4">
            <h2 className="text-sm font-bold mb-1">
              状态变更：{STATUS_META[statusTarget]?.label}
            </h2>
            <p className="text-[10px] text-console-muted mb-3">
              所有状态变更均留痕，原因必填
            </p>
            <div>
              <label className="text-[10px] text-console-muted">变更原因 *</label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="input text-xs min-h-[80px]"
                placeholder="填写本次状态变更的原因"
              />
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => { setShowStatusModal(false); setStatusReason(''); }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleStatusChange}
                className="btn btn-primary"
                disabled={!statusReason.trim()}
              >
                确认变更
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="panel w-[480px] p-4">
            <h2 className="text-sm font-bold mb-1">人工更正</h2>
            <p className="text-[10px] text-console-muted mb-3">
              更正操作将留痕，原因必填
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-console-muted">作品名称</label>
                  <input
                    value={editForm.artworkName}
                    onChange={(e) => setEditForm({ ...editForm, artworkName: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-console-muted">艺术家</label>
                  <input
                    value={editForm.artist}
                    onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-console-muted">报名人</label>
                  <input
                    value={editForm.registrant}
                    onChange={(e) => setEditForm({ ...editForm, registrant: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-console-muted">联系方式</label>
                  <input
                    value={editForm.contact}
                    onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-console-muted">展位</label>
                  <input
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-console-muted">备注</label>
                  <input
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-console-danger">更正原因 *</label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="input text-xs min-h-[60px]"
                  placeholder="填写更正原因"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                取消
              </button>
              <button
                onClick={handleEdit}
                className="btn btn-primary"
                disabled={!editReason.trim()}
              >
                确认更正
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

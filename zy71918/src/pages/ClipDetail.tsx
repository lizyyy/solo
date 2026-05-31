import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClipStore } from '@/store/clipStore';
import type { ClipStatus, SourceType } from 'shared/types';
import {
  STATUS_CONFIG,
  SOURCE_TYPE_CONFIG,
  STATUS_TRANSITION_RULES,
  formatDuration,
  formatDate,
} from 'shared/constants';
import StatusBadge from '@/components/StatusBadge';
import ChangeTypeBadge from '@/components/ChangeTypeBadge';
import ChangeTimeline from '@/components/ChangeTimeline';
import MaterialTable from '@/components/MaterialTable';
import {
  ArrowLeft,
  Edit,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Calendar,
  ChevronRight,
  Music,
  FileText,
  Scissors,
  X,
} from 'lucide-react';

const ClipDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentClip, loading, fetchClip, updateStatus } = useClipStore();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingReason, setPendingReason] = useState('');
  const [targetStatus, setTargetStatus] = useState<ClipStatus | null>(null);

  const fetchClipCallback = useCallback(fetchClip, [fetchClip]);

  useEffect(() => {
    if (id) {
      fetchClipCallback(id);
    }
  }, [id, fetchClipCallback]);

  if (!id) return null;

  const handleStatusChange = async () => {
    if (!targetStatus || !id) return;

    const success = await updateStatus(id, {
      status: targetStatus,
      reason: targetStatus === 'pending' ? pendingReason : undefined,
      operatorId: '',
    });

    if (success) {
      setShowStatusModal(false);
      setPendingReason('');
      setTargetStatus(null);
    }
  };

  const openStatusModal = (status: ClipStatus) => {
    setTargetStatus(status);
    if (status === 'pending') {
      setPendingReason('');
    }
    setShowStatusModal(true);
  };

  if (loading && !currentClip) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-studio-border rounded w-1/4" />
          <div className="card p-6 space-y-4">
            <div className="h-6 bg-studio-border rounded w-1/3" />
            <div className="h-4 bg-studio-border rounded w-1/2" />
            <div className="h-20 bg-studio-border rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!currentClip) {
    return (
      <div className="p-8 text-center py-16">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-studio-muted" />
        <h3 className="font-serif text-lg font-medium text-slate-850 mb-2">
          记录不存在
        </h3>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="btn-secondary"
        >
          返回列表
        </button>
      </div>
    );
  }

  const clip = currentClip;
  const availableStatuses = STATUS_TRANSITION_RULES[clip.status] || [];
  const unresolvedPending = clip.pendingReasons.find(p => !p.resolved);
  const missingMaterials = clip.materials.filter(m => m.status === 'missing');

  const sourceChain: { type: SourceType; exists: boolean }[] = [
    { type: 'edit_point', exists: !!clip.editPointContent },
    { type: 'ad_script', exists: !!clip.adScriptContent },
  ];
  if (clip.audioTrackAfter) {
    sourceChain.push({ type: 'audio_track', exists: true });
  }

  const sourceIconMap = {
    edit_point: Scissors,
    ad_script: FileText,
    audio_track: Music,
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="p-2 hover:bg-studio-border rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-studio-muted" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-mono text-studio-muted">
              {clip.episode}
            </span>
            <StatusBadge status={clip.status} />
          </div>
          <h1 className="font-serif text-2xl font-semibold text-slate-850">
            {clip.title}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/clip/${id}/edit`)}
          className="btn-secondary flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          编辑
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="section-title flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-700" />
              基本信息
            </h2>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs text-studio-muted mb-1">嘉宾</p>
                <p className="font-medium text-slate-850">{clip.guest}</p>
              </div>
              <div>
                <p className="text-xs text-studio-muted mb-1">时长</p>
                <p className="font-medium text-slate-850 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-studio-muted" />
                  {formatDuration(clip.duration)}
                </p>
              </div>
              <div>
                <p className="text-xs text-studio-muted mb-1">创建人</p>
                <p className="font-medium text-slate-850 flex items-center gap-1">
                  <User className="w-4 h-4 text-studio-muted" />
                  {clip.changeLogs[clip.changeLogs.length - 1]?.operatorName || '未知'}
                </p>
              </div>
              <div>
                <p className="text-xs text-studio-muted mb-1">更新时间</p>
                <p className="font-medium text-slate-850 flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-studio-muted" />
                  {formatDate(clip.updatedAt)}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs text-studio-muted mb-2">来源链</p>
              <div className="flex items-center gap-2">
                {sourceChain.map((item, index) => {
                  const Icon = sourceIconMap[item.type];
                  const config = SOURCE_TYPE_CONFIG[item.type];
                  return (
                    <React.Fragment key={item.type}>
                      <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm ${
                          item.exists
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-600 border border-red-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {config.label}
                        {item.exists ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5" />
                        )}
                      </div>
                      {index < sourceChain.length - 1 && (
                        <ChevronRight className="w-4 h-4 text-studio-muted" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {unresolvedPending && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 mb-1">
                      待处理问题
                    </p>
                    <p className="text-sm text-red-700 mb-1">
                      {unresolvedPending.reason}
                    </p>
                    <p className="text-xs text-red-500">
                      由 {unresolvedPending.operatorName} 于{' '}
                      {formatDate(unresolvedPending.timestamp)} 标记
                    </p>
                  </div>
                </div>
              </div>
            )}

            {missingMaterials.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 mb-1">
                      缺失素材提醒
                    </p>
                    <p className="text-sm text-amber-700">
                      共 {missingMaterials.length} 项素材缺失，导出前请确认已补全
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {clip.editPointContent && (
            <div className="card p-6">
              <h2 className="section-title flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-700" />
                剪辑点内容
              </h2>
              <pre className="whitespace-pre-wrap text-sm text-slate-850 bg-studio-bg p-4 rounded-lg border border-studio-border">
                {clip.editPointContent}
              </pre>
            </div>
          )}

          {clip.adScriptContent && (
            <div className="card p-6">
              <h2 className="section-title flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-700" />
                广告口播表
              </h2>
              <pre className="whitespace-pre-wrap text-sm text-slate-850 bg-studio-bg p-4 rounded-lg border border-studio-border">
                {clip.adScriptContent}
              </pre>
            </div>
          )}

          {clip.audioTrackAfter && (
            <div className="card p-6">
              <h2 className="section-title flex items-center gap-2">
                <Music className="w-5 h-5 text-amber-700" />
                原始音轨变更记录
                <ChangeTypeBadge type="conclusion_change" />
              </h2>

              {clip.audioTrackBefore && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-red-600 mb-2">变更前</p>
                  <pre className="whitespace-pre-wrap text-sm text-red-700 bg-red-50 p-4 rounded-lg border border-red-100">
                    {clip.audioTrackBefore}
                  </pre>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-green-600 mb-2">变更后</p>
                <pre className="whitespace-pre-wrap text-sm text-green-700 bg-green-50 p-4 rounded-lg border border-green-100">
                  {clip.audioTrackAfter}
                </pre>
              </div>
            </div>
          )}

          <div className="card p-6">
            <h2 className="section-title flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-700" />
              变更历史
            </h2>
            <ChangeTimeline changes={clip.changeLogs} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 sticky top-8">
            <h2 className="section-title">状态变更</h2>

            <div className="mb-4 p-3 rounded-lg bg-studio-bg">
              <p className="text-xs text-studio-muted mb-1">当前状态</p>
              <StatusBadge status={clip.status} size="md" />
              <p className="text-xs text-studio-muted mt-2">
                {STATUS_CONFIG[clip.status].description}
              </p>
            </div>

            {availableStatuses.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-studio-muted">可转换到</p>
                {availableStatuses.map(status => {
                  const config = STATUS_CONFIG[status];
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => openStatusModal(status)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-studio-border hover:border-amber-300 hover:bg-amber-50 transition-all text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: config.color }}
                        />
                        <span className="text-sm font-medium text-slate-850">
                          {config.label}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-studio-muted" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-studio-muted">暂无可转换的状态</p>
            )}

            <div className="mt-4 pt-4 border-t border-studio-border">
              <button
                type="button"
                onClick={() => openStatusModal('pending')}
                className="w-full btn-danger text-sm flex items-center justify-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                标记问题
              </button>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="section-title">素材清单</h2>
            <MaterialTable
              materials={clip.materials}
              clipId={id}
              canAdd={true}
            />
          </div>
        </div>
      </div>

      {showStatusModal && targetStatus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-semibold text-slate-850">
                状态变更确认
              </h3>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="p-1 hover:bg-studio-border rounded"
              >
                <X className="w-5 h-5 text-studio-muted" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-studio-muted mb-2">将状态变更为</p>
              <StatusBadge status={targetStatus} />
            </div>

            {targetStatus === 'pending' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-850 mb-2">
                  待处理原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="textarea-field"
                  value={pendingReason}
                  onChange={e => setPendingReason(e.target.value)}
                  placeholder="请详细描述问题和处理要求..."
                  rows={4}
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="btn-ghost"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleStatusChange}
                className="btn-primary"
                disabled={targetStatus === 'pending' && !pendingReason.trim()}
              >
                确认变更
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClipDetail;

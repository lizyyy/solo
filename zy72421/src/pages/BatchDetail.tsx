import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Mic, Edit3, Camera, AlertTriangle, X, Clock, User, FileText } from 'lucide-react';
import { useAppStore } from '@/store';
import { StatusBadge } from '@/components/StatusBadge';
import { TrackStatus, StandardType } from '@/types';

export const BatchDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { batches, rerunBatch, reviewMixedBatch, correctTrack, supplementFromPhoto, addToast } = useAppStore();
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [supplementModal, setSupplementModal] = useState<{ trackId: string; photoId: string; photoRemark: string } | null>(null);
  const [supplementReason, setSupplementReason] = useState('');

  const batch = batches.find((b) => b.id === id);

  if (!batch) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="text-gold-400 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-semibold text-white mb-2">找不到这个批次</h2>
          <button onClick={() => navigate('/')} className="btn-primary">
            返回主面板
          </button>
        </div>
      </div>
    );
  }

  const handleRerun = () => {
    if (window.confirm('确定要重新跑一遍吗？之前的修改记录会保留下来')) {
      rerunBatch(batch.id);
    }
  };

  const handleReview = (approved: boolean) => {
    reviewMixedBatch(batch.id, approved);
  };

  const openSupplementModal = (trackId: string, photoId: string, photoRemark: string) => {
    setSupplementModal({ trackId, photoId, photoRemark });
    setSupplementReason('从课时签到照片发现旧口径备注，按旧口径保留');
  };

  const handleConfirmSupplement = () => {
    if (!supplementModal) return;
    supplementFromPhoto(batch.id, supplementModal.trackId, supplementModal.photoId, supplementModal.photoRemark, supplementReason);
    setSupplementModal(null);
    setSupplementReason('');
  };

  const ticketTypeLabels: Record<string, string> = {
    free: '赠票',
    paid: '售票',
    mixed: '混合',
  };

  const authLabels: Record<string, { label: string; color: string }> = {
    valid: { label: '授权有效', color: 'text-forest-400' },
    expired: { label: '授权过期', color: 'text-red-400' },
    pending: { label: '授权待定', color: 'text-yellow-400' },
  };

  const oldStandardPhoto = batch.photos.find(p => p.hasOldStandard);

  return (
    <div className="flex-1 p-8 overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-2xl font-bold text-gold-200">
                {batch.name}
              </h1>
              <StatusBadge status={batch.status} sceneType={batch.sceneType} />
            </div>
            <p className="text-sm text-white/50 font-mono">{batch.id} · 操作人：{batch.operator}</p>
          </div>
          <div className="flex items-center gap-3">
            {batch.status === 'pending_review' && (
              <>
                <button onClick={() => handleReview(false)} className="btn-secondary flex items-center gap-2">
                  <X size={16} />
                  退回
                </button>
                <button onClick={() => handleReview(true)} className="btn-gold flex items-center gap-2">
                  <Mic size={16} />
                  录音师复核通过
                </button>
              </>
            )}
            <button onClick={handleRerun} className="btn-secondary flex items-center gap-2">
              <RefreshCw size={16} />
              重跑
            </button>
          </div>
        </div>

        {batch.sceneType === 'mixed_tickets' && batch.status === 'pending_review' && (
          <div className="mb-6 p-4 rounded-lg bg-orange-700/20 border border-orange-700/30 flex items-start gap-3 animate-fade-in">
            <AlertTriangle className="text-orange-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-orange-200 font-medium">⚠️ 赠票售票混批提醒</p>
              <p className="text-sm text-orange-200/70">
                这批里有赠票也有售票，得麻烦录音师看过才行。别急着归正常，现在的状态是正确的。
              </p>
            </div>
          </div>
        )}

        {batch.sceneType === 'old_standard' && (
          <div className="mb-6 p-4 rounded-lg bg-gray-700/20 border border-gray-600/30 flex items-start gap-3 animate-fade-in">
            <FileText className="text-gray-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-gray-200 font-medium">📝 旧口径补录批次</p>
              <p className="text-sm text-gray-300/70">
                这个批次包含从课时签到照片补录的旧口径记录。曲目别名表是主材料，但签到照片里常常藏着关键备注。
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h2 className="font-display text-lg font-semibold text-gold-200 mb-4 flex items-center gap-2">
              <Edit3 size={20} />
              曲目列表
            </h2>
            <div className="space-y-3">
              {batch.tracks.map((track) => (
                <div
                  key={track.id}
                  className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-gold-800/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white text-lg">{track.name}</h3>
                      <p className="text-sm text-white/50">别名：{track.alias}</p>
                    </div>
                    <StatusBadge status={track.status} size="sm" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                    <div>
                      <span className="text-white/50">票种：</span>
                      <span className="text-white">{ticketTypeLabels[track.ticketType]}</span>
                    </div>
                    <div>
                      <span className="text-white/50">口径：</span>
                      <span className={track.standard === 'old' ? 'text-gray-300' : 'text-white'}>
                        {track.standard === 'old' ? '旧口径' : '新口径'}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/50">授权：</span>
                      <span className={authLabels[track.authorization].color}>
                        {authLabels[track.authorization].label}
                      </span>
                    </div>
                  </div>

                  {track.remark && (
                    <div className="p-3 rounded bg-wine-900/30 border-l-2 border-gold-800 mb-3">
                      <p className="text-sm text-gold-200 whitespace-pre-line">📝 {track.remark}</p>
                    </div>
                  )}

                  {track.supplementHistory && track.supplementHistory.length > 0 && (
                    <div className="mb-3 p-3 rounded bg-gray-800/30 border border-gray-700/30">
                      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                        <Clock size={12} />
                        补录历史（{track.supplementHistory.length}次）
                      </p>
                      {track.supplementHistory.map((record, idx) => (
                        <div key={record.id} className="text-xs text-gray-300 border-l-2 border-gold-800/50 pl-3 py-1 mb-1">
                          <div className="flex items-center gap-2 text-gray-400">
                            <User size={10} />
                            <span>{record.operator}</span>
                            <span>·</span>
                            <span>{record.timestamp}</span>
                          </div>
                          <p className="mt-1">原因：{record.reason}</p>
                          <p className="mt-1 text-gold-300/80">照片原话：{record.photoRemark.slice(0, 50)}{record.photoRemark.length > 50 ? '...' : ''}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {editingTrackId === track.id ? (
                    <div className="p-3 rounded bg-white/5 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">状态</label>
                          <select
                            className="input-field text-sm"
                            defaultValue={track.status}
                            onChange={(e) => {
                              correctTrack(batch.id, track.id, { status: e.target.value as TrackStatus }, '人工修正');
                              setEditingTrackId(null);
                            }}
                          >
                            <option value="normal">正常</option>
                            <option value="removed">下架</option>
                            <option value="updated">已修正</option>
                            <option value="pending_review">待复核</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">口径</label>
                          <select
                            className="input-field text-sm"
                            defaultValue={track.standard}
                            onChange={(e) => {
                              correctTrack(batch.id, track.id, { standard: e.target.value as StandardType }, '人工修正');
                              setEditingTrackId(null);
                            }}
                          >
                            <option value="new">新口径</option>
                            <option value="old">旧口径</option>
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingTrackId(null)}
                        className="text-xs text-white/50 hover:text-white"
                      >
                        取消编辑
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingTrackId(track.id)}
                        className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                      >
                        人工修正
                      </button>
                      {oldStandardPhoto && track.standard === 'new' && (
                        <button
                          onClick={() => openSupplementModal(track.id, oldStandardPhoto.id, oldStandardPhoto.remark)}
                          className="text-xs px-3 py-1.5 rounded bg-gold-800/30 hover:bg-gold-800/50 text-gold-300 transition-colors flex items-center gap-1"
                        >
                          <Camera size={12} />
                          从签到照片补录
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="font-display text-lg font-semibold text-gold-200 mb-4 flex items-center gap-2">
              <Camera size={20} />
              课时签到照片
            </h2>
            {batch.photos.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <Camera size={48} className="mx-auto mb-3 opacity-30" />
                <p>暂无签到照片</p>
                <p className="text-xs mt-2 text-white/30">课时签到照片常常藏着关键备注</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {batch.photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="cursor-pointer group"
                    onClick={() => setSelectedPhotoIndex(index)}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden mb-2 border-2 border-transparent group-hover:border-gold-800/50 transition-colors relative">
                      <img
                        src={photo.url}
                        alt={`签到照片 ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {photo.hasOldStandard && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-gray-800/90 text-gray-200 text-[10px]">
                          含旧口径
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-white/50 mb-1">{photo.takenAt}</p>
                    <p className="text-sm text-white/80 line-clamp-2">{photo.remark}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPhotoIndex !== null && batch.photos[selectedPhotoIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedPhotoIndex(null)}
        >
          <div className="max-w-3xl max-h-[80vh] animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <img
              src={batch.photos[selectedPhotoIndex].url}
              alt="放大照片"
              className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-4 p-4 rounded-lg bg-white/10 backdrop-blur-md">
              <p className="text-white font-medium mb-1">
                {batch.photos[selectedPhotoIndex].remark}
              </p>
              <p className="text-sm text-white/50">
                拍摄时间：{batch.photos[selectedPhotoIndex].takenAt}
              </p>
              {batch.photos[selectedPhotoIndex].hasOldStandard && (
                <p className="text-xs text-gold-300 mt-2">
                  ⚠️ 这张照片包含旧口径备注
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedPhotoIndex(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {supplementModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSupplementModal(null)}
        >
          <div
            className="glass-card w-full max-w-md animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gold-800/30 flex items-center justify-center">
                  <Camera className="text-gold-400" size={20} />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-gold-200">从签到照片补录</h3>
                  <p className="text-xs text-white/50">确认把旧口径信息补录到曲目上</p>
                </div>
              </div>
              <button
                onClick={() => setSupplementModal(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 rounded-lg bg-gray-800/30 border border-gray-700/30">
                <p className="text-xs text-gray-400 mb-2">照片里的原话：</p>
                <p className="text-sm text-gold-200 italic">"{supplementModal.photoRemark}"</p>
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-2">补录原因</label>
                <textarea
                  value={supplementReason}
                  onChange={(e) => setSupplementReason(e.target.value)}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="请输入补录原因，会记录在历史里"
                />
              </div>

              <div className="p-3 rounded bg-wine-900/20 border border-wine-800/30">
                <p className="text-xs text-wine-300">
                  补录后：
                </p>
                <ul className="text-sm text-white/80 mt-1 space-y-1">
                  <li>• 曲目口径将从「新口径」改为「旧口径」</li>
                  <li>• 状态将从「下架/待处理」改为「已修正」</li>
                  <li>• 照片原话、修改人、修改原因都会记录在历史里</li>
                  <li>• 授权提醒会同步更新</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10">
              <button
                onClick={() => setSupplementModal(null)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleConfirmSupplement}
                className="btn-gold"
                disabled={!supplementReason.trim()}
              >
                确认补录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

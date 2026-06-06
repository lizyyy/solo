import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Mic, Edit3, Camera, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useAppStore } from '@/store';
import { StatusBadge } from '@/components/StatusBadge';
import { TrackStatus, StandardType, AuthorizationStatus } from '@/types';

export const BatchDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { batches, rerunBatch, reviewMixedBatch, correctTrack, supplementFromPhoto, showHumanError, addToast } = useAppStore();
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

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

  const handleSupplement = (trackId: string, photoRemark: string) => {
    supplementFromPhoto(batch.id, trackId, photoRemark);
    addToast('info', '授权提醒已同步更新');
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
          <div className="mb-6 p-4 rounded-lg bg-orange-700/20 border border-orange-700/30 flex items-start gap-3">
            <AlertTriangle className="text-orange-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-orange-200 font-medium">⚠️ 赠票售票混批提醒</p>
              <p className="text-sm text-orange-200/70">
                这批里有赠票也有售票，得麻烦录音师看过才行。别急着归正常，现在的状态是正确的。
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
                      <p className="text-sm text-gold-200">📝 {track.remark}</p>
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
                              correctTrack(batch.id, track.id, { status: e.target.value as TrackStatus });
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
                              correctTrack(batch.id, track.id, { standard: e.target.value as StandardType });
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
                      {batch.photos.some(p => p.hasOldStandard) && track.standard === 'new' && (
                        <button
                          onClick={() => {
                            const photoWithRemark = batch.photos.find(p => p.hasOldStandard);
                            if (photoWithRemark) {
                              handleSupplement(track.id, photoWithRemark.remark);
                            }
                          }}
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
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {batch.photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="cursor-pointer group"
                    onClick={() => setSelectedPhotoIndex(index)}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden mb-2 border-2 border-transparent group-hover:border-gold-800/50 transition-colors">
                      <img
                        src={photo.url}
                        alt={`签到照片 ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <p className="text-xs text-white/50 mb-1">{photo.takenAt}</p>
                    <p className="text-sm text-white/80 line-clamp-2">{photo.remark}</p>
                    {photo.hasOldStandard && (
                      <span className="inline-block mt-2 px-2 py-0.5 rounded bg-gray-700/50 text-gray-300 text-[10px]">
                        含旧口径备注
                      </span>
                    )}
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
    </div>
  );
};

import React, { useState } from 'react';
import {
  UserCheck,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Music,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import type { SubstituteSong } from '../types';

export const SubstituteReviewPage: React.FC = () => {
  const {
    substituteSongs,
    setCurrentPage,
    previousPage,
    approveSubstitute,
    rejectSubstitute,
    currentUser,
  } = useAppStore();

  const [selectedSub, setSelectedSub] = useState<SubstituteSong | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const pendingSongs = substituteSongs.filter(s => s.status === 'pending_review');
  const approvedSongs = substituteSongs.filter(s => s.status === 'approved');
  const rejectedSongs = substituteSongs.filter(s => s.status === 'rejected');

  const getSourceTypeLabel = (type: string) => {
    switch (type) {
      case 'wechat_group': return '微信群消息';
      case 'official_notice': return '正式通知';
      default: return '其他渠道';
    }
  };

  const getSourceTypeIcon = (type: string) => {
    switch (type) {
      case 'wechat_group': return <MessageSquare size={16} />;
      case 'official_notice': return <FileText size={16} />;
      default: return <AlertTriangle size={16} />;
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN');
  };

  const handleApprove = (sub: SubstituteSong) => {
    approveSubstitute(sub.id, '票务同事复核通过，替补有效');
  };

  const handleReject = (sub: SubstituteSong) => {
    setSelectedSub(sub);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    if (selectedSub && rejectReason) {
      rejectSubstitute(selectedSub.id, rejectReason);
      setShowRejectModal(false);
      setSelectedSub(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {previousPage && (
            <button
              onClick={() => {
                if (previousPage) {
                  setCurrentPage(previousPage);
                }
              }}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-800">临时替补复核</h2>
            <p className="text-slate-500 mt-1">票务同事复核临时替补歌曲，别急着归正常，确认无误再通过</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-primary-700">李</span>
          </div>
          <span className="text-sm text-slate-600">当前: {currentUser.name} (模拟票务同事操作)</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">待复核</p>
          <p className="text-2xl font-bold text-warning-600 mt-1">{pendingSongs.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">已通过</p>
          <p className="text-2xl font-bold text-success-600 mt-1">{approvedSongs.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">已拒绝</p>
          <p className="text-2xl font-bold text-danger-600 mt-1">{rejectedSongs.length}</p>
        </div>
      </div>

      <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-warning-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-sm font-semibold text-warning-800 mb-1">复核提示</h3>
            <p className="text-sm text-warning-700">
              临时替补只在群里说了一句时，<strong>别急着归正常</strong>。
              请仔细核实替换来源是否有正式通知、确认邮件或书面文件。
              只有确认无误的替补才能通过复核。
            </p>
          </div>
        </div>
      </div>

      {pendingSongs.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-warning-600" />
            待复核 ({pendingSongs.length})
          </h3>
          <div className="space-y-4">
            {pendingSongs.map(sub => (
              <div
                key={sub.id}
                className="bg-white rounded-xl shadow-sm border-2 border-warning-200 overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-warning-100 rounded-lg flex items-center justify-center">
                        <Music size={28} className="text-warning-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-slate-500">原曲:</span>
                          <span className="font-medium text-slate-800">{sub.originalSongName}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-sm text-slate-500">替补:</span>
                          <span className="font-semibold text-primary-700">{sub.substituteSongName}</span>
                          <span className="text-sm text-slate-500">({sub.substituteArtist})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            sub.sourceType === 'wechat_group'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {getSourceTypeIcon(sub.sourceType)}
                            {getSourceTypeLabel(sub.sourceType)}
                          </span>
                          <span className="text-xs text-slate-400">
                            提交于 {formatDate(sub.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-warning-100 text-warning-700">
                      <Clock size={14} />
                      待复核
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                    <p className="text-xs text-slate-500 mb-1">来源详情:</p>
                    <p className="text-sm text-slate-700">{sub.sourceDetail}</p>
                  </div>

                  {sub.sourceType === 'wechat_group' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-orange-700 flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        <strong>注意:</strong> 此替补仅来自微信群消息，请核实是否有正式通知。
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      通知人: 阿梅 (巡演统筹)
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleReject(sub)}
                        className="flex items-center gap-2 px-4 py-2 border border-danger-300 text-danger-700 rounded-lg text-sm hover:bg-danger-50"
                      >
                        <XCircle size={16} />
                        拒绝
                      </button>
                      <button
                        onClick={() => handleApprove(sub)}
                        className="flex items-center gap-2 px-4 py-2 bg-success-600 text-white rounded-lg text-sm hover:bg-success-700"
                      >
                        <CheckCircle size={16} />
                        复核通过
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvedSongs.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle size={20} className="text-success-600" />
            已通过 ({approvedSongs.length})
          </h3>
          <div className="space-y-3">
            {approvedSongs.map(sub => (
              <div
                key={sub.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
                      <Music size={20} className="text-success-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {sub.originalSongName} → {sub.substituteSongName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {sub.substituteArtist} · 复核于 {sub.reviewedAt ? formatDate(sub.reviewedAt) : '-'}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700">
                    <CheckCircle size={12} />
                    已通过
                  </span>
                </div>
                {sub.reviewRemark && (
                  <p className="text-xs text-slate-500 mt-2 bg-slate-50 px-3 py-1.5 rounded">
                    复核意见: {sub.reviewRemark}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {rejectedSongs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <XCircle size={20} className="text-danger-600" />
            已拒绝 ({rejectedSongs.length})
          </h3>
          <div className="space-y-3">
            {rejectedSongs.map(sub => (
              <div
                key={sub.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 opacity-75"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center">
                      <Music size={20} className="text-danger-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {sub.originalSongName} → {sub.substituteSongName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {sub.substituteArtist}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-danger-100 text-danger-700">
                    <XCircle size={12} />
                    已拒绝
                  </span>
                </div>
                {sub.reviewRemark && (
                  <p className="text-xs text-danger-600 mt-2 bg-danger-50 px-3 py-1.5 rounded">
                    拒绝原因: {sub.reviewRemark}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {substituteSongs.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <UserCheck size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">暂无替补歌曲需要复核</p>
          <p className="text-sm text-slate-400 mt-1">有临时替补时会在这里显示</p>
        </div>
      )}

      {showRejectModal && selectedSub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">拒绝替补</h3>
            <p className="text-sm text-slate-600 mb-4">
              正在拒绝: <span className="font-medium">{selectedSub.substituteSongName}</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">拒绝原因 *</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-danger-500 focus:border-danger-500"
                rows={3}
                placeholder="请说明拒绝的原因..."
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-danger-600 text-white rounded-lg text-sm hover:bg-danger-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

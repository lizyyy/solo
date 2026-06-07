import React, { useState } from 'react';
import { Calendar, MapPin, Building2, Edit2, Music, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import type { AuthorizationPeriod } from '../types';

export const AuthorizationPage: React.FC = () => {
  const {
    authorizationPeriods,
    audioRemarks,
    updateAuthorization,
    selectedAuthId,
    setSelectedAuthId,
    setCurrentPage,
  } = useAppStore();

  const [editingAuth, setEditingAuth] = useState<AuthorizationPeriod | null>(null);
  const [editForm, setEditForm] = useState({
    endDate: '',
    remarks: '',
    authorizedPlatform: '',
    authorizedRegion: '',
  });

  const selectedAuth = authorizationPeriods.find(a => a.id === selectedAuthId);

  const getStatusConfig = (status: AuthorizationPeriod['status']) => {
    switch (status) {
      case 'valid':
        return { label: '有效', color: 'bg-success-100 text-success-700', icon: <CheckCircle size={14} /> };
      case 'expiring':
        return { label: '即将到期', color: 'bg-warning-100 text-warning-700', icon: <AlertTriangle size={14} /> };
      case 'expired':
        return { label: '已过期', color: 'bg-danger-100 text-danger-700', icon: <XCircle size={14} /> };
    }
  };

  const handleEdit = (auth: AuthorizationPeriod) => {
    setEditingAuth(auth);
    setEditForm({
      endDate: auth.endDate,
      remarks: auth.remarks,
      authorizedPlatform: auth.authorizedPlatform.join(', '),
      authorizedRegion: auth.authorizedRegion.join(', '),
    });
  };

  const handleSaveEdit = () => {
    if (editingAuth) {
      updateAuthorization(
        editingAuth.id,
        {
          endDate: editForm.endDate,
          remarks: editForm.remarks,
          authorizedPlatform: editForm.authorizedPlatform.split(',').map(p => p.trim()).filter(Boolean),
          authorizedRegion: editForm.authorizedRegion.split(',').map(r => r.trim()).filter(Boolean),
          status: new Date(editForm.endDate) > new Date() ? 'valid' : 'expired',
        },
        '更新授权期限信息'
      );
      setEditingAuth(null);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('zh-CN');
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">授权期限页</h2>
          <p className="text-slate-500 mt-1">管理所有歌曲的授权信息，包括平台、地区和有效期</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">总授权数</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{authorizationPeriods.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">有效授权</p>
          <p className="text-2xl font-bold text-success-600 mt-1">
            {authorizationPeriods.filter(a => a.status === 'valid').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">即将到期</p>
          <p className="text-2xl font-bold text-warning-600 mt-1">
            {authorizationPeriods.filter(a => a.status === 'expiring').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">已过期</p>
          <p className="text-2xl font-bold text-danger-600 mt-1">
            {authorizationPeriods.filter(a => a.status === 'expired').length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {authorizationPeriods.map(auth => {
          const statusConfig = getStatusConfig(auth.status);
          const daysRemaining = getDaysRemaining(auth.endDate);
          const audio = audioRemarks.find(a => a.id === auth.audioFileId);

          return (
            <div
              key={auth.id}
              className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden cursor-pointer transition-all ${
                selectedAuthId === auth.id
                  ? 'border-primary-500 shadow-md'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setSelectedAuthId(auth.id)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Music size={24} className="text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{auth.songName}</h3>
                      <p className="text-sm text-slate-500">{audio?.artist}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={16} className="text-slate-400" />
                    <span className="text-slate-500">有效期:</span>
                    <span className="text-slate-700">{formatDate(auth.startDate)} ~ {formatDate(auth.endDate)}</span>
                    {auth.status === 'expiring' && (
                      <span className="text-warning-600 font-medium">({daysRemaining}天后到期)</span>
                    )}
                    {auth.status === 'expired' && (
                      <span className="text-danger-600 font-medium">(已过期{Math.abs(daysRemaining)}天)</span>
                    )}
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    <Building2 size={16} className="text-slate-400 mt-0.5" />
                    <span className="text-slate-500">授权平台:</span>
                    <div className="flex flex-wrap gap-1">
                      {auth.authorizedPlatform.map(platform => (
                        <span key={platform} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {platform}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    <MapPin size={16} className="text-slate-400 mt-0.5" />
                    <span className="text-slate-500">授权地区:</span>
                    <div className="flex flex-wrap gap-1">
                      {auth.authorizedRegion.map(region => (
                        <span key={region} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                          {region}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="text-slate-500">授权编号: </span>
                    <span className="text-slate-700 font-mono">{auth.licenseNumber}</span>
                  </div>

                  {auth.remarks && (
                    <div className="text-sm bg-slate-50 p-3 rounded-lg">
                      <span className="text-slate-500">备注: </span>
                      <span className="text-slate-700">{auth.remarks}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    更新于 {formatDate(auth.updatedAt)}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleEdit(auth);
                      }}
                      className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                      title="编辑"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setCurrentPage('compliance_check');
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      查看合规检查 →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {audioRemarks.filter(a => !authorizationPeriods.find(auth => auth.audioFileId === a.id)).map(audio => (
          <div
            key={audio.id}
            className="bg-white rounded-xl shadow-sm border-2 border-dashed border-slate-300 overflow-hidden"
          >
            <div className="p-5 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Music size={24} className="text-slate-400" />
              </div>
              <h3 className="font-medium text-slate-700">{audio.songName}</h3>
              <p className="text-sm text-slate-500 mb-3">{audio.artist}</p>
              <p className="text-xs text-slate-400 mb-3">暂无授权记录</p>
              <button
                onClick={() => setCurrentPage('compliance_check')}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                去做合规检查 →
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedAuth && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">授权详情: {selectedAuth.songName}</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500 mb-1">授权编号</p>
              <p className="text-sm font-mono text-slate-800">{selectedAuth.licenseNumber}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">关联音频ID</p>
              <p className="text-sm font-mono text-slate-800">{selectedAuth.audioFileId}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">历史变更记录</p>
              <p className="text-sm text-slate-800">{selectedAuth.history.length} 条</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">最后更新人</p>
              <p className="text-sm text-slate-800">阿梅</p>
            </div>
          </div>
          {selectedAuth.history.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-2">变更历史</p>
              <div className="space-y-2">
                {selectedAuth.history.slice(0, 3).map(h => (
                  <div key={h.id} className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded">
                    <span className="text-slate-700">{h.userName}</span> {h.remark} - {formatDate(h.timestamp)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {editingAuth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">编辑授权</h3>
            <p className="text-sm text-slate-600 mb-4">
              正在编辑: <span className="font-medium">{editingAuth.songName}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">到期日期</label>
                <input
                  type="date"
                  value={editForm.endDate}
                  onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">授权平台（逗号分隔）</label>
                <input
                  type="text"
                  value={editForm.authorizedPlatform}
                  onChange={e => setEditForm(f => ({ ...f, authorizedPlatform: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">授权地区（逗号分隔）</label>
                <input
                  type="text"
                  value={editForm.authorizedRegion}
                  onChange={e => setEditForm(f => ({ ...f, authorizedRegion: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
                <textarea
                  value={editForm.remarks}
                  onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingAuth(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

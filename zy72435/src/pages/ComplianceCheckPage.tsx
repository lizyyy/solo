import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Music,
  ArrowLeft,
  Edit2,
  Play,
  MessageSquare,
  Users,
  FileText,
  List,
  BarChart3,
} from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import type { ComplianceCheck, ComplianceStatus, NextStepOwner } from '../types';

export const ComplianceCheckPage: React.FC = () => {
  const {
    complianceChecks,
    audioRemarks,
    selectedComplianceId,
    setSelectedComplianceId,
    setCurrentPage,
    previousPage,
    setPreviousPage,
    runComplianceCheck,
    updateComplianceCheck,
  } = useAppStore();

  const [filterStatus, setFilterStatus] = useState<ComplianceStatus | 'all'>('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingCheck, setEditingCheck] = useState<ComplianceCheck | null>(null);
  const [editForm, setEditForm] = useState({
    keptReason: '',
    missingMaterials: '',
    nextStep: '',
    nextStepOwner: 'tour_coordinator' as NextStepOwner,
    remarks: '',
  });
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  const filteredChecks = filterStatus === 'all'
    ? complianceChecks
    : complianceChecks.filter(c => c.status === filterStatus);

  const selectedCheck = complianceChecks.find(c => c.id === selectedComplianceId);

  const getStatusConfig = (status: ComplianceStatus) => {
    switch (status) {
      case 'compliant':
        return { label: '合规', color: 'bg-success-100 text-success-700', icon: <CheckCircle size={14} /> };
      case 'pending':
        return { label: '待补充', color: 'bg-warning-100 text-warning-700', icon: <Clock size={14} /> };
      case 'needs_review':
        return { label: '待复核', color: 'bg-blue-100 text-blue-700', icon: <AlertTriangle size={14} /> };
      case 'non_compliant':
        return { label: '不合规', color: 'bg-danger-100 text-danger-700', icon: <XCircle size={14} /> };
    }
  };

  const getOwnerName = (owner: NextStepOwner) => {
    switch (owner) {
      case 'tour_coordinator': return '巡演统筹阿梅';
      case 'ticket_staff': return '票务同事';
      case 'legal': return '法务同事';
      case 'artist_management': return '经纪人团队';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-danger-50 text-danger-700 border-danger-200';
      case 'medium': return 'bg-warning-50 text-warning-700 border-warning-200';
      case 'low': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const handleRunCheck = (audioFileId: string) => {
    runComplianceCheck(audioFileId);
  };

  const handleEdit = (check: ComplianceCheck) => {
    setEditingCheck(check);
    setEditForm({
      keptReason: check.keptReason,
      missingMaterials: check.missingMaterials.join(', '),
      nextStep: check.nextStep,
      nextStepOwner: check.nextStepOwner,
      remarks: check.remarks,
    });
  };

  const handleSaveEdit = () => {
    if (editingCheck) {
      updateComplianceCheck(
        editingCheck.id,
        {
          keptReason: editForm.keptReason,
          missingMaterials: editForm.missingMaterials.split(',').map(m => m.trim()).filter(Boolean),
          nextStep: editForm.nextStep,
          nextStepOwner: editForm.nextStepOwner,
          remarks: editForm.remarks,
        },
        '更新合规检查详情'
      );
      setEditingCheck(null);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN');
  };

  const handleViewDetail = (check: ComplianceCheck) => {
    setSelectedComplianceId(check.id);
    setShowDetailModal(true);
  };

  const handleGoBack = () => {
    if (previousPage) {
      setCurrentPage(previousPage);
      setPreviousPage(null);
    }
  };

  const stats = {
    total: complianceChecks.length,
    compliant: complianceChecks.filter(c => c.status === 'compliant').length,
    pending: complianceChecks.filter(c => c.status === 'pending' || c.status === 'needs_review').length,
    nonCompliant: complianceChecks.filter(c => c.status === 'non_compliant').length,
    hasSubstitute: complianceChecks.filter(c => c.isSubstitute && !c.substituteVerified).length,
  };

  const uncheckedAudio = audioRemarks.filter(
    a => !complianceChecks.find(c => c.audioFileId === a.id)
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {previousPage && (
            <button
              onClick={handleGoBack}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-800">电台歌单合规检查</h2>
            <p className="text-slate-500 mt-1">对音频文件进行合规性检查，记录问题和处理进度</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded ${viewMode === 'card' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            >
              <FileText size={18} />
            </button>
          </div>
          <button
            onClick={() => setCurrentPage('compliance_chart')}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
          >
            <BarChart3 size={16} />
            图表视图
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">总检查数</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">合规通过</p>
          <p className="text-2xl font-bold text-success-600 mt-1">{stats.compliant}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">待处理</p>
          <p className="text-2xl font-bold text-warning-600 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">不合规</p>
          <p className="text-2xl font-bold text-danger-600 mt-1">{stats.nonCompliant}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <p className="text-sm text-slate-500">待复核替补</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.hasSubstitute}</p>
        </div>
      </div>

      {uncheckedAudio.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-blue-600" size={20} />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  还有 {uncheckedAudio.length} 个音频文件未进行合规检查
                </p>
                <p className="text-xs text-blue-600">
                  {uncheckedAudio.map(a => a.songName).join('、')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {uncheckedAudio.slice(0, 2).map(audio => (
                <button
                  key={audio.id}
                  onClick={() => handleRunCheck(audio.id)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
                >
                  <Play size={14} />
                  检查 {audio.songName}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-slate-600">筛选:</span>
        {(['all', 'compliant', 'pending', 'needs_review', 'non_compliant'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              filterStatus === status
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {status === 'all' ? '全部' : getStatusConfig(status).label}
          </button>
        ))}
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">歌曲</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">状态</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">问题</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">下一步</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">负责人</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">替补</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">检查时间</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredChecks.map(check => {
                const statusConfig = getStatusConfig(check.status);
                return (
                  <tr
                    key={check.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleViewDetail(check)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                          <Music size={18} className="text-primary-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{check.songName}</p>
                          <p className="text-xs text-slate-500">{check.artist}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {check.issues.length === 0 ? (
                          <span className="text-xs text-success-600">无问题</span>
                        ) : (
                          check.issues.slice(0, 2).map(issue => (
                            <span
                              key={issue.id}
                              className={`text-xs px-2 py-0.5 rounded border ${getSeverityColor(issue.severity)}`}
                            >
                              {issue.description.slice(0, 15)}...
                            </span>
                          ))
                        )}
                        {check.issues.length > 2 && (
                          <span className="text-xs text-slate-500">+{check.issues.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                      {check.nextStep || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                        {getOwnerName(check.nextStepOwner)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {check.isSubstitute ? (
                        <span className={`text-xs px-2 py-1 rounded ${
                          check.substituteVerified
                            ? 'bg-success-100 text-success-700'
                            : 'bg-warning-100 text-warning-700'
                        }`}>
                          {check.substituteVerified ? '已确认' : '待确认'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {formatDate(check.checkDate)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleEdit(check);
                          }}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                          title="编辑"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setCurrentPage('audio_remarks');
                          }}
                          className="p-1.5 text-slate-400 hover:text-success-600 hover:bg-success-50 rounded"
                          title="查看音频备注"
                        >
                          <Music size={16} />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setCurrentPage('authorization');
                          }}
                          className="p-1.5 text-slate-400 hover:text-warning-600 hover:bg-warning-50 rounded"
                          title="查看授权"
                        >
                          <Clock size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredChecks.map(check => {
            const statusConfig = getStatusConfig(check.status);
            return (
              <div
                key={check.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewDetail(check)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                      <Music size={18} className="text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-800">{check.songName}</h3>
                      <p className="text-xs text-slate-500">{check.artist}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                </div>

                {check.issues.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {check.issues.slice(0, 2).map(issue => (
                      <div key={issue.id} className={`text-xs px-2 py-1.5 rounded border ${getSeverityColor(issue.severity)}`}>
                        {issue.description}
                      </div>
                    ))}
                  </div>
                )}

                {check.keptReason && (
                  <div className="text-xs bg-slate-50 p-2 rounded mb-3">
                    <span className="text-slate-500">保留原因: </span>
                    <span className="text-slate-700">{check.keptReason.slice(0, 50)}...</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400">{formatDate(check.checkDate)}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Users size={12} />
                    {getOwnerName(check.nextStepOwner)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showDetailModal && selectedCheck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{selectedCheck.songName}</h3>
                <p className="text-sm text-slate-500">{selectedCheck.artist}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleEdit(selectedCheck);
                  }}
                  className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <XCircle size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusConfig(selectedCheck.status).color}`}>
                  {getStatusConfig(selectedCheck.status).icon}
                  {getStatusConfig(selectedCheck.status).label}
                </span>
                {selectedCheck.isSubstitute && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                    selectedCheck.substituteVerified
                      ? 'bg-success-100 text-success-700'
                      : 'bg-warning-100 text-warning-700'
                  }`}>
                    <MessageSquare size={14} />
                    {selectedCheck.substituteVerified ? '替补已确认' : '替补待确认'}
                    {selectedCheck.substituteSource === 'wechat_group' && ' (微信群来源)'}
                  </span>
                )}
              </div>

              {selectedCheck.issues.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">发现的问题</h4>
                  <div className="space-y-2">
                    {selectedCheck.issues.map(issue => (
                      <div key={issue.id} className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}>
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{issue.description}</p>
                            <p className="text-xs opacity-75 mt-1">严重程度: {issue.severity === 'high' ? '高' : issue.severity === 'medium' ? '中' : '低'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedCheck.keptReason && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">为什么被留下</h4>
                  <div className="p-3 bg-success-50 border border-success-200 rounded-lg">
                    <p className="text-sm text-success-800">{selectedCheck.keptReason}</p>
                  </div>
                </div>
              )}

              {selectedCheck.missingMaterials.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">还缺什么材料</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCheck.missingMaterials.map((material, idx) => (
                      <span key={idx} className="text-sm bg-warning-100 text-warning-700 px-3 py-1.5 rounded-lg">
                        {material}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedCheck.nextStep && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">下一步该找谁</h4>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Users size={16} className="text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">{getOwnerName(selectedCheck.nextStepOwner)}</span>
                    </div>
                    <p className="text-sm text-blue-700">{selectedCheck.nextStep}</p>
                  </div>
                </div>
              )}

              {selectedCheck.remarks && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">备注</h4>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{selectedCheck.remarks}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">操作历史</h4>
                <div className="space-y-3">
                  {selectedCheck.history.map(entry => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-slate-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{entry.userName}</span>
                          <span className="text-xs text-slate-500">{formatDate(entry.timestamp)}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {entry.action === 'create' && '创建了合规检查记录'}
                          {entry.action === 'update' && entry.field && (
                            <>
                              修改了 <span className="font-mono text-primary-600">{String(entry.field)}</span>
                              {entry.oldValue !== undefined && entry.newValue !== undefined && (
                                <>
                                  {' '}从 <span className="text-danger-600">{String(entry.oldValue)}</span>
                                  {' '}改为 <span className="text-success-600">{String(entry.newValue)}</span>
                                </>
                              )}
                            </>
                          )}
                          {entry.remark && ` - ${entry.remark}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setCurrentPage('audio_remarks');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <Music size={16} />
                  查看音频备注
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setCurrentPage('authorization');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <Clock size={16} />
                  查看授权期限
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingCheck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">编辑合规检查</h3>
            <p className="text-sm text-slate-600 mb-4">
              正在编辑: <span className="font-medium">{editingCheck.songName}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">保留原因</label>
                <textarea
                  value={editForm.keptReason}
                  onChange={e => setEditForm(f => ({ ...f, keptReason: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                  placeholder="说明为什么这首歌要保留在歌单中"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">缺少的材料（逗号分隔）</label>
                <input
                  type="text"
                  value={editForm.missingMaterials}
                  onChange={e => setEditForm(f => ({ ...f, missingMaterials: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="例如: 授权书, 版权确认函"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">下一步操作</label>
                <textarea
                  value={editForm.nextStep}
                  onChange={e => setEditForm(f => ({ ...f, nextStep: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                  placeholder="具体说明下一步该做什么"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">负责人</label>
                <select
                  value={editForm.nextStepOwner}
                  onChange={e => setEditForm(f => ({ ...f, nextStepOwner: e.target.value as NextStepOwner }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="tour_coordinator">巡演统筹阿梅</option>
                  <option value="ticket_staff">票务同事</option>
                  <option value="legal">法务同事</option>
                  <option value="artist_management">经纪人团队</option>
                </select>
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
                onClick={() => setEditingCheck(null)}
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

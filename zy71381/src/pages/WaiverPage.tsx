import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useDependencyStore } from '../store/dependencyStore';
import { useWaiverStore } from '../store/waiverStore';
import { ProjectSelector } from '../components/ProjectSelector';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import {
  FileText,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  AlertTriangle,
  History,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { Waiver, Dependency } from '../types';
import { WAIVER_STATUS_LABELS, DEPENDENCY_STATUS_LABELS } from '../types';
import dayjs from 'dayjs';

export function WaiverPage() {
  const { currentProject } = useProjectStore();
  const { dependencies, loadDependencies } = useDependencyStore();
  const {
    waivers,
    loading,
    loadWaivers,
    createWaiver,
    approveWaiver,
    rejectWaiver,
    renewWaiver,
    deleteWaiver,
    checkExpiry,
  } = useWaiverStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedDepId, setSelectedDepId] = useState('');
  const [newWaiver, setNewWaiver] = useState({
    reason: '',
    approver: '',
    expireDate: dayjs().add(90, 'day').format('YYYY-MM-DD'),
    notes: '',
  });
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'expired'>('pending');

  useEffect(() => {
    if (currentProject) {
      loadDependencies(currentProject.id);
      loadWaivers(currentProject.id);
      checkExpiry(currentProject.id);
    }
  }, [currentProject, loadDependencies, loadWaivers, checkExpiry]);

  const filteredWaivers = waivers.filter((w) => {
    const isExpired = w.expireDate && dayjs(w.expireDate).isBefore(dayjs());
    if (activeTab === 'expired') return isExpired;
    if (isExpired) return false;
    return w.status === activeTab;
  });

  const availableDeps = dependencies.filter(
    (d) =>
      d.status === 'waiver_pending' &&
      !waivers.some((w) => w.dependencyId === d.id && w.status !== 'rejected')
  );

  const selectedDep = dependencies.find((d) => d.id === selectedDepId);

  const handleCreateWaiver = async () => {
    if (!currentProject || !selectedDepId || !newWaiver.reason.trim()) return;
    await createWaiver(currentProject.id, selectedDepId, {
      reason: newWaiver.reason,
      approver: newWaiver.approver || '手动审批',
      expireDate: newWaiver.expireDate,
      notes: newWaiver.notes,
    });
    setShowNewModal(false);
    setSelectedDepId('');
    setNewWaiver({
      reason: '',
      approver: '',
      expireDate: dayjs().add(90, 'day').format('YYYY-MM-DD'),
      notes: '',
    });
  };

  const handleRenew = async (waiverId: string) => {
    const newExpire = dayjs().add(90, 'day').format('YYYY-MM-DD');
    await renewWaiver(waiverId, newExpire);
  };

  const getDependencyInfo = (dependencyId: string) => {
    return dependencies.find((d) => d.id === dependencyId);
  };

  const getStatusBadgeClass = (status: string, expireDate?: number) => {
    const isExpired = expireDate && dayjs(expireDate).isBefore(dayjs());
    if (isExpired) return 'badge bg-red-100 text-risk-critical';
    switch (status) {
      case 'approved':
        return 'badge bg-blue-100 text-blue-600';
      case 'rejected':
        return 'badge bg-red-100 text-risk-critical';
      case 'pending':
      default:
        return 'badge bg-orange-100 text-orange-600';
    }
  };

  const renderWaiverCard = (waiver: Waiver) => {
    const dep = getDependencyInfo(waiver.dependencyId);
    const isExpired = waiver.expireDate && dayjs(waiver.expireDate).isBefore(dayjs());
    const daysToExpire = waiver.expireDate
      ? dayjs(waiver.expireDate).diff(dayjs(), 'day')
      : null;

    return (
      <div
        key={waiver.id}
        className={`card p-4 ${
          isExpired
            ? 'border-risk-critical bg-red-50/30'
            : waiver.status === 'approved'
            ? 'border-blue-300'
            : waiver.status === 'rejected'
            ? 'border-risk-critical'
            : 'border-orange-300'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {dep && (
                <>
                  <span className="font-mono font-semibold">{dep.packageName}</span>
                  <span className="font-mono text-sm text-slate-500">
                    @{dep.packageVersion}
                  </span>
                </>
              )}
              <span className={getStatusBadgeClass(waiver.status, waiver.expireDate)}>
                {isExpired ? '已过期' : WAIVER_STATUS_LABELS[waiver.status]}
              </span>
              {daysToExpire !== null && daysToExpire <= 30 && daysToExpire > 0 && (
                <span className="badge bg-amber-100 text-amber-600 text-[10px] flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  剩 {daysToExpire} 天
                </span>
              )}
            </div>
            {dep && (
              <div className="flex items-center gap-3 mb-3">
                <RiskBadge level={dep.riskLevel} size="sm" />
                <StatusBadge status={dep.status} size="sm" showIcon={false} />
              </div>
            )}
            <div className="space-y-2 text-sm">
              <p className="text-slate-700">
                <strong>豁免理由：</strong>
                {waiver.reason}
              </p>
              {waiver.approver && (
                <p className="text-slate-600">
                  <strong>审批人：</strong>
                  {waiver.approver}
                </p>
              )}
              {waiver.approvalDate && (
                <p className="text-slate-500 text-xs">
                  审批时间：{dayjs(waiver.approvalDate).format('YYYY-MM-DD HH:mm')}
                </p>
              )}
              {waiver.expireDate && (
                <p className={`text-xs ${isExpired ? 'text-risk-critical' : 'text-slate-500'}`}>
                  <Calendar className="w-3 h-3 inline mr-1" />
                  有效期至：{dayjs(waiver.expireDate).format('YYYY-MM-DD')}
                </p>
              )}
              {waiver.approvalNotes && (
                <p className="text-slate-600 text-xs bg-slate-50 p-2 rounded">
                  <strong>审批意见：</strong>
                  {waiver.approvalNotes}
                </p>
              )}
              {waiver.notes && (
                <p className="text-slate-500 text-xs">
                  备注：{waiver.notes}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 ml-4">
            {waiver.status === 'pending' && (
              <>
                <button
                  onClick={() => {
                    const notes = prompt('请输入审批意见（可选）');
                    if (notes !== null) approveWaiver(waiver.id, notes || undefined);
                  }}
                  className="btn-primary text-xs py-1 px-2 flex items-center gap-1"
                >
                  <CheckCircle className="w-3 h-3" />
                  通过
                </button>
                <button
                  onClick={() => {
                    const notes = prompt('请输入驳回理由（可选）');
                    if (notes !== null) rejectWaiver(waiver.id, notes || undefined);
                  }}
                  className="btn-secondary text-xs py-1 px-2 flex items-center gap-1 text-risk-critical border-risk-critical"
                >
                  <XCircle className="w-3 h-3" />
                  驳回
                </button>
              </>
            )}
            {waiver.status === 'approved' && (
              <button
                onClick={() => handleRenew(waiver.id)}
                className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                title="续期90天"
              >
                <RefreshCw className="w-3 h-3" />
                续期
              </button>
            )}
            <button
              onClick={() => {
                if (confirm('确定删除该豁免记录？')) {
                  deleteWaiver(waiver.id);
                }
              }}
              className="p-1 hover:bg-red-100 rounded text-red-500 text-xs"
              title="删除"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        {waiver.statusHistory && waiver.statusHistory.length > 1 && (
          <div className="mt-4 pt-3 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
              <History className="w-3 h-3" />
              审批历史
            </p>
            <div className="space-y-1">
              {waiver.statusHistory.map((h, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className={getStatusBadgeClass(h.status)}>
                    {WAIVER_STATUS_LABELS[h.status]}
                  </span>
                  <span className="text-slate-400">
                    {dayjs(h.timestamp).format('YYYY-MM-DD HH:mm')}
                  </span>
                  <span className="text-slate-500">· {h.operator}</span>
                  {h.notes && <span className="text-slate-600">· {h.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getStats = () => ({
    pending: waivers.filter((w) => w.status === 'pending').length,
    approved: waivers.filter((w) => w.status === 'approved' && !(w.expireDate && dayjs(w.expireDate).isBefore(dayjs()))).length,
    rejected: waivers.filter((w) => w.status === 'rejected').length,
    expired: waivers.filter((w) => w.expireDate && dayjs(w.expireDate).isBefore(dayjs())).length,
  });

  const stats = getStats();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-slate-900">
            豁免管理
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            管理风险依赖的豁免审批，自动检测过期豁免
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProjectSelector />
          <button
            onClick={() => setShowNewModal(true)}
            className="btn-primary flex items-center gap-2"
            disabled={availableDeps.length === 0}
          >
            <Plus className="w-4 h-4" />
            新建豁免
          </button>
        </div>
      </div>

      {currentProject ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="card p-4 bg-orange-50">
              <p className="text-xs text-orange-600 mb-1">待审批</p>
              <p className="text-2xl font-bold font-mono text-orange-600">{stats.pending}</p>
            </div>
            <div className="card p-4 bg-blue-50">
              <p className="text-xs text-blue-600 mb-1">已通过</p>
              <p className="text-2xl font-bold font-mono text-blue-600">{stats.approved}</p>
            </div>
            <div className="card p-4 bg-red-50">
              <p className="text-xs text-risk-critical mb-1">已驳回</p>
              <p className="text-2xl font-bold font-mono text-risk-critical">{stats.rejected}</p>
            </div>
            <div className="card p-4 bg-red-50 border-risk-critical">
              <p className="text-xs text-risk-critical mb-1">已过期</p>
              <p className="text-2xl font-bold font-mono text-risk-critical">{stats.expired}</p>
            </div>
          </div>

          <div className="card">
            <div className="p-4 border-b border-slate-200">
              <div className="flex bg-slate-100 rounded-md p-0.5 inline-flex">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-4 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 ${
                    activeTab === 'pending'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  待审批 ({stats.pending})
                </button>
                <button
                  onClick={() => setActiveTab('approved')}
                  className={`px-4 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 ${
                    activeTab === 'approved'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  已通过 ({stats.approved})
                </button>
                <button
                  onClick={() => setActiveTab('rejected')}
                  className={`px-4 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 ${
                    activeTab === 'rejected'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  已驳回 ({stats.rejected})
                </button>
                <button
                  onClick={() => setActiveTab('expired')}
                  className={`px-4 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 ${
                    activeTab === 'expired'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  已过期 ({stats.expired})
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto scrollbar-thin">
              {filteredWaivers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p>暂无{activeTab === 'pending' ? '待审批' : activeTab === 'approved' ? '已通过' : activeTab === 'rejected' ? '已驳回' : '已过期'}豁免记录</p>
                </div>
              ) : (
                filteredWaivers.map((waiver) => renderWaiverCard(waiver))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card p-12 text-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-serif text-xl font-semibold text-slate-700 mb-2">
            请先选择项目
          </h3>
          <p className="text-slate-500">
            选择项目后可管理豁免记录
          </p>
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[550px] shadow-xl animate-slide-up">
            <h3 className="font-serif text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" />
              新建豁免申请
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  选择依赖
                </label>
                <select
                  className="input"
                  value={selectedDepId}
                  onChange={(e) => setSelectedDepId(e.target.value)}
                >
                  <option value="">请选择需要豁免的依赖</option>
                  {availableDeps.map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.packageName}@{dep.packageVersion} - {dep.riskLevel === 'critical' ? '高风险' : dep.riskLevel === 'warning' ? '中风险' : '未知'}
                    </option>
                  ))}
                </select>
                {availableDeps.length === 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    暂无可申请豁免的依赖。请先在审查页将依赖状态标记为"豁免申请中"。
                  </p>
                )}
              </div>
              {selectedDep && (
                <div className="bg-slate-50 p-3 rounded-md">
                  <p className="text-sm text-slate-600">
                    <span className="font-mono font-semibold">{selectedDep.packageName}@{selectedDep.packageVersion}</span>
                    <span className="ml-2">许可证: {Array.isArray(selectedDep.license) ? selectedDep.license.join(' / ') : selectedDep.license}</span>
                  </p>
                  {selectedDep.blockReasons && selectedDep.blockReasons.length > 0 && (
                    <p className="text-xs text-risk-critical mt-1">
                      拦截原因: {selectedDep.blockReasons.map((r) => r.detail || r.type).join(', ')}
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  豁免理由 *
                </label>
                <textarea
                  className="textarea h-24"
                  value={newWaiver.reason}
                  onChange={(e) => setNewWaiver({ ...newWaiver, reason: e.target.value })}
                  placeholder="请详细说明豁免该依赖的理由..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    审批人
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={newWaiver.approver}
                    onChange={(e) => setNewWaiver({ ...newWaiver, approver: e.target.value })}
                    placeholder="法务审批人姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    有效期至 *
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={newWaiver.expireDate}
                    onChange={(e) => setNewWaiver({ ...newWaiver, expireDate: e.target.value })}
                    min={dayjs().format('YYYY-MM-DD')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  备注
                </label>
                <textarea
                  className="textarea h-16"
                  value={newWaiver.notes}
                  onChange={(e) => setNewWaiver({ ...newWaiver, notes: e.target.value })}
                  placeholder="其他需要说明的信息（可选）..."
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  className="btn-secondary"
                  onClick={() => setShowNewModal(false)}
                >
                  取消
                </button>
                <button
                  className="btn-primary"
                  onClick={handleCreateWaiver}
                  disabled={!selectedDepId || !newWaiver.reason.trim() || !newWaiver.expireDate}
                >
                  提交申请
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

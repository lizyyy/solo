import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useDependencyStore } from '../store/dependencyStore';
import { useWaiverStore } from '../store/waiverStore';
import { ProjectSelector } from '../components/ProjectSelector';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import {
  ShieldCheck,
  ShieldX,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  GitBranch,
  ExternalLink,
  Clock,
  History,
  ChevronDown,
  ChevronRight,
  Scale,
} from 'lucide-react';
import type { Dependency, DependencyStatus } from '../types';
import { isValidStatusTransition, DEPENDENCY_STATUS_LABELS, BLOCK_REASON_LABELS } from '../types';
import dayjs from 'dayjs';

export function ReviewPage() {
  const { currentProject } = useProjectStore();
  const { dependencies, loadDependencies, updateStatus } = useDependencyStore();
  const { waivers, loadWaivers } = useWaiverStore();

  const [selectedDep, setSelectedDep] = useState<Dependency | null>(null);
  const [newStatus, setNewStatus] = useState<DependencyStatus | ''>('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [expandedDeps, setExpandedDeps] = useState<Set<string>>(new Set());
  const [filterRisk, setFilterRisk] = useState<string>('all');

  useEffect(() => {
    if (currentProject) {
      loadDependencies(currentProject.id);
      loadWaivers(currentProject.id);
    }
  }, [currentProject, loadDependencies, loadWaivers]);

  const pendingDeps = dependencies.filter(
    (d) => d.status === 'pending_review' || d.status === 'parsed_normal' || d.status === 'blocked'
  );

  const approvedDeps = dependencies.filter((d) => d.status === 'approved');

  const waiverDeps = dependencies.filter(
    (d) => d.status.startsWith('waiver_')
  );

  const filteredDeps =
    filterRisk === 'all'
      ? pendingDeps
      : pendingDeps.filter((d) => d.riskLevel === filterRisk);

  const toggleExpand = (depId: string) => {
    setExpandedDeps((prev) => {
      const next = new Set(prev);
      if (next.has(depId)) {
        next.delete(depId);
      } else {
        next.add(depId);
      }
      return next;
    });
  };

  const openReviewModal = (dep: Dependency) => {
    setSelectedDep(dep);
    setNewStatus('');
    setReviewNotes('');
  };

  const handleStatusUpdate = async () => {
    if (!selectedDep || !newStatus) return;
    await updateStatus(selectedDep.id, newStatus, reviewNotes);
    setSelectedDep(null);
  };

  const getAvailableTransitions = (current: DependencyStatus): DependencyStatus[] => {
    const allTransitions: { from: DependencyStatus; to: DependencyStatus }[] = [
      { from: 'pending_review', to: 'approved' },
      { from: 'pending_review', to: 'blocked' },
      { from: 'pending_review', to: 'waiver_pending' },
      { from: 'parsed_normal', to: 'pending_review' },
      { from: 'parsed_normal', to: 'approved' },
      { from: 'parsed_normal', to: 'blocked' },
      { from: 'blocked', to: 'approved' },
      { from: 'blocked', to: 'waiver_pending' },
      { from: 'waiver_approved', to: 'approved' },
      { from: 'waiver_rejected', to: 'blocked' },
    ];
    return allTransitions.filter((t) => t.from === current).map((t) => t.to);
  };

  const renderBlockReasons = (dep: Dependency) => {
    if (!dep.blockReasons || dep.blockReasons.length === 0) return null;
    return (
      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
        <p className="text-xs font-medium text-red-700 mb-1">拦截原因：</p>
        <ul className="text-xs text-red-600 space-y-0.5">
          {dep.blockReasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{BLOCK_REASON_LABELS[reason.type] || reason.type}</span>
              {reason.detail && <span className="text-red-500">: {reason.detail}</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderStatusHistory = (dep: Dependency) => {
    if (!dep.statusHistory || dep.statusHistory.length === 0) return null;
    return (
      <div className="mt-3">
        <p className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
          <History className="w-3 h-3" />
          状态流转记录
        </p>
        <div className="space-y-2">
          {dep.statusHistory.map((h, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs">
              <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-primary-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">
                    {DEPENDENCY_STATUS_LABELS[h.status]}
                  </span>
                  <span className="text-slate-400">
                    {dayjs(h.timestamp).format('YYYY-MM-DD HH:mm')}
                  </span>
                  <span className="text-slate-500">· {h.operator}</span>
                </div>
                {h.notes && <p className="text-slate-500 mt-0.5">{h.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDependencyRow = (dep: Dependency, isTransitive = false) => {
    const isExpanded = expandedDeps.has(dep.id);
    const transitiveChildren = dependencies.filter(
      (d) => d.parentId === dep.id || dep.transitiveDependencies.includes(d.id)
    );
    const cardClass =
      dep.riskLevel === 'critical'
        ? 'border-l-4 border-risk-critical'
        : dep.riskLevel === 'warning'
        ? 'border-l-4 border-risk-warning'
        : dep.riskLevel === 'safe'
        ? 'border-l-4 border-risk-safe'
        : 'border-l-4 border-risk-unknown';

    return (
      <React.Fragment key={dep.id}>
        <div className={`bg-white border border-slate-200 rounded-md p-4 hover:shadow-sm transition-shadow ${cardClass} ${isTransitive ? 'ml-6' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {transitiveChildren.length > 0 && (
                  <button
                    onClick={() => toggleExpand(dep.id)}
                    className="p-0.5 hover:bg-slate-200 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                )}
                {isTransitive && <GitBranch className="w-3 h-3 text-slate-400" />}
                <span className="font-mono font-semibold text-slate-900">
                  {dep.packageName}
                </span>
                <span className="font-mono text-sm text-slate-500">
                  @{dep.packageVersion}
                </span>
                {Array.isArray(dep.license) && dep.license.length > 1 && (
                  <span className="badge badge-warning text-[10px]">双许可证</span>
                )}
              </div>
              <div className="flex items-center gap-4 mb-2 text-sm">
                <span className="font-mono text-slate-600">
                  许可证: {Array.isArray(dep.license) ? dep.license.join(' / ') : dep.license || '未知'}
                </span>
                {dep.repoUrl && (
                  <a
                    href={dep.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700"
                  >
                    <ExternalLink className="w-3 h-3" />
                    仓库
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3">
                <RiskBadge level={dep.riskLevel} />
                <StatusBadge status={dep.status} />
                {dep.isDirect && <span className="badge bg-slate-100 text-slate-600 text-[10px]">直接依赖</span>}
                {!dep.isDirect && <span className="badge bg-blue-100 text-blue-600 text-[10px]">传递依赖 · 深度 {dep.depth}</span>}
              </div>
              {renderBlockReasons(dep)}
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => openReviewModal(dep)}
                className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                <Scale className="w-3.5 h-3.5" />
                审查
              </button>
            </div>
          </div>
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-50 p-3 rounded-md">
                  <p className="text-xs font-medium text-slate-500 mb-1">风险评估</p>
                  <div className="text-sm text-slate-700">
                    {dep.riskScore !== undefined && (
                      <span className="font-mono font-bold mr-2">风险分: {dep.riskScore}</span>
                    )}
                    {dep.riskFactors && dep.riskFactors.length > 0 && (
                      <div className="mt-1 text-xs text-slate-600">
                        风险因子: {dep.riskFactors.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-md">
                  <p className="text-xs font-medium text-slate-500 mb-1">依赖信息</p>
                  <div className="text-sm text-slate-700">
                    <p>解析来源: {dep.sourceFile}</p>
                    <p>导入方式: {dep.importMethod || '直接导入'}</p>
                  </div>
                </div>
              </div>
              {renderStatusHistory(dep)}
            </div>
          )}
        </div>
        {isExpanded &&
          transitiveChildren.map((child) => (
            <div key={child.id} className="mt-2">
              {renderDependencyRow(child, true)}
            </div>
          ))}
      </React.Fragment>
    );
  };

  const getStats = () => ({
    total: pendingDeps.length,
    critical: pendingDeps.filter((d) => d.riskLevel === 'critical').length,
    warning: pendingDeps.filter((d) => d.riskLevel === 'warning').length,
    safe: pendingDeps.filter((d) => d.riskLevel === 'safe').length,
    approved: approvedDeps.length,
    waiver: waiverDeps.length,
  });

  const stats = getStats();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-slate-900">
            许可证审查
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            对解析后的依赖进行合规审查，明确显示拦截原因
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProjectSelector />
        </div>
      </div>

      {currentProject ? (
        <>
          <div className="grid grid-cols-6 gap-4">
            <div className="card p-4 bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">待审查</p>
              <p className="text-2xl font-bold font-mono text-slate-900">{stats.total}</p>
            </div>
            <div className="card p-4 bg-red-50 border-risk-critical">
              <p className="text-xs text-risk-critical mb-1">高风险</p>
              <p className="text-2xl font-bold font-mono text-risk-critical">{stats.critical}</p>
            </div>
            <div className="card p-4 bg-amber-50 border-risk-warning">
              <p className="text-xs text-risk-warning mb-1">中风险</p>
              <p className="text-2xl font-bold font-mono text-risk-warning">{stats.warning}</p>
            </div>
            <div className="card p-4 bg-emerald-50 border-risk-safe">
              <p className="text-xs text-risk-safe mb-1">低风险</p>
              <p className="text-2xl font-bold font-mono text-risk-safe">{stats.safe}</p>
            </div>
            <div className="card p-4 bg-blue-50">
              <p className="text-xs text-blue-600 mb-1">已通过</p>
              <p className="text-2xl font-bold font-mono text-blue-600">{stats.approved}</p>
            </div>
            <div className="card p-4 bg-purple-50">
              <p className="text-xs text-purple-600 mb-1">豁免中</p>
              <p className="text-2xl font-bold font-mono text-purple-600">{stats.waiver}</p>
            </div>
          </div>

          <div className="card">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  待审查依赖
                </h3>
                <select
                  className="input py-1.5 text-sm"
                  value={filterRisk}
                  onChange={(e) => setFilterRisk(e.target.value)}
                >
                  <option value="all">全部风险等级</option>
                  <option value="critical">高风险</option>
                  <option value="warning">中风险</option>
                  <option value="safe">低风险</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Clock className="w-4 h-4" />
                共 {filteredDeps.length} 项待审查
              </div>
            </div>
            <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto scrollbar-thin">
              {filteredDeps.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-2" />
                  <p>暂无待审查依赖</p>
                </div>
              ) : (
                filteredDeps.map((dep) => renderDependencyRow(dep))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card p-12 text-center">
          <ShieldCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-serif text-xl font-semibold text-slate-700 mb-2">
            请先选择项目
          </h3>
          <p className="text-slate-500">
            选择项目后可查看待审查的依赖列表
          </p>
        </div>
      )}

      {selectedDep && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[550px] shadow-xl animate-slide-up">
            <h3 className="font-serif text-lg font-bold text-slate-900 mb-4">
              审查依赖
            </h3>
            <div className="mb-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono font-semibold">
                  {selectedDep.packageName}
                </span>
                <span className="font-mono text-sm text-slate-500">
                  @{selectedDep.packageVersion}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <RiskBadge level={selectedDep.riskLevel} />
                <StatusBadge status={selectedDep.status} />
              </div>
              {renderBlockReasons(selectedDep)}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  审查结论
                </label>
                <div className="space-y-2">
                  {getAvailableTransitions(selectedDep.status).map((s) => (
                    <label
                      key={s}
                      className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                        newStatus === s
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={newStatus === s}
                        onChange={(e) => setNewStatus(e.target.value as DependencyStatus)}
                        className="w-4 h-4 text-primary-600"
                      />
                      <div className="flex items-center gap-2">
                        {s === 'approved' && <CheckCircle2 className="w-4 h-4 text-risk-safe" />}
                        {s === 'blocked' && <XCircle className="w-4 h-4 text-risk-critical" />}
                        {s === 'waiver_pending' && <FileText className="w-4 h-4 text-orange-500" />}
                        {s === 'pending_review' && <Clock className="w-4 h-4 text-slate-500" />}
                        <span className="font-medium">
                          {DEPENDENCY_STATUS_LABELS[s]}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  审查意见
                </label>
                <textarea
                  className="textarea h-24"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="请输入审查意见，说明决策理由..."
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  className="btn-secondary"
                  onClick={() => setSelectedDep(null)}
                >
                  取消
                </button>
                <button
                  className="btn-primary"
                  onClick={handleStatusUpdate}
                  disabled={!newStatus}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

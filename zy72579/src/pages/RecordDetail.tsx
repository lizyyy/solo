import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  FileText,
  BarChart3,
  BookOpen,
  GitBranch,
  History,
  Play,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  Users,
  MessageSquare,
  Scale,
  AlertCircle,
  CheckCircle,
  Clock,
  Ban,
} from 'lucide-react';
import { StepFlow } from '@/components/StepFlow';
import { LogChart } from '@/components/LogChart';
import { VersionTable } from '@/components/VersionTable';
import { ConflictPanel } from '@/components/ConflictPanel';
import { EvidenceBlock } from '@/components/EvidenceBlock';
import { StatusBadge, TypeBadge } from '@/components/StatusBadge';
import { useRecordStore, buildReconcileResult } from '@/store/recordStore';
import type { ReconcileItem } from '@/types';

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getRecordById,
    resolveConflict,
    advanceStep,
    finishUpdateVersion,
    reviewDuplicateTraining,
    resetRecords,
    exportReport,
  } = useRecordStore();

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [reviewRemark, setReviewRemark] = useState('');
  const [finalCaliber, setFinalCaliber] = useState('');
  const [showToast, setShowToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null
  );

  const record = getRecordById(id || '');
  const reconcile = useMemo(
    () => (record ? buildReconcileResult(record) : undefined),
    [record]
  );

  const triggerToast = (type: 'success' | 'error', msg: string) => {
    setShowToast({ type, msg });
    setTimeout(() => setShowToast(null), 3200);
  };

  if (!record) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">未找到该记录</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 border-2 border-teal-700 hover:bg-teal-700 transition-colors"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const hasUnresolvedConflicts = record.conflicts.some((c) => c.resolution === null);
  const blockedStep = record.steps.find((s) => s.status === 'blocked');
  const isBlocked = !!blockedStep;
  const isDuplicatePending =
    record.type === 'duplicate_training' && record.status === 'pending_review';

  const currentStepIdx = ['import_log', 'review_notes', 'update_version'].indexOf(
    record.currentStep
  );
  const isAtUpdateVersion = record.currentStep === 'update_version';
  const updateVersionStep = record.steps.find((s) => s.key === 'update_version');
  const isUpdateVersionCompleted = updateVersionStep?.status === 'completed';

  const canAdvance =
    !isBlocked &&
    !hasUnresolvedConflicts &&
    !isAtUpdateVersion &&
    !isUpdateVersionCompleted &&
    !isDuplicatePending;

  const canFinishUpdate =
    isAtUpdateVersion && !isUpdateVersionCompleted && !isBlocked && !hasUnresolvedConflicts;

  const handleResolveConflict = (
    conflictId: string,
    resolution: 'confirmed' | 'rejected'
  ) => {
    resolveConflict(record.id, conflictId, resolution);
    triggerToast(
      'success',
      resolution === 'confirmed'
        ? '✓ 冲突已确认通过：第二步（补看调参笔记）完成，请点击「推进到下一步」'
        : '✗ 冲突已驳回：保持阻断，请重新补录调参笔记'
    );
  };

  const handleAdvanceStep = () => {
    advanceStep(record.id);
    triggerToast('success', '✓ 步骤已推进，查看对账面板确认同步情况');
  };

  const handleReviewDuplicate = (decision: 'proceed' | 'mark_abnormal') => {
    reviewDuplicateTraining(record.id, decision, reviewRemark);
    setShowReviewModal(false);
    setReviewRemark('');
    triggerToast(
      'success',
      decision === 'proceed'
        ? '✓ 策略产品复核通过：已解除阻断，第一步置完成，请继续推进'
        : '已标记为异常：流程保持阻断状态'
    );
  };

  const handleFinishUpdate = () => {
    finishUpdateVersion(record.id, finalCaliber || undefined);
    setShowFinishModal(false);
    setFinalCaliber('');
    triggerToast(
      'success',
      '✓ 特征版本表已更新：新版本已发布，对账面板可查看历史+版本同步结果'
    );
  };

  const handleExportReport = () => {
    const report = exportReport(record.id);
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `一致性检查报告_${record.id}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast('success', '✓ 报告已导出下载');
  };

  const handleReset = () => {
    if (confirm('确定重置所有记录到初始状态？')) {
      resetRecords();
      triggerToast('success', '✓ 数据已重置到初始状态');
    }
  };

  const getReconcileBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return {
          cls: 'bg-emerald-600 text-white border-emerald-700',
          icon: <CheckCircle className="w-4 h-4" />,
          text: '对账通过',
        };
      case 'warn':
        return {
          cls: 'bg-amber-500 text-white border-amber-600',
          icon: <AlertCircle className="w-4 h-4" />,
          text: '对账提示',
        };
      case 'blocked':
        return {
          cls: 'bg-red-600 text-white border-red-700',
          icon: <Ban className="w-4 h-4" />,
          text: '对账阻断',
        };
      default:
        return {
          cls: 'bg-teal-600 text-white border-teal-700',
          icon: <Clock className="w-4 h-4" />,
          text: '对账进行中',
        };
    }
  };

  const ItemRow = ({ item }: { item: ReconcileItem }) => {
    const pass = item.match;
    return (
      <div
        className={`border-l-4 px-4 py-3 ${
          pass ? 'border-emerald-500 bg-emerald-50/60' : 'border-red-500 bg-red-50/60'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {pass ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <span className="font-medium text-slate-900 text-sm">{item.label}</span>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2 text-xs">
              <div className="p-2 bg-white/70 border border-slate-200">
                <span className="text-slate-500">左侧：</span>
                <code className="text-slate-800 font-mono">{item.left}</code>
              </div>
              <div className="p-2 bg-white/70 border border-slate-200">
                <span className="text-slate-500">右侧：</span>
                <code className="text-slate-800 font-mono">{item.right}</code>
              </div>
            </div>
            {item.detail && (
              <p className="mt-2 text-xs text-slate-600">
                <MessageSquare className="w-3.5 h-3.5 inline mr-1 -mt-0.5 text-slate-400" />
                {item.detail}
              </p>
            )}
          </div>
          <span
            className={`text-[11px] font-semibold px-2 py-1 border-2 ${
              pass
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-red-100 text-red-800 border-red-300'
            } flex-shrink-0`}
          >
            {pass ? '匹配 ✓' : '待处理 ✗'}
          </span>
        </div>
      </div>
    );
  };

  const badge = reconcile ? getReconcileBadge(reconcile.status) : null;

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {showToast && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`px-4 py-3 text-sm font-medium border-2 shadow-lg ${
              showToast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-red-50 border-red-300 text-red-800'
            }`}
          >
            {showToast.msg}
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-100 transition-colors"
              title="返回列表"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-slate-900 font-serif truncate">
                {record.title}
              </h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <StatusBadge status={record.status} />
                <TypeBadge type={record.type} />
                <span className="text-xs text-slate-500 font-mono">
                  批次: {record.batchId}
                </span>
                <span className="text-xs text-slate-500">
                  第 {currentStepIdx + 1} / 3 步 · 当前：
                  {record.steps.find((s) => s.key === record.currentStep)?.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isDuplicatePending && (
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 border-2 border-amber-700 hover:bg-amber-700 transition-colors flex items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  策略产品复核
                </button>
              )}

              {canAdvance && (
                <button
                  onClick={handleAdvanceStep}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 border-2 border-teal-700 hover:bg-teal-700 transition-colors flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  推进到下一步
                </button>
              )}

              {canFinishUpdate && (
                <button
                  onClick={() => {
                    if (record.type === 'old_caliber') {
                      setFinalCaliber(
                        '混合口径：补录旧口径笔记后，人工确认以线上新口径（首访30天活跃）为准'
                      );
                    } else if (record.type === 'duplicate_training') {
                      setFinalCaliber(
                        (record.featureVersions[0]?.caliber || '') +
                          '（重复训练复核通过，版本递增保留）'
                      );
                    } else {
                      setFinalCaliber(record.featureVersions[0]?.caliber || '');
                    }
                    setShowFinishModal(true);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 border-2 border-emerald-700 hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  完成并发布新版本
                </button>
              )}

              <button
                onClick={handleExportReport}
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border-2 border-slate-300 hover:border-teal-400 hover:text-teal-700 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                导出报告
              </button>

              <button
                onClick={handleReset}
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border-2 border-slate-300 hover:border-red-400 hover:text-red-700 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                重置
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {record.type === 'duplicate_training' && record.status === 'pending_review' && (
          <div className="border-2 border-amber-300 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 font-serif text-base">
                  ⚠ 同一批数据重复训练两次 — 当前停在第一步，等待策略产品复核
                </p>
                <div className="mt-2 text-sm text-amber-800 space-y-1">
                  <p>
                    · 批次 <code>{record.batchId}</code>：
                    <span className="font-medium">15:30 首次训练</span> 已对应特征版本表{' '}
                    <code>{record.featureVersions[0]?.version}</code>
                  </p>
                  <p>
                    · <span className="font-medium">16:45 再次导入</span>
                    ：系统检测到重复 → 不会自动归为正常 → 需要策略产品人工判断
                  </p>
                  <p>
                    · 判断有效 → 解除阻断推进流程；判断无效 → 标记异常不入库
                  </p>
                </div>
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="mt-3 px-3 py-1.5 text-sm font-medium bg-amber-600 text-white border-2 border-amber-700 hover:bg-amber-700 transition-colors"
                >
                  进入策略产品复核 →
                </button>
              </div>
            </div>
          </div>
        )}

        {reconcile && (
          <div
            className={`border-2 ${
              reconcile.status === 'blocked'
                ? 'border-red-300'
                : reconcile.status === 'ok'
                ? 'border-emerald-300'
                : reconcile.status === 'warn'
                ? 'border-amber-300'
                : 'border-teal-300'
            } bg-white`}
          >
            <div
              className={`px-5 py-3 flex items-center gap-3 ${
                reconcile.status === 'blocked'
                  ? 'bg-red-600'
                  : reconcile.status === 'ok'
                  ? 'bg-emerald-600'
                  : reconcile.status === 'warn'
                  ? 'bg-amber-500'
                  : 'bg-teal-600'
              } text-white`}
            >
              <Scale className="w-5 h-5 flex-shrink-0" />
              <h3 className="font-semibold font-serif text-base">
                对账面板：特征版本表 ↔ 审核历史 ↔ 流程状态 三方同步检查
              </h3>
              {badge && (
                <span
                  className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border-2 rounded-sm ${badge.cls}`}
                >
                  {badge.icon}
                  {badge.text}
                </span>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 border-l-4 border-slate-400">
                <p className="text-sm text-slate-800 font-medium">
                  对账总结：{reconcile.summary}
                </p>
                {reconcile.nextAction && (
                  <p className="mt-1 text-xs text-teal-700">
                    ▶ 下一步操作建议：{reconcile.nextAction}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {reconcile.items.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </div>

              <div className="pt-2 text-xs text-slate-500 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                对账面板随状态/操作实时刷新，作为策略产品追问时的证据来源，不自动替业务拍板。
              </div>
            </div>
          </div>
        )}

        <StepFlow steps={record.steps} />

        {record.conflicts.length > 0 && (
          <ConflictPanel conflicts={record.conflicts} onResolve={handleResolveConflict} />
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <EvidenceBlock
            title="训练日志曲线（第一步：导入后留存）"
            icon={<BarChart3 className="w-4 h-4 text-teal-600" />}
          >
            <LogChart trainingLog={record.trainingLog} />
            {record.steps.find((s) => s.key === 'import_log')?.status === 'completed' && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                第一步结果：训练日志已导入，批次
                <code>{record.trainingLog.batchId}</code>
                ，对账面板第 1/3/4 项可查日志口径
              </div>
            )}
          </EvidenceBlock>

          <EvidenceBlock
            title="阈值调参笔记（第二步：补看/修正）"
            icon={<BookOpen className="w-4 h-4 text-amber-600" />}
            variant={record.thresholdNote.isOldCaliber ? 'warning' : 'default'}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-500">笔记版本:</span>
                <code className="bg-slate-100 px-2 py-1 text-xs font-mono">
                  {record.thresholdNote.version}
                </code>
                {record.thresholdNote.isOldCaliber && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                    旧口径（错口径样例）
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <span className="text-xs text-slate-500">操作人：</span>
                  {record.thresholdNote.operator}
                </div>
                <div>
                  <span className="text-xs text-slate-500">更新时间：</span>
                  {record.thresholdNote.updateTime}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">笔记全文（可看到新旧口径标注）:</p>
                <p className="whitespace-pre-wrap bg-slate-50 p-3 border border-slate-200 font-mono text-xs leading-relaxed text-slate-700">
                  {record.thresholdNote.content}
                </p>
              </div>
            </div>
            {record.steps.find((s) => s.key === 'review_notes')?.status === 'completed' && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                第二步结果：阈值调参笔记已补看并通过人工校验，历史已同步
              </div>
            )}
            {hasUnresolvedConflicts && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  存在未处理的口径冲突 → 请在上方冲突面板选择「确认」或「驳回」，
                  <span className="font-semibold">
                    处理完成后会出现「推进到下一步」按钮，不会自动跳步
                  </span>
                </div>
              </div>
            )}
          </EvidenceBlock>
        </div>

        <EvidenceBlock
          title="特征版本表（第三步：更新写入结果，可核对新旧版本）"
          icon={<GitBranch className="w-4 h-4 text-slate-600" />}
        >
          <VersionTable versions={record.featureVersions} />
          {isUpdateVersionCompleted && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                第三步结果：新版本
                <code>{record.featureVersions[0]?.version}</code>
                已发布，对账面板「审核历史≥版本记录」项为匹配；顶部状态变「已完成」。
              </div>
            </div>
          )}
          {canFinishUpdate && (
            <div className="mt-4 p-3 bg-teal-50 border border-teal-200 text-xs text-teal-800">
              <p className="font-medium mb-1">第三步待完成：请确认口径后发布新版本</p>
              <p>点击右上角「完成并发布新版本」，自动递增版本号并写入特征版本表首行。</p>
            </div>
          )}
        </EvidenceBlock>

        <EvidenceBlock
          title="审核历史（改前改后全链路：操作人 + 动作 + 对账同步说明 + 时间）"
          icon={<History className="w-4 h-4 text-slate-600" />}
        >
          <div className="mb-3 p-3 bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
            <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              共 <b>{record.reviewHistory.length}</b> 条，倒序展示（最新置顶）。
              每步的 <code>对账同步</code> 字段说明该操作改写了状态、版本表、历史中哪几项，
              可与上方「对账面板」逐条对照。
            </div>
          </div>
          <div className="space-y-1">
            {record.reviewHistory
              .slice()
              .reverse()
              .map((item, displayIdx) => {
                const realIdx = record.reviewHistory.length - 1 - displayIdx;
                return (
                  <div key={realIdx} className="flex gap-4 py-3 border-b border-slate-100 last:border-0">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full border-2 ${
                          displayIdx === 0
                            ? 'bg-teal-600 border-teal-700'
                            : 'bg-white border-slate-300'
                        }`}
                      />
                      {displayIdx < record.reviewHistory.length - 1 && (
                        <div className="w-0.5 flex-1 bg-slate-200 mt-1" />
                      )}
                    </div>
                    <div className="pb-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">
                          [{record.reviewHistory.length - displayIdx}] {item.action}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200">
                          {item.operator}
                        </span>
                        {displayIdx === 0 && (
                          <span className="text-[11px] px-2 py-0.5 bg-teal-100 text-teal-700 border border-teal-200">
                            最新
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{item.time}</p>
                      {item.remark && (
                        <div className="mt-2 p-2.5 bg-slate-50 border-l-4 border-teal-400 text-xs text-slate-700 leading-relaxed">
                          {item.remark}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </EvidenceBlock>

        <EvidenceBlock
          title="基本信息与计算明细"
          icon={<FileText className="w-4 h-4 text-slate-600" />}
          defaultOpen={false}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">记录ID</p>
              <p className="text-sm font-mono text-slate-700 mt-1">{record.id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">特征名称</p>
              <p className="text-sm font-mono text-slate-700 mt-1">{record.featureName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">创建时间</p>
              <p className="text-sm text-slate-700 mt-1">{record.createTime}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">最后更新时间</p>
              <p className="text-sm text-slate-700 mt-1">{record.updateTime}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">当前流程步骤</p>
              <p className="text-sm text-slate-700 mt-1">
                第 {currentStepIdx + 1} / 3 步 —{' '}
                {record.steps.find((s) => s.key === record.currentStep)?.label}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">冲突统计</p>
              <p className="text-sm text-slate-700 mt-1">
                {record.conflicts.length} 项 （
                <span className="text-emerald-700">
                  已处理 {record.conflicts.filter((c) => c.resolution).length}
                </span>{' '}
                /{' '}
                <span className="text-red-700">
                  待处理 {record.conflicts.filter((c) => !c.resolution).length}
                </span>
                ）
              </p>
            </div>
          </div>
        </EvidenceBlock>
      </main>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-amber-400 w-full max-w-xl shadow-2xl">
            <div className="bg-amber-600 text-white px-5 py-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              <h3 className="font-semibold font-serif">策略产品复核 — 同一批数据重复训练判定</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 text-sm space-y-2">
                <p className="font-medium text-amber-900">待判定事项</p>
                <div className="text-amber-800 space-y-1">
                  <p>
                    · 批次 <code>{record.batchId}</code> 第一次训练 @15:30 → 已生成版本{' '}
                    <code>{record.featureVersions[0]?.version}</code>
                  </p>
                  <p>
                    · 批次 <code>{record.batchId}</code> 第二次训练 @16:45 → 系统判定为重复
                  </p>
                  <p>
                    · <b>选择「通过」</b>：解除阻断、第一步置完成、可继续推进到第二步，最终发布新版本时版本号递增
                  </p>
                  <p>
                    · <b>选择「驳回」</b>：保持阻断、流程终止，本次第二次训练不写入版本表，历史保留操作记录
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  复核意见（必填，留痕用）
                </label>
                <textarea
                  value={reviewRemark}
                  onChange={(e) => setReviewRemark(e.target.value)}
                  rows={3}
                  placeholder="例如：第二次训练为重跑修正归一化问题，结果有效；或 第二次训练为误操作，不计入版本..."
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 focus:border-teal-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setReviewRemark('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border-2 border-slate-300 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  onClick={() => handleReviewDuplicate('mark_abnormal')}
                  disabled={!reviewRemark.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border-2 border-red-700 hover:bg-red-700 disabled:opacity-40 flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  驳回 · 标记异常
                </button>
                <button
                  onClick={() => handleReviewDuplicate('proceed')}
                  disabled={!reviewRemark.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 border-2 border-emerald-700 hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  通过 · 允许推进
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFinishModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-emerald-400 w-full max-w-xl shadow-2xl">
            <div className="bg-emerald-600 text-white px-5 py-3 flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              <h3 className="font-semibold font-serif">
                完成第三步 — 更新特征版本表 & 发布新版本
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 text-sm space-y-2">
                <p className="font-medium text-slate-800">版本变更预览</p>
                <div className="text-slate-600 space-y-1 font-mono text-xs">
                  <p>
                    · 当前最新版本：
                    <code className="bg-white px-1.5 py-0.5 border">
                      {record.featureVersions[0]?.version || 'N/A'}
                    </code>
                  </p>
                  <p>
                    · 即将发布版本：
                    <code className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 border border-emerald-200">
                      {(function () {
                        const v = record.featureVersions[0]?.version || 'v1.0.0';
                        const m = v.match(/v(\d+)\.(\d+)\.(\d+)/);
                        if (m) return `v${m[1]}.${m[2]}.${parseInt(m[3], 10) + 1}`;
                        const lm = v.match(/v(\d+)/);
                        return lm ? `v${parseInt(lm[1], 10) + 1}.0.0` : 'v1.0.0';
                      })()}
                    </code>
                  </p>
                  <p>· 操作人：小乔</p>
                  <p>
                    · 写入后：特征版本表首行插入新记录，审核历史新增「第三步完成」条目，顶部状态变「已完成」
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  最终特征口径（可修改，将写入新版本备注与特征版本表 caliber 字段）
                </label>
                <textarea
                  value={finalCaliber}
                  onChange={(e) => setFinalCaliber(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 focus:border-teal-500 focus:outline-none resize-none font-mono"
                />
                <p className="text-xs text-slate-500 mt-1">
                  建议保留新旧口径来源说明，便于后续策略产品追问时快速举证
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowFinishModal(false);
                    setFinalCaliber('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border-2 border-slate-300 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  onClick={handleFinishUpdate}
                  disabled={!finalCaliber.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 border-2 border-emerald-700 hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  确认发布新版本
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

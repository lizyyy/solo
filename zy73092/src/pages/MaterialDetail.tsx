import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  Pause,
  CheckCircle2,
  XCircle,
  FileWarning,
  ChevronDown,
  Check,
  Calendar,
  User as UserIcon,
  Clock,
  Sparkles,
  ShieldAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { useTrackerStore } from '@/store/useTrackerStore';
import { fetcher } from '@/utils/fetcher';
import type {
  Material,
  Batch,
  Opinion,
  Specialty,
  JudgeResult,
  MaterialStatus,
  OpinionSource,
  SuspendConfirm,
} from '@/shared/types';

const specialtyLabels: Record<Specialty, string> = {
  HVAC: '暖通',
  ELECTRICAL: '电气',
  PLUMBING: '给排水',
  FIRE: '消防',
};

const judgeOptions: Array<{ value: JudgeResult; label: string; color: string }> = [
  { value: 'PASS', label: '通过', color: 'text-emerald-600' },
  { value: 'FAIL', label: '不通过', color: 'text-rose-600' },
  { value: 'CONDITIONAL_PASS', label: '条件通过', color: 'text-sky-600' },
  { value: 'NEED_REVIEW', label: '需复核', color: 'text-purple-600' },
];

const timelineColorMap: Record<OpinionSource, { bg: string; ring: string; pattern?: boolean }> = {
  HANDOVER_LIST: { bg: 'bg-blue-500', ring: 'ring-blue-200' },
  SUBMISSION_FORM: { bg: 'bg-cyan-500', ring: 'ring-cyan-200' },
  OLD_PROCESS: { bg: 'bg-slate-400', ring: 'ring-slate-200', pattern: true },
  SUPPLEMENT_NOTE: { bg: 'bg-amber-500', ring: 'ring-amber-200' },
  LATEST_EXPORT: { bg: 'bg-violet-500', ring: 'ring-violet-200' },
};

export default function MaterialDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentRole = useTrackerStore((s) => s.currentRole);
  const suspendModal = useTrackerStore((s) => s.suspendModal);
  const openSuspendModal = useTrackerStore((s) => s.openSuspendModal);
  const closeSuspendModal = useTrackerStore((s) => s.closeSuspendModal);
  const setSuspendReason = useTrackerStore((s) => s.setSuspendReason);

  const [material, setMaterial] = useState<Material | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [opinions, setOpinions] = useState<Opinion[]>([]);
  const [loading, setLoading] = useState(true);

  const [judgeResult, setJudgeResult] = useState<JudgeResult>('PASS');
  const [supplementNote, setSupplementNote] = useState('');
  const [isLatestExport, setIsLatestExport] = useState(false);
  const [judgeDropdownOpen, setJudgeDropdownOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [suspendConfirmId, setSuspendConfirmId] = useState<number | null>(null);
  const [suspendPMDecision, setSuspendPMDecision] = useState<'CONFIRM_MISSING' | 'SUPPLEMENT_BATCH' | 'REJECT'>('CONFIRM_MISSING');
  const [suspendPMOpinion, setSuspendPMOpinion] = useState('');

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    const res = await fetcher.get<Material & { batches: Batch[]; opinions: Opinion[] }>(`/api/materials/${id}`);
    if (res.success && res.data) {
      setMaterial(res.data);
      setBatches(res.data.batches || []);
      setOpinions(res.data.opinions || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  const isJudgeDisabled = !material ||
    material.status === 'SUSPENDED' ||
    material.status === 'MISSING' ||
    material.status === 'AWAITING_PM';

  const handleSubmitJudge = async () => {
    if (!id || !material || isJudgeDisabled) return;
    setSubmitLoading(true);
    const body: Record<string, unknown> = {
      judgeResult,
      isLatestExport,
      operator: '老叶',
    };
    if (supplementNote.trim()) {
      body.supplementNote = supplementNote.trim();
    }
    const res = await fetcher.patch(`/api/materials/${id}/judge`, body);
    if (!res.success) {
      alert(res.error || '改判失败');
    } else {
      setSupplementNote('');
      await loadDetail();
    }
    setSubmitLoading(false);
  };

  const handleCreateSuspend = async () => {
    if (!id) return;
    const res = await fetcher.post<SuspendConfirm>('/api/suspends', {
      materialId: Number(id),
      reason: '材料批次待确认',
      createdBy: '老叶',
    });
    if (res.success && res.data) {
      setSuspendConfirmId(res.data.id);
      openSuspendModal(Number(id));
      setSuspendReason('材料批次待确认');
    } else {
      alert(res.error || '发起挂起失败');
    }
  };

  const handleConfirmSuspend = async () => {
    if (!suspendConfirmId) return;
    const res = await fetcher.patch<SuspendConfirm>(`/api/suspends/${suspendConfirmId}/confirm`, {
      pmDecision: suspendPMDecision,
      pmOpinion: suspendPMOpinion,
      pmSignature: '李经理',
    });
    if (res.success) {
      closeSuspendModal();
      setSuspendConfirmId(null);
      setSuspendPMOpinion('');
      await loadDetail();
    } else {
      alert(res.error || '确认失败');
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
          加载中...
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">返回列表</span>
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
          未找到材料信息
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">返回列表</span>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <code className="font-mono text-sm bg-slate-100 text-slate-800 px-2.5 py-1 rounded font-semibold">
                {material.code}
              </code>
              <h1 className="text-xl font-bold text-slate-900">{material.name}</h1>
              <StatusBadge status={material.status} />
              {material.judgeResult && <StatusBadge judgeResult={material.judgeResult} />}
            </div>
            <p className="text-sm text-slate-500 mt-1 ml-1">{material.spec}</p>
          </div>
        </div>
      </div>

      {material.hasMissingBatch && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-rose-900">批次缺失警告</div>
            <div className="text-sm text-rose-700 mt-1">
              该材料存在 {batches.filter((b) => b.status === 'MISSING').length} 个缺失批次，无法进行判定。请项目经理确认后再操作。
            </div>
          </div>
          {currentRole === 'PM' && (
            <button
              onClick={handleCreateSuspend}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors shadow-sm"
            >
              <Pause className="w-4 h-4" />
              发起挂起确认
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <FileWarning className="w-4 h-4 text-slate-500" />
          基本信息
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
          {[
            { label: '材料编号', value: material.code, mono: true },
            { label: '材料名称', value: material.name },
            { label: '规格型号', value: material.spec },
            { label: '所属专业', value: specialtyLabels[material.specialty] },
            { label: '送审编号', value: material.submissionNo },
            { label: '来源送审表', value: material.sourceForm },
            { label: '导入时间', value: material.importTime },
            { label: '最后更新', value: new Date(material.updatedAt).toLocaleString('zh-CN') },
          ].map((item, i) => (
            <div key={i} className="flex items-start border-b border-slate-100 pb-3 last:border-0">
              <div className="w-28 flex-shrink-0 text-xs text-slate-500 pt-0.5">{item.label}</div>
              <div
                className={cn(
                  'text-sm text-slate-800 flex-1',
                  item.mono && 'font-mono text-xs bg-slate-50 px-2 py-1 rounded'
                )}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            批次清单
            <span className="ml-2 text-xs font-normal text-slate-500">
              共 {batches.length} 个批次
            </span>
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              完整 {batches.filter((b) => b.status === 'COMPLETE').length}
            </span>
            <span className="flex items-center gap-1 text-rose-600">
              <XCircle className="w-3.5 h-3.5" />
              缺失 {batches.filter((b) => b.status === 'MISSING').length}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="text-left font-semibold px-6 py-3 text-xs">批次编号</th>
                <th className="text-left font-semibold px-6 py-3 text-xs">到货日期</th>
                <th className="text-center font-semibold px-6 py-3 text-xs">检测报告</th>
                <th className="text-center font-semibold px-6 py-3 text-xs">质量合格证</th>
                <th className="text-left font-semibold px-6 py-3 text-xs">状态</th>
                <th className="text-left font-semibold px-6 py-3 text-xs">缺失原因</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-xs">
                    暂无批次信息
                  </td>
                </tr>
              ) : (
                batches.map((b, idx) => (
                  <tr
                    key={b.id}
                    className={cn(
                      'border-b border-slate-100 last:border-0',
                      idx % 2 === 1 && 'bg-slate-50/30',
                      b.status === 'MISSING' && 'bg-rose-50/60'
                    )}
                  >
                    <td className="px-6 py-3.5">
                      <code className="font-mono text-xs text-slate-800 bg-slate-100 px-2 py-1 rounded font-medium">
                        {b.batchNo}
                      </code>
                    </td>
                    <td className="px-6 py-3.5 text-slate-700">
                      {b.arrivalDate || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {b.inspectReport ? (
                        <span className="inline-flex w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="inline-flex w-6 h-6 rounded-full bg-slate-100 text-slate-400 items-center justify-center">
                          <XCircle className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {b.qualityCert ? (
                        <span className="inline-flex w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="inline-flex w-6 h-6 rounded-full bg-slate-100 text-slate-400 items-center justify-center">
                          <XCircle className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {b.status === 'COMPLETE' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                          <CheckCircle2 className="w-3 h-3" /> 完整
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded">
                          <XCircle className="w-3 h-3" /> 缺失
                        </span>
                      )}
                    </td>
                    <td className={cn('px-6 py-3.5 text-xs', b.status === 'MISSING' && 'bg-amber-100/60')}>
                      {b.missingReason || <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          意见流水
          <span className="ml-2 text-xs font-normal text-slate-500">
            共 {opinions.length} 条记录
          </span>
        </h2>

        {opinions.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">暂无意见记录</div>
        ) : (
          <div className="relative pl-2">
            <div className="absolute left-5 top-1 bottom-1 w-0.5 bg-gradient-to-b from-slate-200 via-slate-200 to-slate-100" />

            <div className="space-y-6">
              {opinions.map((op) => {
                const color = timelineColorMap[op.source];
                return (
                  <div
                    key={op.id}
                    className={cn(
                      'relative flex gap-4',
                      op.isOldProcess && 'opacity-70'
                    )}
                  >
                    <div className="relative z-10 mt-1">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center ring-4',
                          color.bg,
                          color.ring,
                          color.pattern && 'diagonal-stripes'
                        )}
                      >
                        <span className="text-white text-[10px] font-bold">
                          {op.source === 'HANDOVER_LIST' && '交'}
                          {op.source === 'SUBMISSION_FORM' && '审'}
                          {op.source === 'OLD_PROCESS' && '旧'}
                          {op.source === 'SUPPLEMENT_NOTE' && '补'}
                          {op.source === 'LATEST_EXPORT' && '导'}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 pb-6">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <StatusBadge source={op.source} />
                        {op.isOldProcess && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600 border border-slate-300 diagonal-stripes-sm">
                            旧处理
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
                          <UserIcon className="w-3 h-3" />
                          <span>{op.operator}</span>
                          <span className="mx-1.5 text-slate-300">·</span>
                          <Calendar className="w-3 h-3" />
                          <span>{formatTime(op.createdAt)}</span>
                        </div>
                      </div>
                      <div className="bg-slate-50/70 rounded-lg p-4 border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {op.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-[220px] right-0 z-30 pointer-events-none">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="px-8 py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-sm font-semibold text-slate-700 whitespace-nowrap flex-shrink-0">
                改判操作
              </div>

              <div className="relative min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setJudgeDropdownOpen(!judgeDropdownOpen)}
                  disabled={isJudgeDisabled || submitLoading}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3.5 py-2 text-sm rounded-lg border bg-white transition-colors',
                    isJudgeDisabled || submitLoading
                      ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <span className={cn(!isJudgeDisabled && judgeOptions.find((o) => o.value === judgeResult)?.color)}>
                    {judgeOptions.find((o) => o.value === judgeResult)?.label}
                  </span>
                  <ChevronDown className={cn('w-4 h-4 text-slate-400', judgeDropdownOpen && 'rotate-180')} />
                </button>
                {judgeDropdownOpen && !isJudgeDisabled && (
                  <div className="absolute bottom-full left-0 mb-1.5 w-full bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-40">
                    {judgeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setJudgeResult(opt.value);
                          setJudgeDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center px-3.5 py-2 text-sm hover:bg-slate-50 text-left',
                          judgeResult === opt.value ? 'bg-blue-50/50' : '',
                          opt.color
                        )}
                      >
                        {opt.label}
                        {judgeResult === opt.value && <Check className="w-4 h-4 ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-[280px]">
                <textarea
                  value={supplementNote}
                  onChange={(e) => setSupplementNote(e.target.value)}
                  disabled={isJudgeDisabled || submitLoading}
                  placeholder="后补备注（可选）..."
                  rows={1}
                  className={cn(
                    'w-full px-3.5 py-2 text-sm rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all',
                    isJudgeDisabled || submitLoading
                      ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed placeholder-slate-300'
                      : 'border-slate-200 bg-white placeholder-slate-400'
                  )}
                />
              </div>

              <label
                className={cn(
                  'flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap flex-shrink-0',
                  (isJudgeDisabled || submitLoading) && 'opacity-50 cursor-not-allowed'
                )}
              >
                <input
                  type="checkbox"
                  checked={isLatestExport}
                  onChange={(e) => setIsLatestExport(e.target.checked)}
                  disabled={isJudgeDisabled || submitLoading}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span className="text-slate-600">最新导出</span>
              </label>

              {isJudgeDisabled && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg whitespace-nowrap">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  批次缺失，需项目经理确认后才能改判
                </div>
              )}

              <button
                onClick={handleSubmitJudge}
                disabled={isJudgeDisabled || submitLoading}
                className={cn(
                  'px-6 py-2 rounded-lg text-sm font-medium transition-all shadow-sm whitespace-nowrap',
                  isJudgeDisabled || submitLoading
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-blue-600/20'
                )}
              >
                {submitLoading ? '提交中...' : '提交改判'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {suspendModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeSuspendModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">挂起确认处理</h3>
              <button
                onClick={closeSuspendModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">项目经理决策</label>
                <div className="space-y-2">
                  {([
                    { value: 'CONFIRM_MISSING', label: '确认缺料', desc: '状态改为 MISSING，按变更流程补充材料' },
                    { value: 'SUPPLEMENT_BATCH', label: '补充批次', desc: '后续手动补充缺失批次信息' },
                    { value: 'REJECT', label: '驳回', desc: '恢复原状态，驳回挂起请求' },
                  ] as Array<{ value: 'CONFIRM_MISSING' | 'SUPPLEMENT_BATCH' | 'REJECT'; label: string; desc: string }>).map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        suspendPMDecision === opt.value
                          ? 'border-blue-400 bg-blue-50/50'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <input
                        type="radio"
                        checked={suspendPMDecision === opt.value}
                        onChange={() => setSuspendPMDecision(opt.value)}
                        className="mt-1 w-4 h-4 text-blue-600"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{opt.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">项目经理意见</label>
                <textarea
                  value={suspendPMOpinion}
                  onChange={(e) => setSuspendPMOpinion(e.target.value)}
                  rows={3}
                  placeholder="请输入处理意见..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={closeSuspendModal}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmSuspend}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                确认处理
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

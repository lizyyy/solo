import { AlertTriangle, Check, History, RotateCcw, Save, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useSampleStore } from '../store/useSampleStore';
import type { Verdict } from '../types';
import { verdictColorMap } from '../utils/format';
import CalculationSteps from './CalculationSteps';
import CriterionSection from './CriterionSection';
import DraftSection from './DraftSection';
import StatusBadge from './StatusBadge';

export default function DetailDrawer() {
  const open = useSampleStore((s) => s.ui.isDrawerOpen);
  const id = useSampleStore((s) => s.ui.selectedSampleId);
  const sample = useSampleStore((s) => s.samples.find((x) => x.id === id));
  const close = useSampleStore((s) => s.closeDrawer);
  const updateVerdict = useSampleStore((s) => s.updateVerdict);
  const openHistory = useSampleStore((s) => s.openHistory);

  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  if (!sample) return null;

  const vc = sample.finalVerdict ? verdictColorMap[sample.finalVerdict] : null;

  const handleSave = (verdict: Verdict) => {
    updateVerdict(sample.id, verdict, note);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-ink-950/30 backdrop-blur-sm z-40 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[640px] lg:w-[720px] bg-ink-50 border-l border-ink-200 shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-start justify-between gap-4 p-5 border-b border-ink-200 bg-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-xl text-ink-950 truncate">
                {sample.studentName} · {sample.problemTitle}
              </h2>
              {sample.isDuplicate && (
                <span className="chip bg-amber2-50 text-amber2-700 border-amber2-200">
                  <AlertTriangle className="w-3 h-3" /> 重复样本
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-ink-500">
              <span className="font-mono">{sample.studentId}</span>
              <span>·</span>
              <span>{sample.batch}</span>
              <span>·</span>
              <span>提交 {sample.submittedAt}</span>
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <StatusBadge status={sample.status} />
              {sample.finalVerdict && vc ? (
                <span className={`chip ${vc.bg} ${vc.text} ${vc.border}`}>
                  结论：{sample.finalVerdict}
                </span>
              ) : (
                <span className="chip bg-ink-100 text-ink-600 border-ink-200">未出具审核结论</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              title="查看历史变更"
              onClick={() => openHistory()}
              className="btn-ghost !p-2"
            >
              <History className="w-4 h-4" />
            </button>
            <button onClick={close} className="btn-ghost !p-2" aria-label="关闭">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <DraftSection lines={sample.draftLines} />
          <CriterionSection />
          <CalculationSteps steps={sample.calculationSteps} />

          <section className="space-y-3">
            <h3 className="font-display text-lg text-ink-900">审核结论</h3>
            <div className="rounded-lg border border-ink-200 bg-white p-4 space-y-3">
              <label className="block space-y-1">
                <span className="label">审核备注（给学生/复盘时看的说明）</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={
                    sample.status === '空集合'
                      ? '例如：空集合∅是正确输出，学生能正确识别"不可达"情形，理解到位。'
                      : sample.status === '异常'
                      ? '例如：第3行邻接表漏写了 C→D 边，请补全后重新提交。'
                      : '填写审核备注…'
                  }
                  className="input resize-y"
                />
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleSave('需补材料')}
                  className="btn-coral"
                >
                  <XCircle className="w-4 h-4" /> 标记 · 需补材料
                </button>
                <button onClick={() => handleSave('可放行')} className="btn-emerald">
                  <Check className="w-4 h-4" /> 标记 · 可放行
                </button>
                <button
                  onClick={() => {
                    setNote('');
                    updateVerdict(sample.id, null, '');
                  }}
                  className="btn-ghost"
                >
                  <RotateCcw className="w-4 h-4" /> 清除结论
                </button>
                {saved && (
                  <span className="text-xs text-emerald2-700 flex items-center gap-1 animate-fadeUp">
                    <Save className="w-3.5 h-3.5" /> 已保存至历史记录
                  </span>
                )}
              </div>
              {sample.reviewNote && (
                <div className="pt-2 border-t border-ink-100 text-sm text-ink-600">
                  <span className="label">已有备注：</span> {sample.reviewNote}
                </div>
              )}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

import { useMemo, useState } from 'react';
import {
  CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Eye,
  FileSpreadsheet, Home, MapPin, Package, Sparkles, StepForward, Tag,
  TriangleAlert,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { exportCSV, downloadText } from '@/utils/exporter';
import { STATUS_LABELS } from '@/types';
import { formatDate } from '@/utils/date';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 1, title: '确认最新版本', icon: Tag },
  { id: 2, title: '检查异常项', icon: TriangleAlert },
  { id: 3, title: '核对缺料项', icon: Package },
  { id: 4, title: '导出封账报告', icon: FileSpreadsheet },
];

function StepBar({ cur, done }: { cur: number; done: Set<number> }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isDone = done.has(s.id), isCur = cur === s.id, pass = i < STEPS.length - 1;
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn('w-10 h-10 rounded-sm flex items-center justify-center transition-all',
                isDone ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40' :
                isCur ? 'bg-[#3498DB] text-white shadow-md shadow-[#1A5276]/40 scale-110' :
                'bg-steel-700/40 text-steel-400')}>
                {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4.5 h-4.5" />}
              </div>
              <span className={cn('text-xs font-semibold whitespace-nowrap', isCur ? 'text-[#5DADE2]' : isDone ? 'text-emerald-400' : 'text-steel-400')}>{s.title}</span>
            </div>
            {pass && <div className={cn('w-14 h-0.5 mx-2 rounded-none', (isDone || i < Array.from(done).length) ? 'bg-emerald-500' : 'bg-steel-600')} />}
          </div>
        );
      })}
    </div>
  );
}

export default function RunReviewPage() {
  const { drawings, versions, materials } = useAppStore(
    useShallow((s) => ({
      drawings: s.drawings,
      versions: s.versions,
      materials: s.materials,
    })),
  );
  const logExport = useAppStore((s) => s.logExport);
  const state = { currentUser: useAppStore.getState().currentUser, drawings, versions, notes: useAppStore.getState().notes, materials, changeLogs: useAppStore.getState().changeLogs, exportLogs: useAppStore.getState().exportLogs };

  const [step, setStep] = useState(1);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [s1, setS1] = useState<Set<string>>(new Set());
  const [s2, setS2] = useState<Set<string>>(new Set());
  const [s3, setS3] = useState<Set<string>>(new Set());
  const [tip, setTip] = useState(false);

  const abn = useMemo(() => drawings.filter(d => d.status === 'abnormal' || d.status === 'reviewing'), [drawings]);
  const mis = useMemo(() => materials.filter(m => m.isMissing).map(m => ({ ...m, dr: drawings.find(d => d.id === m.drawingId)! })), [materials, drawings]);
  const s1Ok = s1.size === drawings.length;
  const s2Ok = s2.size === abn.length || abn.length === 0;
  const s3Ok = s3.size === mis.length || mis.length === 0;

  const next = () => { const nd = new Set(done); nd.add(step); setDone(nd); if (step < 4) setStep(step + 1); };
  const back = () => { if (step > 1) setStep(step - 1); };
  const doExport = () => {
    const today = formatDate(new Date().toISOString()).replace(/-/g, '');
    const fn = `月度封账报告-${today}.csv`;
    downloadText(exportCSV(state), fn, 'text/csv');
    logExport({ type: 'csv', fileName: fn });
    const nd = new Set(done); nd.add(4); setDone(nd); setTip(true);
  };
  const sc = (st: string) => cn('px-2 py-0.5 rounded-sm text-[10px] font-bold',
    st === 'normal' && 'bg-emerald-900/40 text-emerald-400',
    st === 'abnormal' && 'bg-[#E74C3C]/20 text-[#E74C3C]',
    st === 'reviewing' && 'bg-amber-900/40 text-amber-400',
    st === 'closed' && 'bg-steel-600 text-steel-100');
  const toggle = (setter: (s: Set<string>) => void, cur: Set<string>, id: string) => {
    const ns = new Set(cur); if (ns.has(id)) ns.delete(id); else ns.add(id); setter(ns);
  };

  return (
    <div className="p-6 max-w-[1050px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-sm bg-[#1A5276]/30 border border-[#3498DB] flex items-center justify-center"><ClipboardList className="w-5 h-5 text-[#5DADE2]" /></div>
        <div>
          <h1 className="text-xl font-bold text-steel-100">月底封账自服务向导</h1>
          <p className="text-sm text-steel-300">4步完成月度预审封账 · 确保图纸、异常、缺料三项对齐</p>
        </div>
      </div>

      <StepBar cur={step} done={done} />

      <div className="bg-steel-800 rounded-sm border border-steel-600 shadow-sm p-5 min-h-[450px]">
        {step === 1 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-steel-100 flex items-center gap-2"><Tag className="w-4.5 h-4.5 text-[#5DADE2]" />Step1 · 确认最新版本</h2>
              <span className="text-sm font-bold text-[#5DADE2]">{s1.size}/{drawings.length} ✓</span>
            </div>
            <div className="space-y-2 max-h-[380px] overflow-auto">
              {drawings.map(d => {
                const v = versions.find(x => x.id === d.currentVersionId);
                const mc = materials.filter(m => m.drawingId === d.id && m.isMissing).length;
                const ok = s1.has(d.id);
                return (
                  <div key={d.id} className={cn('flex items-center gap-3 p-3 rounded-sm border-2 transition-all', ok ? 'border-emerald-600 bg-emerald-900/20' : 'border-steel-600 bg-steel-800 hover:border-steel-500')}>
                    <button onClick={() => toggle(setS1, s1, d.id)} className={cn('w-8 h-8 rounded-sm border-2 flex items-center justify-center shrink-0', ok ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-steel-800 border-steel-500 hover:border-emerald-500')}>
                      {ok && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-steel-100 text-sm">{d.name}</span>
                        <span className="text-[10px] font-mono bg-[#1A5276]/30 text-[#5DADE2] px-1.5 py-0.5 rounded-sm">{v?.version}</span>
                        {v?.isLatest && <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-sm font-bold">LATEST</span>}
                      </div>
                      <div className="text-xs text-steel-300">{d.buildingName} · {d.projectNo}</div>
                    </div>
                    {mc > 0 && <span className="text-[10px] bg-[#E74C3C]/20 text-[#E74C3C] px-2 py-1 rounded-sm font-bold shrink-0 flex items-center gap-1"><Package className="w-3 h-3" />缺料 {mc}</span>}
                    <span className={sc(d.status)}>{STATUS_LABELS[d.status]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-steel-100 flex items-center gap-2"><TriangleAlert className="w-4.5 h-4.5 text-amber-500" />Step2 · 检查异常项</h2>
              <span className="text-sm font-bold text-amber-400">{s2.size}/{abn.length} ✓</span>
            </div>
            {abn.length === 0 ? (
              <div className="text-center py-14"><Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-3" /><div className="text-steel-300 text-sm">太棒了！当前无异常图纸</div></div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-auto">
                {abn.map(d => {
                  const v = versions.find(x => x.id === d.currentVersionId);
                  const seen = s2.has(d.id);
                  return (
                    <div key={d.id} className={cn('flex items-center gap-3 p-3 rounded-sm border-2 transition-all', seen ? 'border-emerald-600 bg-emerald-900/20' : d.status === 'abnormal' ? 'border-[#E74C3C]/60 bg-[#E74C3C]/10' : 'border-amber-600/60 bg-amber-900/20')}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-steel-100 text-sm">{d.name}</span>
                          <span className="text-[10px] font-mono bg-steel-700/40 text-steel-300 px-1.5 py-0.5 rounded-sm">{v?.version}</span>
                          <span className={sc(d.status)}>{STATUS_LABELS[d.status]}</span>
                        </div>
                        <div className="text-xs text-steel-300">{d.buildingName}</div>
                      </div>
                      <button className="text-xs bg-steel-800 border border-steel-600 px-2.5 py-1.5 rounded-sm text-steel-300 hover:bg-steel-700/40 flex items-center gap-1 shrink-0"><Eye className="w-3 h-3" />详情</button>
                      <button onClick={() => toggle(setS2, s2, d.id)} className={cn('text-xs px-2.5 py-1.5 rounded-sm font-bold shrink-0', seen ? 'bg-emerald-600 text-white' : 'bg-steel-700/40 text-steel-300 hover:bg-emerald-900/40 hover:text-emerald-400')}>
                        {seen ? '✓ 已看' : '标记已看'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-steel-100 flex items-center gap-2"><Package className="w-4.5 h-4.5 text-[#E74C3C]" />Step3 · 核对缺料项</h2>
              <span className="text-sm font-bold text-[#E74C3C]">{s3.size}/{mis.length} ✓</span>
            </div>
            {mis.length === 0 ? (
              <div className="text-center py-14"><Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-3" /><div className="text-steel-300 text-sm">太棒了！当前无缺料项</div></div>
            ) : (
              <div className="rounded-sm border border-steel-600 overflow-hidden max-h-[380px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-steel-700 sticky top-0 z-10">
                    <tr className="text-[11px] text-steel-300">
                      <th className="text-left px-3 py-2.5 font-medium w-10"></th>
                      <th className="text-left px-3 py-2.5 font-medium">材料批次</th>
                      <th className="text-left px-3 py-2.5 font-medium">所在位置</th>
                      <th className="text-left px-3 py-2.5 font-medium">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mis.map(m => {
                      const ok = s3.has(m.id);
                      return (
                        <tr key={m.id} className={cn('border-t border-steel-600', ok ? 'bg-emerald-900/20' : 'hover:bg-[#E74C3C]/10')}>
                          <td className="px-3 py-2.5">
                            <button onClick={() => toggle(setS3, s3, m.id)} className={cn('w-7 h-7 rounded-sm border-2 flex items-center justify-center', ok ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-steel-800 border-steel-500 hover:border-[#E74C3C]')}>
                              {ok && <CheckCircle2 className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="px-3 py-2.5"><div className="font-semibold text-steel-100 text-sm">{m.batchNo}</div><div className="text-xs text-steel-300">{m.materialName}</div></td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1 bg-[#1A5276]/30 text-[#5DADE2] px-2 py-0.5 rounded-sm text-xs">
                              <MapPin className="w-3 h-3" /><span className="font-semibold">{m.dr.buildingName}</span><span className="text-[#3498DB]">·</span><span className="truncate max-w-[140px]">{m.dr.name}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-steel-300 max-w-[220px]">{m.reviewHint ?? '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          tip ? (
            <div className="text-center py-14">
              <div className="w-20 h-20 rounded-full bg-emerald-900/40 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-10 h-10 text-emerald-400" /></div>
              <h3 className="text-xl font-bold text-emerald-400 mb-2">封账完成，报告已生成！</h3>
              <p className="text-sm text-steel-300 mb-6">月度预审封账流程已完成，CSV报告已下载</p>
              <button className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#3498DB] text-white font-semibold rounded-sm hover:bg-[#2E86C1] shadow-md shadow-[#1A5276]/40">
                <Home className="w-4 h-4" />返回工作台
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-steel-700/40 flex items-center justify-center mx-auto mb-4"><FileSpreadsheet className="w-10 h-10 text-steel-300" /></div>
              <h3 className="text-lg font-bold text-steel-100 mb-2">准备好导出报告了吗？</h3>
              <p className="text-sm text-steel-300 mb-6 max-w-md mx-auto">
                系统将导出包含 {drawings.length} 张图纸的完整预审汇总，<br />涵盖指标状态、备注、材料批次和变更记录。
              </p>
              <button onClick={doExport} className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-[#3498DB] to-[#5DADE2] text-white font-bold rounded-sm hover:from-[#2E86C1] hover:to-[#5DADE2] shadow-lg shadow-[#1A5276]/40 transition-transform hover:scale-105">
                <StepForward className="w-4.5 h-4.5" />一键导出CSV并完成封账
              </button>
            </div>
          )
        )}
      </div>

      <div className="flex items-center justify-between mt-5">
        <button onClick={back} disabled={step === 1 || tip} className={cn('inline-flex items-center gap-1 px-4 py-2 rounded-sm text-sm font-semibold', step === 1 || tip ? 'opacity-30 cursor-not-allowed text-steel-400' : 'bg-steel-700/40 text-steel-100 hover:bg-steel-600')}>
          <ChevronLeft className="w-4 h-4" />上一步
        </button>
        {!tip && step < 4 && (
          <button onClick={next} disabled={(step === 1 && !s1Ok) || (step === 2 && !s2Ok) || (step === 3 && !s3Ok)} className={cn('inline-flex items-center gap-1 px-4 py-2 rounded-sm text-sm font-semibold',
            (step === 1 && s1Ok) || (step === 2 && s2Ok) || (step === 3 && s3Ok)
              ? 'bg-[#3498DB] text-white hover:bg-[#2E86C1] shadow-md shadow-[#1A5276]/40'
              : 'opacity-40 cursor-not-allowed bg-steel-600 text-steel-400')}>
            下一步<ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

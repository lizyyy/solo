import { useMemo, useState } from 'react';
import {
  Archive, CheckCircle2, ChevronRight, Download, FileSpreadsheet,
  FileText, MapPin, Package, ScrollText, Sticker,
} from 'lucide-react';
import { useAppStore, getSummary } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { exportCSV, exportPDF, downloadBlob, downloadText } from '@/utils/exporter';
import { STATUS_LABELS } from '@/types';
import { formatDate, formatDateTime } from '@/utils/date';
import { cn } from '@/lib/utils';

const CMAP = {
  red: { bg: 'bg-[#C0392B]', ring: 'ring-[#E74C3C]/40', tx: 'text-[#FFE5E0]', sh: 'shadow-[#C0392B]/40' },
  navy: { bg: 'bg-steel-900', ring: 'ring-[#3498DB]/40', tx: 'text-steel-100', sh: 'shadow-steel-900/40' },
};

function SealButton({ onClick, icon: Icon, label, sub, color, disabled }: {
  onClick: () => void | Promise<void>; icon: typeof FileText;
  label: string; sub: string; color: 'red' | 'navy'; disabled?: boolean;
}) {
  const [stamping, setStamping] = useState(false);
  const c = CMAP[color];
  const handle = async () => {
    if (disabled || stamping) return;
    setStamping(true); await onClick();
    setTimeout(() => setStamping(false), 700);
  };
  return (
    <button onClick={handle} disabled={disabled} className={cn('group relative flex flex-col items-center gap-2 transition-opacity', disabled && 'opacity-40 cursor-not-allowed')}>
      <div className={cn('relative w-24 h-24 rounded-full flex items-center justify-center', c.bg, c.tx, 'shadow-xl', c.sh, 'ring-4 ring-offset-4 ring-offset-steel-900', c.ring, 'transition-transform duration-500 ease-out', stamping && 'scale-90 rotate-[25deg] animate-pulse', !disabled && !stamping && 'group-hover:scale-105 group-hover:rotate-3')}>
        <div className="absolute inset-2 rounded-full border-2 border-dashed border-current/40" />
        <div className="flex flex-col items-center gap-0.5 z-10">
          <Icon className="w-7 h-7" strokeWidth={2.2} />
          <span className="text-[10px] font-bold tracking-widest">{label}</span>
        </div>
        {stamping && <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />}
      </div>
      <span className="text-xs font-semibold text-steel-300">{sub}</span>
    </button>
  );
}

function Toast({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-900 text-emerald-50 px-5 py-3 rounded-sm shadow-2xl animate-[slideIn_0.3s_ease-out]">
      <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center shrink-0"><Sticker className="w-4 h-4" /></div>
      <div><div className="font-bold text-sm">印章已盖 · 导出成功</div><div className="text-xs text-emerald-200">文件已下载</div></div>
      <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
    </div>
  );
}

export default function ExportCenterPage() {
  const { drawings, notes, materials, changeLogs, exportLogs, versions, dirtyExport } = useAppStore(
    useShallow((s) => ({
      drawings: s.drawings,
      notes: s.notes,
      materials: s.materials,
      changeLogs: s.changeLogs,
      exportLogs: s.exportLogs,
      versions: s.versions,
      dirtyExport: s.dirtyExport,
    })),
  );
  const logExport = useAppStore((s) => s.logExport);
  const state = { currentUser: useAppStore.getState().currentUser, drawings, versions, notes, materials, changeLogs, exportLogs };

  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const selD = selected ? drawings.find(d => d.id === selected) ?? null : null;
  const summary = getSummary(useAppStore.getState());
  const today = formatDate(new Date().toISOString()).replace(/-/g, '');

  const selNs = useMemo(() => notes.filter(n => n.drawingId === selected).slice(0, 3), [notes, selected]);
  const selMs = useMemo(() => materials.filter(m => m.drawingId === selected).slice(0, 3), [materials, selected]);
  const selCs = useMemo(() => changeLogs.filter(c => c.drawingId === selected).slice(0, 3), [changeLogs, selected]);

  const showT = () => { setToast(true); setTimeout(() => setToast(false), 3000); };

  const doPDF = async () => {
    if (!selD) return;
    const blob = await exportPDF(selD, notes.filter(n => n.drawingId === selD.id), materials.filter(m => m.drawingId === selD.id), changeLogs.filter(c => c.drawingId === selD.id));
    downloadBlob(blob, `${selD.name.slice(0, 8)}-预审报告-${today}.pdf`);
    logExport({ type: 'pdf', drawingId: selD.id, fileName: `${selD.name.slice(0, 8)}-预审报告-${today}.pdf` });
    showT();
  };

  const doCSV = () => {
    const fn = `全项目预审汇总-${today}.csv`;
    downloadText(exportCSV(state), fn, 'text/csv');
    logExport({ type: 'csv', fileName: fn });
    showT();
  };

  const statusCls = (st: string) => cn(
    'px-1.5 py-0.5 rounded-sm text-[10px] font-bold',
    st === 'normal' && 'bg-emerald-900/40 text-emerald-400',
    st === 'abnormal' && 'bg-[#E74C3C]/20 text-[#E74C3C]',
    st === 'reviewing' && 'bg-amber-900/40 text-amber-400',
    st === 'closed' && 'bg-steel-600 text-steel-100',
  );

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-sm bg-amber-900/40 border border-amber-600/50 flex items-center justify-center"><Archive className="w-5 h-5 text-amber-400" /></div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-steel-100">导出中心</h1>
            {dirtyExport && <span className="flex items-center gap-1 text-[10px] bg-[#E74C3C]/20 text-[#E74C3C] px-2 py-0.5 rounded-sm font-bold animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-[#E74C3C]" />数据已更新</span>}
          </div>
          <p className="text-sm text-steel-300">{summary.total} 张图纸 · {summary.missingMaterials} 项缺料</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7">
          <div className="bg-steel-800 rounded-sm border border-steel-600 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-steel-700 border-b border-steel-600 flex items-center justify-between">
              <div className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-steel-300" /><span className="font-semibold text-steel-100">导出预览</span></div>
              <button onClick={() => setSelected(null)} className={cn('text-xs px-3 py-1 rounded-sm', !selected ? 'bg-[#1A5276]/30 border border-[#3498DB] text-[#5DADE2] font-bold' : 'text-steel-300 hover:bg-steel-700/40')}>全量导出</button>
            </div>
            <div className="p-5 space-y-2 max-h-[500px] overflow-auto">
              {drawings.map(d => {
                const v = versions.find(x => x.id === d.currentVersionId);
                const active = selected === d.id;
                return (
                  <button key={d.id} onClick={() => setSelected(active ? null : d.id)} className={cn('w-full text-left p-3.5 rounded-sm border-2 transition-all', active ? 'border-[#3498DB] bg-[#1A5276]/20 shadow-md' : 'border-transparent hover:border-steel-600 hover:bg-steel-700/40')}>
                    <div className="flex items-center gap-3">
                      <div className={cn('w-5 h-5 rounded-sm border-2 flex items-center justify-center shrink-0', active ? 'border-[#5DADE2] bg-[#5DADE2]' : 'border-steel-500')}>
                        {active && <CheckCircle2 className="w-3.5 h-3.5 text-steel-900" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-steel-100 truncate">{d.name}</span>
                          <span className="text-[10px] bg-steel-700/40 text-steel-300 px-1.5 py-0.5 rounded-sm font-mono">{v?.version}</span>
                        </div>
                        <div className="text-xs text-steel-300 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{d.buildingName}<ChevronRight className="w-3 h-3" /><span className={statusCls(d.status)}>{STATUS_LABELS[d.status]}</span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-steel-300 shrink-0">
                        <div>碰撞 {d.metrics.collisionPoints}</div>
                        <div>缺料 {materials.filter(m => m.drawingId === d.id && m.isMissing).length}</div>
                      </div>
                    </div>
                    {active && (
                      <div className="mt-3 pt-3 border-t border-[#3498DB]/60 grid grid-cols-3 gap-3">
                        <div>
                          <div className="flex items-center gap-1 text-[10px] text-steel-300 mb-1.5"><ScrollText className="w-3 h-3" />备注 ({selNs.length})</div>
                          {selNs.length === 0 ? <div className="text-[11px] text-steel-400 italic">无</div> : selNs.map(n => (
                            <div key={n.id} className="text-[11px] text-steel-300 bg-steel-800 rounded-sm p-1.5 line-clamp-2 border border-steel-600 mb-1">{n.content}</div>
                          ))}
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-[10px] text-steel-300 mb-1.5"><Package className="w-3 h-3" />材料 ({selMs.length})</div>
                          {selMs.length === 0 ? <div className="text-[11px] text-steel-400 italic">无</div> : selMs.map(m => (
                            <div key={m.id} className={cn('text-[11px] px-1.5 py-1 rounded-sm flex items-center gap-1 mb-1', m.isMissing ? 'bg-[#E74C3C]/20 text-[#E74C3C]' : 'bg-steel-700/40 text-steel-300')}>
                              {m.isMissing && <span className="w-1.5 h-1.5 rounded-full bg-[#E74C3C]" />}<span className="truncate">{m.batchNo}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-[10px] text-steel-300 mb-1.5"><FileText className="w-3 h-3" />变更 ({selCs.length})</div>
                          {selCs.length === 0 ? <div className="text-[11px] text-steel-400 italic">无</div> : selCs.map(c => (
                            <div key={c.id} className="text-[11px] bg-steel-700/40 text-steel-300 rounded-sm px-1.5 py-1 mb-1">{c.fieldLabel}:{c.oldValue}→{c.newValue}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-span-5 space-y-5">
          <div className="bg-steel-800 rounded-sm border border-steel-600 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-5"><Sticker className="w-4 h-4 text-steel-300" /><span className="font-semibold text-steel-100">盖章导出</span></div>
            <div className="flex items-center justify-around">
              <SealButton onClick={doPDF} icon={FileText} label="PDF" sub={selD ? '单图纸报告' : '请选图纸'} color="red" disabled={!selD} />
              <div className="text-xl text-steel-500">·</div>
              <SealButton onClick={doCSV} icon={FileSpreadsheet} label="CSV" sub="全量汇总表" color="navy" />
            </div>
          </div>

          <div className="bg-steel-800 rounded-sm border border-steel-600 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-steel-700 border-b border-steel-600 flex items-center justify-between">
              <div className="flex items-center gap-2"><Download className="w-4 h-4 text-steel-300" /><span className="font-semibold text-steel-100 text-sm">导出日志</span></div>
              <span className="text-xs text-steel-400">{exportLogs.length} 条</span>
            </div>
            <div className="max-h-[260px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-steel-700 z-10">
                  <tr className="text-[11px] text-steel-300"><th className="text-left px-4 py-2 font-medium">文件名</th><th className="text-left px-4 py-2 font-medium">类型</th><th className="text-left px-4 py-2 font-medium">操作人</th><th className="text-left px-4 py-2 font-medium">时间</th></tr>
                </thead>
                <tbody>
                  {exportLogs.map((log, i) => (
                    <tr key={log.id} className={cn(i % 2 === 1 && 'bg-steel-700/30')}>
                      <td className="px-4 py-2 text-steel-100 truncate max-w-[160px]">{log.fileName}</td>
                      <td className="px-4 py-2"><span className={cn('text-[10px] px-2 py-0.5 rounded-sm font-bold', log.type === 'pdf' ? 'bg-[#E74C3C]/20 text-[#E74C3C]' : 'bg-steel-600 text-steel-100')}>{log.type.toUpperCase()}</span></td>
                      <td className="px-4 py-2 text-steel-300 text-xs">{log.operatorName}</td>
                      <td className="px-4 py-2 text-steel-400 text-xs">{formatDateTime(log.exportedAt)}</td>
                    </tr>
                  ))}
                  {exportLogs.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-steel-400 text-xs italic">暂无记录</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Toast show={toast} />
      <style>{`@keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useExportStore } from '@/store/exportStore.js';
import { useReviewStore } from '@/store/reviewStore.js';
import type { ExportDiff } from '../../shared/types.js';
import {
  FileDown, FileSpreadsheet, AlertTriangle, CheckCircle2, History,
  RefreshCw, ChevronDown, ChevronRight, Trash2, Plus, ArrowRight, Download,
  Eye,
} from 'lucide-react';

export default function ExportCenterPage() {
  const history = useExportStore(s => s.history);
  const diffs = useExportStore(s => s.diffs);
  const summary = useExportStore(s => s.summary);
  const selectedDiffId = useExportStore(s => s.selectedDiffId);
  const fetchHistory = useExportStore(s => s.fetchHistory);
  const fetchDiff = useExportStore(s => s.fetchDiff);
  const runReport = useExportStore(s => s.runReport);
  const runExc = useExportStore(s => s.runExceptions);
  const dlReport = useExportStore(s => s.downloadReportFile);
  const dlExc = useExportStore(s => s.downloadExceptionsFile);
  const loading = useExportStore(s => s.loading);

  const records = useReviewStore(s => s.records);
  const exceptions = useReviewStore(s => s.exceptions);

  const [reportResult, setReportResult] = useState<string | null>(null);
  const [excResult, setExcResult] = useState<{ warning: string; bad: number } | null>(null);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => {
    fetchHistory();
    if (!records.length) useReviewStore.getState().fetchRecords();
    if (!exceptions.length) useReviewStore.getState().fetchExceptions();
  }, []);

  const historyByType = useMemo(() => {
    return {
      report: history.filter(h => h.exportType === 'report'),
      exceptions: history.filter(h => h.exportType === 'exceptions'),
    };
  }, [history]);

  const handleReport = async () => {
    setReportResult(null);
    const res = await runReport();
    if (res) setReportResult(res.message + ' （文件名：' + res.fileName + '）');
  };

  const handleExc = async () => {
    setExcResult(null);
    const res = await runExc();
    if (res) setExcResult({ warning: res.warning, bad: res.inconsistentCount });
  };

  return (
    <div className="space-y-6 stagger">
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card card-hover p-6 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 opacity-15 group-hover:opacity-25 transition" />
          <div className="space-y-4 relative">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-600/25">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h3 className="font-serif font-bold text-xl text-ink-700">复核报告导出</h3>
                <p className="text-xs text-ink-500 mt-0.5">包含所有寄养记录，体重异常和疫苗缺失有痕迹标记</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-ink-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-brand-500" />
                含疫苗缺失异常痕迹（缺失行高亮标记）
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-brand-500" />
                含体重异常日期痕迹（波动日期附异常标注）
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-brand-500" />
                含影响结论因素追踪字段
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-brand-500" />
                备注修改后导出内容同步最新值
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-ink-300">共 {records.length} 条记录</span>
              <div className="flex items-center gap-2">
                <button onClick={handleReport} disabled={loading.report} className="btn-secondary text-sm py-2">
                  {loading.report ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                  预览生成
                </button>
                <button onClick={dlReport} disabled={loading.dlReport} className="btn-primary text-sm py-2">
                  {loading.dlReport ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                  下载 Excel
                </button>
              </div>
            </div>

            {reportResult && (
              <div className="animate-slide-down rounded-xl border-2 border-brand-200 bg-brand-50/60 p-3 flex items-start gap-2.5 text-sm">
                <CheckCircle2 size={16} className="text-brand-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-brand-700 mb-0.5">✅ 报告生成成功</div>
                  <div className="text-ink-600 text-xs leading-relaxed">{reportResult}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card card-hover p-6 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br from-warn-400 to-warn-600 opacity-15 group-hover:opacity-25 transition" />
          <div className="space-y-4 relative">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-warn-400 to-warn-600 text-white flex items-center justify-center shadow-lg shadow-warn-500/25">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-serif font-bold text-xl text-ink-700">异常队列导出</h3>
                <p className="text-xs text-ink-500 mt-0.5">状态、备注、文件结论三项一致性自动校验</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-ink-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-brand-500" />
                导出前自动校验状态↔备注↔文件结论一致性
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-brand-500" />
                不一致项附带红色 ⚠ 标记便于处理
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-brand-500" />
                支持按异常类型分组筛选导出
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-brand-500" />
                每项带关联宠物和原始记录编号追溯链接
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-ink-300">共 {exceptions.length} 条异常，其中
                <span className={exceptions.some(e => !e.isConsistent) ? 'text-warn-500 font-semibold' : 'text-brand-500 font-semibold'}>
                  &nbsp;{exceptions.filter(e => !e.isConsistent).length}&nbsp;
                </span>
                条不一致
              </span>
              <div className="flex items-center gap-2">
                <button onClick={handleExc} disabled={loading.exceptions} className="btn-secondary text-sm py-2">
                  {loading.exceptions ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                  预览生成
                </button>
                <button onClick={dlExc} disabled={loading.dlExc} className="btn-primary text-sm py-2">
                  {loading.dlExc ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                  下载 Excel
                </button>
              </div>
            </div>

            {excResult && (
              <div className={`animate-slide-down rounded-xl border-2 p-3 flex items-start gap-2.5 text-sm
                ${excResult.bad > 0 ? 'border-warn-400/50 bg-warn-400/10' : 'border-brand-200 bg-brand-50/60'}`}>
                {excResult.bad > 0 ? <AlertTriangle size={16} className="text-warn-500 shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="text-brand-600 shrink-0 mt-0.5" />}
                <div>
                  <div className={`font-semibold mb-0.5 ${excResult.bad > 0 ? 'text-warn-600' : 'text-brand-700'}`}>
                    {excResult.bad > 0 ? '⚠️ 存在不一致需核对' : '✅ 全部一致'}
                  </div>
                  <div className="text-ink-600 text-xs leading-relaxed">{excResult.warning}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <DiffViewer diffs={diffs} summary={summary} exportId={selectedDiffId} />

      <section className="card p-6">
        <button onClick={() => setShowHistory(s => !s)}
          className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <History size={18} className="text-ink-500" />
            <span className="section-title">导出历史（含补录备注变更对比）</span>
            <span className="chip bg-ink-100 text-ink-500">共 {history.length} 次</span>
          </div>
          {showHistory ? <ChevronDown size={18} className="text-ink-500" /> : <ChevronRight size={18} className="text-ink-500" />}
        </button>

        {showHistory && (
          <div className="mt-5 space-y-4">
            {(['report', 'exceptions'] as const).map(kind => (
              <div key={kind}>
                <div className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  {kind === 'report' ? <FileSpreadsheet size={13} /> : <AlertTriangle size={13} />}
                  {kind === 'report' ? '复核报告导出' : '异常队列导出'}
                </div>
                <div className="space-y-2">
                  {historyByType[kind].length === 0 ? (
                    <div className="text-xs text-ink-300 py-4 text-center bg-ink-50/60 rounded-xl">暂无导出记录</div>
                  ) : historyByType[kind].map(h => {
                    const hasDiff = h.relatedRemarkId || h.changeSummary.includes('补录') || h.changeSummary.includes('更新');
                    const isSelected = selectedDiffId === h.id && diffs.length > 0;
                    return (
                      <div key={h.id}
                        className={`rounded-xl border p-3.5 flex items-center justify-between gap-4 transition
                          ${isSelected ? 'bg-brand-50/60 border-brand-300 ring-2 ring-brand-300/30' : 'border-ink-100 hover:bg-ink-50/40'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-ink-700">{h.id}</span>
                            <span className="text-[11px] text-ink-300">{h.createdAt.replace('T', ' ').slice(0, 16)}</span>
                            <span className="text-[11px] text-ink-500">操作人：{h.operator}</span>
                            {hasDiff && (
                              <span className="chip bg-warn-500/15 text-warn-600 inline-flex items-center gap-1">
                                <Plus size={11} /> 含变更
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-ink-500 mt-1 leading-relaxed">{h.changeSummary}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(hasDiff || h.id.startsWith('EXP-002')) && (
                            <button
                              onClick={() => {
                                if (selectedDiffId === h.id) {
                                  useExportStore.getState().selectDiff(null);
                                } else {
                                  fetchDiff(h.id);
                                }
                              }}
                              disabled={loading.diff}
                              className="btn-ghost text-xs py-1.5">
                              {loading.diff && selectedDiffId === h.id
                                ? <RefreshCw size={12} className="animate-spin" />
                                : <Trash2 size={12} style={{ display: 'none' }} />}
                              {loading.diff && selectedDiffId === h.id ? '加载中' : (isSelected ? '收起对比' : '查看变更')}
                              </button>
                          )}
                          <ArrowRight size={14} className="text-ink-300 hidden sm:block" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DiffViewer({ diffs, summary, exportId }: { diffs: ExportDiff[]; summary: string; exportId: string | null }) {
  if (!exportId || diffs.length === 0) {
    return (
      <section className="card p-6 bg-gradient-to-br from-ink-50/60 to-white border-dashed">
        <div className="text-center py-4">
          <FileDown size={30} className="mx-auto mb-3 text-ink-300" />
          <div className="text-sm font-semibold text-ink-500 mb-1">补录备注导出变更对比</div>
          <p className="text-xs text-ink-300 leading-relaxed max-w-lg mx-auto">
            系统会在补录备注后自动生成前后版本差异。选择下方导出历史中"含变更"的条目即可查看哪一行哪一字段被修改、修改原因是什么。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-6 border-2 border-brand-200 animate-slide-down">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div className="section-title flex items-center gap-2">
            <CheckCircle2 size={20} className="text-brand-600" />
            <span>补录备注 → 导出版本变更说明</span>
          </div>
          <div className="text-xs text-ink-500 mt-1 leading-relaxed">{summary}</div>
          <div className="text-[11px] text-ink-300 mt-0.5">导出版本 ID：{exportId}</div>
        </div>
      </div>

      <div className="space-y-3">
        {diffs.map((d, i) => (
          <div key={i} className="rounded-xl border border-ink-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-ink-50/80 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-brand-700 font-semibold">变更 #{i + 1}</span>
                <span className="chip bg-brand-100 text-brand-700 text-[11px]">第 {d.rowIndex} 行</span>
                <span className="chip bg-accent-300/30 text-accent-500 text-[11px]">字段：{d.field}</span>
              </div>
              <span className="text-[11px] text-ink-500">{d.changeReason}</span>
            </div>
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-ink-100">
              <div className="p-4 bg-warn-400/5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-warn-500 uppercase tracking-wider mb-2">
                  <Trash2 size={11} /> 修改前
                </div>
                <div className="text-sm text-ink-500 line-through decoration-warn-400/60 decoration-2 leading-relaxed">
                  {d.before || <span className="text-ink-300">(空)</span>}
                </div>
              </div>
              <div className="p-4 bg-brand-50/60">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 uppercase tracking-wider mb-2">
                  <Plus size={11} /> 修改后
                </div>
                <div className="text-sm text-brand-700 leading-relaxed font-medium">
                  {d.after}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-brand-50/60 border border-brand-100 px-4 py-3 text-xs text-brand-700 leading-relaxed">
        💡 <span className="font-semibold">老周的交付验证说明：</span>
        进入任意寄养记录详情页 → 完成复核后在补录备注区输入补充内容 → 点击"补录并生成变更说明" → 回到本页即可在最新导出历史中看到含变更标记条目，点击即可查看如上对比。
      </div>
    </section>
  );
}

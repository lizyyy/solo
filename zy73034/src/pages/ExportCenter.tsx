import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileSpreadsheet,
  FileJson,
  ShieldAlert,
  Sparkles,
  History,
  Table2,
  Download,
  CheckCircle2,
  AlertTriangle,
  Info,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { usePetStore } from '@/store/petStore';
import { formatDate, EVENT_TYPE_LABEL, EXPORT_FIELDS, profileToRowValue } from '@/utils/tracking';
import { AnomalyBadge, JudgeLabel, ProgressLabel } from '@/components/Badges';
import type { ExportDiff } from '@/types';

export default function ExportCenter() {
  const {
    pets,
    events,
    loading,
    loadPets,
    lastExport,
  } = usePetStore();

  const [lastAction, setLastAction] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<'csv' | 'json' | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('加载中…');
  const [exportData, setExportData] = useState<{ csv: string; json: string; diffs: ExportDiff[] } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    loadPets();
  }, [loadPets]);

  const anomalyRows = pets.filter((p) => p.anomalies.length > 0);

  const diffByPet = useMemo(() => {
    if (!exportData?.diffs) return new Map<string, ExportDiff[]>();
    const m = new Map<string, ExportDiff[]>();
    for (const d of exportData.diffs) {
      if (!m.has(d.petId)) m.set(d.petId, []);
      m.get(d.petId)!.push(d);
    }
    return m;
  }, [exportData?.diffs]);

  const fetchExport = async (): Promise<{ csv: string; json: string; diffs: ExportDiff[] }> => {
    if (exportData) return exportData;
    setExportLoading(true);
    try {
      const [csvRes, jsonRes] = await Promise.all([
        fetch('/api/export?format=csv'),
        fetch('/api/export?format=json'),
      ]);
      const csv = await csvRes.text();
      const json = await jsonRes.text();
      const jsonData = JSON.parse(json);
      const data = { csv, json, diffs: jsonData.exportImpact?.diffs || [] };
      setExportData(data);
      return data;
    } finally {
      setExportLoading(false);
    }
  };

  const download = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePreview = async (kind: 'csv' | 'json') => {
    setShowPreview(kind);
    setPreviewContent('加载中…');
    const data = await fetchExport();
    setPreviewContent(kind === 'csv' ? data.csv : data.json);
  };

  const handleDownload = async (kind: 'csv' | 'json') => {
    const data = await fetchExport();
    const name = `宠物训练课回访追踪-${new Date().toISOString().slice(0, 10)}.${kind}`;
    download(
      kind === 'csv' ? data.csv : data.json,
      name,
      kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
    );
    setLastAction(`已导出 ${kind.toUpperCase()}：${name}`);
    setTimeout(() => setLastAction(null), 5000);
  };

  const summary = useMemo(() => ({
    totalRows: pets.length,
    anomalyRows: anomalyRows.length,
    diffs: exportData?.diffs || [],
    eventsCount: events.length,
  }), [pets, anomalyRows, exportData?.diffs, events.length]);

  return (
    <div className="min-h-screen bg-paper pb-16">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border border-parchment-200 bg-white px-6 py-4 shadow-card">
            <Loader2 className="h-5 w-5 animate-spin text-sage-600" />
            <span className="text-sm text-slate-600">正在从后端加载数据…</span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-parchment-200 bg-parchment-100/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sage-200 bg-white px-3 py-1.5 text-sm text-sage-700 hover:bg-sage-50"
            >
              <ArrowLeft className="h-4 w-4" />
              返回主列表
            </Link>
            <div>
              <h1 className="font-song text-2xl font-bold text-sage-800">导出中心</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                <span className="font-mono">CSV / JSON</span>
                <span className="mx-2 text-slate-300">·</span>
                附导出变更说明摘要与异常标记列，便于后续复核
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePreview('csv')}
              disabled={exportLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sage-200 bg-white px-3.5 py-2 text-sm font-medium text-sage-700 shadow-sm hover:bg-sage-50 disabled:opacity-50"
            >
              <Table2 className="h-4 w-4" />
              CSV 预览
            </button>
            <button
              onClick={() => handleDownload('csv')}
              disabled={exportLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sage-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-sage-700 disabled:opacity-50"
            >
              {exportLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              下载 CSV
            </button>
            <button
              onClick={() => handleDownload('json')}
              disabled={exportLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <FileJson className="h-4 w-4" />
              下载 JSON
            </button>
          </div>
        </div>
      </header>

      {lastAction && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-sage-300 bg-white/95 px-5 py-3 shadow-card backdrop-blur">
          <div className="flex items-center gap-2 text-sm text-sage-700">
            <CheckCircle2 className="h-4 w-4" />
            <b>{lastAction}</b>
            <span className="text-slate-500">，下次导出将以此为基线比对差异。</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1280px] space-y-5 px-6 py-6">
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: '即将导出行数',
              val: summary.totalRows,
              icon: Table2,
              color: 'bg-sage-100 text-sage-700',
            },
            {
              label: '含异常痕迹行数',
              val: summary.anomalyRows,
              icon: ShieldAlert,
              color: 'bg-clay-50 text-clay-600',
              hint: '导出第 12 列「异常标记」会详细列出',
            },
            {
              label: '与上次差异数',
              val: summary.diffs.length,
              icon: Sparkles,
              color: lastExport ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500',
              hint: lastExport
                ? `上次导出：${formatDate(lastExport.generatedAt)}`
                : '首次导出，全部为新增',
            },
            {
              label: '事件日志条数',
              val: summary.eventsCount,
              icon: History,
              color: 'bg-amber-50 text-amber-700',
              hint: 'JSON 包含完整事件日志',
            },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-parchment-200 bg-white p-4 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold text-slate-800">{s.val}</div>
                  <div className="text-xs font-medium text-slate-600">{s.label}</div>
                </div>
                {s.hint && (
                  <div className="max-w-[180px] text-right text-[11px] text-slate-400">{s.hint}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-parchment-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-parchment-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-sage-600" />
              <h2 className="font-song text-lg font-bold text-sage-800">与上次导出的差异摘要</h2>
              <span className="rounded-full bg-sage-50 px-2 py-0.5 text-xs font-mono text-sage-700">
                {summary.diffs.length} 处
              </span>
            </div>
            {summary.diffs.length > 0 && (
              <span className="text-[11px] text-slate-400">
                ⚠ 这些差异在 CSV 文件末尾也会以注释形式追加
              </span>
            )}
          </div>
          {summary.diffs.length === 0 ? (
            <div className="p-10 text-center">
              <Info className="mx-auto mb-2 h-10 w-10 text-sage-300" />
              <div className="font-song text-lg text-slate-600">暂无差异</div>
              <p className="mt-1 text-xs text-slate-400">
                {lastExport ? '上次导出后未发生变更，或这是第一次重置后。' : '首次导出：全部记录视为新增，CSV 底部会说明。'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-parchment-100">
              {Array.from(diffByPet.entries()).map(([petId, petDiffs]) => {
                const pet = pets.find((p) => p.petId === petId);
                return (
                  <li key={petId} className="p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-song text-base font-bold text-sage-800">
                        {pet?.name || petId}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">{petId}</span>
                      <span className="rounded-full bg-clay-50 px-2 py-0.5 text-[11px] text-clay-700">
                        影响：{petDiffs[0]?.rowIndex > 0 ? `第 ${petDiffs[0]?.rowIndex} 行` : '删除行'}
                      </span>
                      {petDiffs.map((d) => (
                        <span
                          key={d.eventId + d.field}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                        >
                          {EVENT_TYPE_LABEL[d.eventType]}
                        </span>
                      ))}
                    </div>
                    <div className="ml-2 space-y-1.5">
                      {petDiffs.map((d, i) => (
                        <div
                          key={i}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-parchment-100 bg-parchment-50/60 px-3 py-2 text-xs"
                        >
                          <span className="font-mono font-semibold text-slate-500">#{i + 1}</span>
                          <span className="rounded bg-sage-100 px-1.5 py-0.5 font-medium text-sage-700">
                            {d.field}
                          </span>
                          <span className="max-w-[30ch] truncate text-slate-400 line-through">
                            {d.oldValue}
                          </span>
                          <span className="text-slate-300">→</span>
                          <span className="max-w-[30ch] truncate font-medium text-slate-800">
                            {d.newValue}
                          </span>
                          <span className="ml-auto flex items-center gap-1 text-slate-500">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(d.timestamp)}
                          </span>
                          <div className="basis-full truncate text-[11px] text-slate-500">
                            <b className="text-slate-600">变更原因：</b>
                            {d.reason || '（未填写说明）'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-clay-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-clay-200 bg-clay-50/40 px-5 py-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-clay-600" />
              <h2 className="font-song text-lg font-bold text-clay-700">
                异常痕迹（导出第 12 列）
              </h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-clay-600 shadow-sm">
                {anomalyRows.length} / {pets.length}
              </span>
            </div>
            <span className="text-[11px] text-clay-700/80">
              即使筛选时不显示，导出仍会完整保留异常标记列
            </span>
          </div>
          {anomalyRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              没有异常记录——演示数据正常情况下应可见，可点左栏「重置为演示数据」恢复。
            </div>
          ) : (
            <ul className="divide-y divide-parchment-100">
              {anomalyRows.map((pet) => (
                <li key={pet.petId} className="flex flex-wrap items-start gap-3 px-5 py-3">
                  <Link
                    to={`/pet/${pet.petId}`}
                    className="min-w-[120px] font-song text-base font-semibold text-sage-700 hover:underline"
                  >
                    {pet.name}
                    <span className="ml-2 font-mono text-[11px] font-normal text-slate-400">
                      {pet.petId}
                    </span>
                  </Link>
                  <div className="flex flex-wrap items-center gap-1">
                    <ProgressLabel progress={pet.trainingProgress} />
                    <JudgeLabel judge={pet.trainingJudge} />
                  </div>
                  <div className="flex flex-1 flex-wrap justify-end gap-1.5">
                    {pet.anomalies.map((a, i) => (
                      <AnomalyBadge key={i} anomaly={a} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-parchment-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-parchment-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-sage-600" />
              <h2 className="font-song text-lg font-bold text-sage-800">导出行预览（前 5 列 + 异常列）</h2>
            </div>
            <span className="text-[11px] text-slate-400">
              共 {EXPORT_FIELDS.length} 列 · 见 CSV / JSON 完整文件
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-parchment-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">行号</th>
                  {EXPORT_FIELDS.slice(1, 6).map((f) => (
                    <th key={f.key} className="px-3 py-2 text-left font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left font-medium">异常标记</th>
                  <th className="px-3 py-2 text-left font-medium">最后更新</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-parchment-100">
                {pets.map((pet, idx) => {
                  const hasDiff = diffByPet.has(pet.petId);
                  return (
                    <tr
                      key={pet.petId}
                      className={
                        hasDiff
                          ? 'bg-amber-50/40 hover:bg-amber-50'
                          : pet.anomalies.length
                          ? 'bg-clay-50/20 hover:bg-clay-50/40'
                          : 'hover:bg-sage-50/40'
                      }
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-500">{idx + 1}</span>
                          {hasDiff && (
                            <span title="与上次相比有变化">
                              <Sparkles className="h-3 w-3 text-amber-600" />
                            </span>
                          )}
                        </div>
                      </td>
                      {EXPORT_FIELDS.slice(1, 6).map((f) => (
                        <td key={f.key} className="max-w-[22ch] truncate px-3 py-2 text-slate-700" title={profileToRowValue(pet, f.key)}>
                          {profileToRowValue(pet, f.key) || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {pet.anomalies.length ? (
                          <div className="flex flex-wrap gap-1">
                            {pet.anomalies.slice(0, 2).map((a, i) => (
                              <AnomalyBadge key={i} anomaly={a} compact />
                            ))}
                            {pet.anomalies.length > 2 && (
                              <span className="text-[11px] text-slate-400">
                                +{pet.anomalies.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">（正常）</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                        {formatDate(pet.lastModifiedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showPreview && (
        <PreviewDialog
          kind={showPreview}
          onClose={() => setShowPreview(null)}
          content={previewContent}
        />
      )}
    </div>
  );
}

function PreviewDialog({
  kind,
  onClose,
  content,
}: {
  kind: 'csv' | 'json';
  onClose: () => void;
  content: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-parchment-200 bg-white shadow-card"
      >
        <div className="flex items-center justify-between border-b border-parchment-200 px-5 py-3">
          <div className="flex items-center gap-2">
            {kind === 'csv' ? (
              <FileSpreadsheet className="h-5 w-5 text-sage-600" />
            ) : (
              <FileJson className="h-5 w-5 text-sky-600" />
            )}
            <h3 className="font-song text-lg font-bold text-slate-700">
              {kind === 'csv' ? 'CSV 文件预览' : 'JSON 文件预览'}
            </h3>
            <span className="text-xs text-slate-400">
              {kind === 'csv'
                ? '末尾包含变更说明注释（带 # 号）'
                : '包含事件日志、差异摘要、异常痕迹'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={URL.createObjectURL(new Blob([content], { type: kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' }))}
              download={`preview.${kind}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sage-600 px-3 py-1.5 text-xs text-white hover:bg-sage-700"
            >
              <Download className="h-3.5 w-3.5" />
              下载
            </a>
            <button
              onClick={onClose}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              关闭
            </button>
          </div>
        </div>
        <pre className="m-3 flex-1 overflow-auto rounded-lg border border-parchment-200 bg-parchment-50 p-4 text-xs leading-relaxed text-slate-700">
{content}
        </pre>
      </div>
    </div>
  );
}

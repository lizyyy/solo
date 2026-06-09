import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, CheckCircle2, AlertTriangle, CheckSquare, Square, ArrowRight, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useReviewStore, getFilteredAnomalies, getFilteredRecords } from '../store/reviewStore';
import { SCHEME_COLORS, STATUS_LABEL, ANOMALY_LABEL } from '../data/mockData';
import type { RecordStatus, AnomalyType } from '../types';

export default function ExportPage() {
  const {
    zones,
    records,
    activeScheme,
    setActiveScheme,
    statusFilter,
    setStatusFilter,
    anomalyFilter,
    setAnomalyFilter
  } = useReviewStore();

  const anomalies = useMemo(() => getFilteredAnomalies(), [activeScheme, anomalyFilter, statusFilter]);
  const filteredRecords = useMemo(() => getFilteredRecords(), [activeScheme, statusFilter]);

  const [includeStatus, setIncludeStatus] = useState<Record<RecordStatus, boolean>>({
    confirmed: true, pending: true, returned: true
  });
  const [includeAnomaly, setIncludeAnomaly] = useState<Record<AnomalyType, boolean>>({
    collision_duplicate: true, remark_conflict: true, remark_missing: true
  });
  const [exportMode, setExportMode] = useState<'records' | 'anomalies' | 'both'>('both');
  const [alignCheck, setAlignCheck] = useState(true);

  const finalAnomalies = anomalies.filter((a) => includeAnomaly[a.type]);
  const finalRecords = filteredRecords.filter((r) => includeStatus[r.status]);

  const alignmentIssues = useMemo(() => {
    const issues: string[] = [];
    finalAnomalies.forEach((a) => {
      const rec = finalRecords.find((r) => r.zoneId === a.zoneId && r.schemeId === a.schemeId);
      if (!rec) {
        issues.push(`${a.id}（${a.zoneId} 方案${a.schemeId}）异常条目缺少对应记录，导出状态会为空`);
        return;
      }
      if (rec.status === 'confirmed' && !a.resolved) {
        issues.push(`⚠ ${rec.zoneId} 记录标记为"已确认"，但异常 ${a.id} 未解决 — 导出时状态与异常未对齐`);
      }
      if (rec.status === 'returned' && rec.anomalyIds.length === 0) {
        issues.push(`⚠ ${rec.zoneId} 标记为"退回"但异常队列为空 — 结论与异常不一致`);
      }
      const recMentionBim = (rec.remarks.bimOriginal ?? '').length;
      const recMentionSupp = (rec.remarks.supplementary ?? '').length;
      if (rec.status === 'confirmed' && (!recMentionBim || !recMentionSupp)) {
        issues.push(`⚠ ${rec.zoneId} 标记已确认但 BIM/后补备注不完整，文件结论与备注口径可能对不上`);
      }
    });
    return issues;
  }, [finalAnomalies, finalRecords]);

  function generateRecordCSV() {
    const headers = ['记录编号', '分区编号', '分区名称', '楼层', '方案', '版本时间', '状态', 'BIM原备注', '后补备注', '口头说明', '口径是否一致', '文件结论', '关联异常数', '复核人', '复核时间'];
    const rows = finalRecords.map((r) => {
      const z = zones.find((x) => x.id === r.zoneId);
      return [
        r.id,
        r.zoneId,
        z?.name ?? '',
        z?.floor ?? '',
        '方案' + r.schemeId,
        new Date(r.versionAt).toLocaleString('zh-CN'),
        STATUS_LABEL[r.status].text,
        `"${(r.remarks.bimOriginal ?? '').replace(/"/g, '""')}"`,
        `"${(r.remarks.supplementary ?? '').replace(/"/g, '""')}"`,
        `"${(r.remarks.verbal ?? '').replace(/"/g, '""')}"`,
        r.remarks.hasConflict ? '不一致' : '一致',
        `"${r.fileConclusion.replace(/"/g, '""')}"`,
        r.anomalyIds.length,
        r.reviewedBy ?? '',
        r.reviewedAt ? new Date(r.reviewedAt).toLocaleString('zh-CN') : ''
      ].join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  }

  function generateAnomalyCSV() {
    const headers = ['异常编号', '类型', '分区', '方案', '记录状态', '描述', '明细', '重复次数', '创建时间', '是否解决', '对应文件结论', '对应备注口径一致？'];
    const rows = finalAnomalies.map((a) => {
      const r = finalRecords.find((x) => x.zoneId === a.zoneId && x.schemeId === a.schemeId);
      return [
        a.id,
        ANOMALY_LABEL[a.type].text,
        a.zoneId,
        '方案' + a.schemeId,
        r ? STATUS_LABEL[r.status].text : '无记录',
        `"${a.description.replace(/"/g, '""')}"`,
        `"${a.detail.replace(/"/g, '""')}"`,
        a.duplicateCount ?? 1,
        new Date(a.createdAt).toLocaleString('zh-CN'),
        a.resolved ? '是' : '否',
        r ? `"${r.fileConclusion.replace(/"/g, '""')}"` : '',
        r ? (r.remarks.hasConflict ? '不一致' : '一致') : ''
      ].join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  }

  function download(filename: string, content: string) {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function doExport() {
    const ts = new Date().toISOString().slice(0, 10);
    if (exportMode === 'records' || exportMode === 'both') {
      download(`消防分区比选记录-${activeScheme}-${ts}.csv`, generateRecordCSV());
    }
    if (exportMode === 'anomalies' || exportMode === 'both') {
      download(`消防分区异常队列-${activeScheme}-${ts}.csv`, generateAnomalyCSV());
    }
  }

  const schemeConf = SCHEME_COLORS[activeScheme];

  return (
    <div className="h-full flex flex-col bg-[#111927] overflow-auto">
      <div className="flex items-stretch border-b-2 border-slate-700/70 bg-gradient-to-r from-[#17202E] to-[#131B27]">
        <div className="flex-1 px-6 py-5 flex items-center gap-6">
          <div
            className="w-12 h-12 rounded-[6px] flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #10B98155, #05966922)', border: '2px solid #10B981' }}
          >
            <FileSpreadsheet size={24} className="text-emerald-300" />
          </div>
          <div>
            <h2 className="font-mono text-[16px] tracking-[0.15em] text-slate-100 font-bold">导出中心 · 字段对齐校验</h2>
            <p className="font-mono text-[10.5px] text-slate-500 mt-0.5">
              确保"状态 · 三源备注 · 文件结论"三列在 CSV 中互相对上，月底送审可直接作为附件
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 border-l border-slate-700/60">
          {(['A', 'B', 'C'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveScheme(s)}
              className={
                'px-3.5 py-2 rounded-[4px] font-mono text-[11px] tracking-[0.18em] border-2 transition-all ' +
                (activeScheme === s
                  ? 'text-white shadow-lg'
                  : 'bg-slate-800/40 border-slate-600/60 text-slate-500 hover:text-slate-300 hover:border-slate-500')
              }
              style={activeScheme === s ? { background: SCHEME_COLORS[s].main + '22', borderColor: SCHEME_COLORS[s].main, color: SCHEME_COLORS[s].main, boxShadow: `0 0 14px ${SCHEME_COLORS[s].glow}` } : {}}
            >
              方案 {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-5 px-6 py-5">
        <div className="col-span-4 space-y-4">
          <section className="rounded-[6px] border-2 border-slate-700/70 bg-slate-900/40 overflow-hidden">
            <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700/60 flex items-center gap-2">
              <FileSpreadsheet size={14} style={{ color: schemeConf.main }} />
              <h3 className="font-mono text-[12px] tracking-[0.18em] text-slate-200">导出配置</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="font-mono text-[10.5px] text-slate-500 tracking-[0.18em] mb-2">导出范围</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ['records', '比选记录', finalRecords.length],
                    ['anomalies', '异常队列', finalAnomalies.length],
                    ['both', '两者都要', finalRecords.length + finalAnomalies.length]
                  ] as const).map(([v, label, n]) => (
                    <button
                      key={v}
                      onClick={() => setExportMode(v as any)}
                      className={
                        'px-2 py-2.5 rounded-[4px] font-mono text-[10.5px] tracking-wider border transition-all ' +
                        (exportMode === v
                          ? 'bg-sky-500/15 border-sky-400/60 text-sky-200 shadow-inner shadow-sky-500/10'
                          : 'bg-slate-900/60 border-slate-700/70 text-slate-400 hover:text-slate-200 hover:border-slate-600')
                      }
                    >
                      <div className="font-bold">{label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{n} 条</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-mono text-[10.5px] text-slate-500 tracking-[0.18em] mb-2">包含状态</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['confirmed', 'pending', 'returned'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setIncludeStatus((p) => ({ ...p, [s]: !p[s] }))}
                      className={
                        'flex items-center justify-center gap-1.5 px-2 py-2 rounded-[4px] font-mono text-[10.5px] border transition-all ' +
                        (includeStatus[s]
                          ? STATUS_LABEL[s].bg + ' ' + STATUS_LABEL[s].border + ' ' + STATUS_LABEL[s].color
                          : 'bg-slate-900/60 border-slate-700/70 text-slate-600')
                      }
                    >
                      {includeStatus[s] ? <CheckSquare size={11} /> : <Square size={11} />}
                      {STATUS_LABEL[s].text}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-mono text-[10.5px] text-slate-500 tracking-[0.18em] mb-2">包含异常类型</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['collision_duplicate', 'remark_conflict', 'remark_missing'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setIncludeAnomaly((p) => ({ ...p, [t]: !p[t] }))}
                      className={
                        'flex items-center justify-center gap-1.5 px-2 py-2 rounded-[4px] font-mono text-[9.5px] border transition-all ' +
                        (includeAnomaly[t]
                          ? 'text-white'
                          : 'bg-slate-900/60 border-slate-700/70 text-slate-600')
                      }
                      style={includeAnomaly[t] ? { background: ANOMALY_LABEL[t].color.replace('/90', '/30'), borderColor: ANOMALY_LABEL[t].color.replace('/90', '/80') } : {}}
                    >
                      {includeAnomaly[t] ? <CheckSquare size={11} /> : <Square size={11} />}
                      <span className="truncate">{ANOMALY_LABEL[t].text}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-[4px] bg-slate-800/40 border border-slate-700/70">
                <div>
                  <p className="font-mono text-[11px] text-slate-300 font-semibold">导出前字段对齐检查</p>
                  <p className="font-mono text-[9.5px] text-slate-500 mt-0.5">确保状态/备注/结论三列一致</p>
                </div>
                <button
                  onClick={() => setAlignCheck(!alignCheck)}
                  className={
                    'relative w-11 h-6 rounded-full border-2 transition-all ' +
                    (alignCheck ? 'bg-emerald-500/25 border-emerald-400/70' : 'bg-slate-700 border-slate-600')
                  }
                >
                  <div
                    className={
                      'absolute top-0.5 w-4 h-4 rounded-full transition-all ' +
                      (alignCheck ? 'left-6 bg-emerald-300' : 'left-0.5 bg-slate-400')
                    }
                  />
                </button>
              </div>

              <button
                onClick={doExport}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[5px] font-mono text-[12px] tracking-[0.18em] bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-white shadow-lg shadow-emerald-900/40 border border-emerald-300/50 transition-all active:scale-[0.98]"
              >
                <Download size={15} /> 一键生成 CSV（带 BOM 兼容 Excel）
              </button>
            </div>
          </section>

          <section className={'rounded-[6px] border-2 overflow-hidden ' + (alignmentIssues.length > 0 ? 'border-amber-500/60 bg-amber-500/5' : 'border-emerald-500/50 bg-emerald-500/5')}>
            <div className={'px-4 py-3 border-b flex items-center gap-2 ' + (alignmentIssues.length > 0 ? 'border-amber-500/40 bg-amber-500/10' : 'border-emerald-500/40 bg-emerald-500/10')}>
              {alignmentIssues.length > 0 ? <AlertTriangle size={14} className="text-amber-300" /> : <CheckCircle2 size={14} className="text-emerald-300" />}
              <h3 className={'font-mono text-[12px] tracking-[0.18em] ' + (alignmentIssues.length > 0 ? 'text-amber-200' : 'text-emerald-200')}>
                {alignmentIssues.length > 0 ? `对齐检查 · 发现 ${alignmentIssues.length} 处不一致` : '对齐检查 · 全部通过'}
              </h3>
            </div>
            <div className="p-3 space-y-2 max-h-[260px] overflow-auto">
              {alignmentIssues.length === 0 ? (
                <p className="font-mono text-[11px] text-emerald-300 leading-relaxed">✓ 状态 ↔ 备注 ↔ 文件结论三列全部对应</p>
              ) : alignmentIssues.map((i, idx) => (
                <div key={idx} className="flex items-start gap-2 font-mono text-[10.5px] text-amber-200 leading-relaxed">
                  <ArrowRight size={11} className="mt-0.5 flex-shrink-0 text-amber-400" />
                  <span>{i}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="col-span-8 space-y-4">
          {(['records', 'anomalies'] as const).map((mode) => {
            if (mode === 'records' && exportMode === 'anomalies') return null;
            if (mode === 'anomalies' && exportMode === 'records') return null;
            const headers = mode === 'records'
              ? ['编号', '分区', '方案', '状态', 'BIM原备注', '后补备注', '口头说明', '口径', '文件结论']
              : ['编号', '类型', '分区', '方案', '记录状态', '描述', '重复', '解决', '文件结论'];
            const data = mode === 'records' ? finalRecords : finalAnomalies;
            const title = mode === 'records' ? `比选记录预览（${finalRecords.length} 条）` : `异常队列预览（${finalAnomalies.length} 条）`;
            return (
              <section key={mode} className="rounded-[6px] border-2 border-slate-700/70 bg-slate-900/40 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700/60 flex items-center justify-between">
                  <h3 className="font-mono text-[12px] tracking-[0.18em] text-slate-200">{title}</h3>
                  <Link to={mode === 'records' ? '/' : '/anomaly'} className="flex items-center gap-1 font-mono text-[10px] text-slate-500 hover:text-sky-300 transition">
                    <Eye size={11} /> 跳转到 {mode === 'records' ? '主页' : '异常页'}
                  </Link>
                </div>
                <div className="overflow-x-auto max-h-[400px]" style={{ scrollbarWidth: 'thin' }}>
                  <table className="w-full font-mono text-[10.5px] min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-900/90 border-b-2 border-slate-700/80 text-slate-400 sticky top-0">
                        {headers.map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left tracking-[0.15em] text-[10px] whitespace-nowrap border-r border-slate-800 last:border-r-0">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.length === 0 ? (
                        <tr>
                          <td colSpan={headers.length} className="px-4 py-10 text-center text-slate-500">
                            当前筛选条件下无数据
                          </td>
                        </tr>
                      ) : data.slice(0, 12).map((row: any, i) => {
                        if (mode === 'records') {
                          const z = zones.find((x) => x.id === row.zoneId);
                          return (
                            <tr key={row.id} className={'border-b border-slate-800/70 ' + (i % 2 ? 'bg-slate-900/20' : '')}>
                              <td className="px-3 py-2 font-bold" style={{ color: schemeConf.main }}>{row.id}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{row.zoneId} <span className="text-slate-500 text-[10px]">{z?.name}</span></td>
                              <td className="px-3 py-2" style={{ color: SCHEME_COLORS[row.schemeId as keyof typeof SCHEME_COLORS].main }}>方案{row.schemeId}</td>
                              <td className="px-3 py-2">
                                <span className={'px-1.5 py-0.5 rounded-[2px] text-[9.5px] border ' + STATUS_LABEL[row.status as RecordStatus].bg + ' ' + STATUS_LABEL[row.status as RecordStatus].border + ' ' + STATUS_LABEL[row.status as RecordStatus].color}>
                                  {STATUS_LABEL[row.status as RecordStatus].text}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-300 max-w-[160px] truncate" title={row.remarks.bimOriginal ?? ''}>{row.remarks.bimOriginal ?? <span className="text-amber-400">缺失</span>}</td>
                              <td className="px-3 py-2 text-slate-300 max-w-[160px] truncate" title={row.remarks.supplementary ?? ''}>{row.remarks.supplementary ?? <span className="text-amber-400">缺失</span>}</td>
                              <td className="px-3 py-2 text-slate-300 max-w-[160px] truncate" title={row.remarks.verbal ?? ''}>{row.remarks.verbal ?? <span className="text-amber-400">缺失</span>}</td>
                              <td className="px-3 py-2">
                                <span className={'font-bold ' + (row.remarks.hasConflict ? 'text-rose-300' : 'text-emerald-300')}>
                                  {row.remarks.hasConflict ? '✗ 不一致' : '✓ 一致'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-300 max-w-[220px] truncate" title={row.fileConclusion}>{row.fileConclusion}</td>
                            </tr>
                          );
                        } else {
                          const r = records.find((x) => x.zoneId === row.zoneId && x.schemeId === row.schemeId);
                          return (
                            <tr key={row.id} className={'border-b border-slate-800/70 ' + (i % 2 ? 'bg-slate-900/20' : '')}>
                              <td className="px-3 py-2 font-bold" style={{ color: SCHEME_COLORS[row.schemeId as keyof typeof SCHEME_COLORS].main }}>{row.id}</td>
                              <td className="px-3 py-2">
                                <span className="px-1.5 py-0.5 rounded-[2px] text-white text-[9.5px]" style={{ background: ANOMALY_LABEL[row.type as AnomalyType].color }}>
                                  {ANOMALY_LABEL[row.type as AnomalyType].text}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-200">{row.zoneId}</td>
                              <td className="px-3 py-2" style={{ color: SCHEME_COLORS[row.schemeId as keyof typeof SCHEME_COLORS].main }}>方案{row.schemeId}</td>
                              <td className="px-3 py-2">
                                {r ? (
                                  <span className={'px-1.5 py-0.5 rounded-[2px] text-[9.5px] border ' + STATUS_LABEL[r.status].bg + ' ' + STATUS_LABEL[r.status].border + ' ' + STATUS_LABEL[r.status].color}>
                                    {STATUS_LABEL[r.status].text}
                                  </span>
                                ) : <span className="text-slate-600">无</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-300 max-w-[260px] truncate" title={row.description}>{row.description}</td>
                              <td className="px-3 py-2 text-rose-300 font-bold">{row.duplicateCount ?? 1}</td>
                              <td className="px-3 py-2">
                                {row.resolved ? <span className="text-emerald-300">✓</span> : <span className="text-rose-300">✗</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-300 max-w-[220px] truncate" title={r?.fileConclusion}>{r?.fileConclusion ?? <span className="text-slate-600">—</span>}</td>
                            </tr>
                          );
                        }
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

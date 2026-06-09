import { useMemo, useState } from 'react';
import { AlertTriangle, AlertOctagon, AlertCircle, MapPin, CheckSquare, Square, Download, Filter, ChevronDown, ChevronUp, Eye, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useReviewStore, getFilteredAnomalies } from '../store/reviewStore';
import { SCHEME_COLORS, STATUS_LABEL, ANOMALY_LABEL } from '../data/mockData';
import type { AnomalyItem } from '../types';

const TYPE_ICON = {
  collision_duplicate: AlertTriangle,
  remark_conflict: AlertOctagon,
  remark_missing: AlertCircle
};

export default function AnomalyPage() {
  const {
    zones,
    records,
    activeScheme,
    resolveAnomaly,
    selectZone,
    setActiveScheme
  } = useReviewStore();

  const anomalies = useMemo(() => getFilteredAnomalies(), [activeScheme, useReviewStore.getState().anomalyFilter, useReviewStore.getState().statusFilter, useReviewStore.getState().anomalies, useReviewStore.getState().records]);
  const schemeConf = SCHEME_COLORS[activeScheme];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'type' | 'zone' | 'time'>('time');

  const sorted = useMemo(() => {
    const arr = [...anomalies];
    if (sortBy === 'type') arr.sort((a, b) => a.type.localeCompare(b.type));
    if (sortBy === 'zone') arr.sort((a, b) => a.zoneId.localeCompare(b.zoneId));
    if (sortBy === 'time') arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return arr;
  }, [anomalies, sortBy]);

  const stats = useMemo(() => ({
    total: anomalies.length,
    collision: anomalies.filter((a) => a.type === 'collision_duplicate').length,
    conflict: anomalies.filter((a) => a.type === 'remark_conflict').length,
    missing: anomalies.filter((a) => a.type === 'remark_missing').length,
    resolved: anomalies.filter((a) => a.resolved).length,
    duplicatesTotal: anomalies.reduce((s, a) => s + (a.duplicateCount ?? 1), 0)
  }), [anomalies]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function locateIn3D(item: AnomalyItem) {
    if (item.schemeId !== activeScheme) setActiveScheme(item.schemeId);
    selectZone(item.zoneId);
  }

  function exportSelectedCSV() {
    const rows = Array.from(selected).length > 0 ? anomalies.filter((a) => selected.has(a.id)) : anomalies;
    const headers = ['异常编号', '类型', '分区', '方案', '状态', '描述', '明细', '重复次数', '创建时间', '是否已解决', '关联记录状态', '文件结论'];
    const csv = [
      headers.join(','),
      ...rows.map((a) => {
        const rec = records.find((r) => r.zoneId === a.zoneId && r.schemeId === a.schemeId);
        return [
          a.id,
          ANOMALY_LABEL[a.type].text,
          a.zoneId,
          '方案' + a.schemeId,
          rec ? STATUS_LABEL[rec.status].text : '未记录',
          `"${a.description.replace(/"/g, '""')}"`,
          `"${a.detail.replace(/"/g, '""')}"`,
          a.duplicateCount ?? 1,
          new Date(a.createdAt).toLocaleString('zh-CN'),
          a.resolved ? '是' : '否',
          rec ? STATUS_LABEL[rec.status].text : '未记录',
          rec ? `"${rec.fileConclusion.replace(/"/g, '""')}"` : ''
        ].join(',');
      })
    ].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `消防分区异常队列-${activeScheme}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col bg-[#111927]">
      <div className="flex items-stretch border-b-2 border-slate-700/70 bg-gradient-to-r from-[#17202E] to-[#131B27]">
        <div className="flex-1 px-6 py-4 flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-[6px] flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, ${schemeConf.main}55, ${schemeConf.main}22)`, border: `2px solid ${schemeConf.main}` }}
            >
              <AlertOctagon size={22} style={{ color: schemeConf.main }} />
            </div>
            <div>
              <h2 className="font-mono text-[16px] tracking-[0.15em] text-slate-100 font-bold">异常队列 · 脏数据明细</h2>
              <p className="font-mono text-[10.5px] text-slate-500 mt-0.5">
                方案 {activeScheme} · {SCHEME_COLORS[activeScheme].label} · 共 {stats.total} 项异常，碰撞点累计重复 {stats.duplicatesTotal} 次（而不是只给总数！）
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 border-l border-slate-700/60">
          {[
            ['collision', stats.collision, '碰撞点重复', 'rose'],
            ['conflict', stats.conflict, '口径不一致', 'orange'],
            ['missing', stats.missing, '备注缺失', 'yellow']
          ].map(([k, v, label, c]) => (
            <div
              key={k as string}
              className={
                'px-3.5 py-2 rounded-[5px] border-2 ' +
                (c === 'rose' ? 'bg-rose-500/10 border-rose-500/40'
                 : c === 'orange' ? 'bg-orange-500/10 border-orange-500/40'
                 : 'bg-yellow-500/10 border-yellow-500/40')
              }
            >
              <div className="font-mono text-[20px] font-bold leading-none" style={{
                color: c === 'rose' ? '#FDA4AF' : c === 'orange' ? '#FDBA74' : '#FDE68A'
              }}>{v}</div>
              <div className={'font-mono text-[10px] tracking-wider mt-0.5 ' +
                (c === 'rose' ? 'text-rose-300' : c === 'orange' ? 'text-orange-300' : 'text-yellow-300')}>{label}</div>
            </div>
          ))}
          <div className="px-3.5 py-2 rounded-[5px] border-2 bg-emerald-500/10 border-emerald-500/40">
            <div className="font-mono text-[20px] font-bold leading-none text-emerald-300">{stats.resolved}</div>
            <div className="font-mono text-[10px] tracking-wider mt-0.5 text-emerald-300">已解决</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700/60 bg-[#151E2C]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelected(anomalies.length === selected.size ? new Set() : new Set(anomalies.map((a) => a.id)))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[11px] tracking-wider bg-slate-800/60 border border-slate-600/60 text-slate-300 hover:bg-slate-700/70 transition"
          >
            {anomalies.length > 0 && selected.size === anomalies.length ? <CheckSquare size={12} /> : <Square size={12} />}
            全选 ({selected.size}/{anomalies.length})
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-slate-800/40 border border-slate-700/60">
            <Filter size={11} className="text-slate-500" />
            <span className="font-mono text-[10.5px] text-slate-400 tracking-wider">排序：</span>
            {(['time', 'zone', 'type'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={
                  'px-2 py-0.5 rounded-[2px] font-mono text-[10px] tracking-wider transition ' +
                  (sortBy === s ? 'bg-sky-500/20 text-sky-200 border border-sky-400/50' : 'text-slate-500 hover:text-slate-300')
                }
              >
                {s === 'time' ? '按时间' : s === 'zone' ? '按分区' : '按类型'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[4px] font-mono text-[11px] tracking-wider bg-slate-800/60 border border-slate-600/60 text-slate-300 hover:text-sky-300 hover:border-sky-400/50 transition"
          >
            <Eye size={12} /> 回到 3D 视图
          </Link>
          <button
            onClick={exportSelectedCSV}
            disabled={selected.size === 0 && anomalies.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] font-mono text-[11px] tracking-wider bg-emerald-600/85 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white border border-emerald-400/60 shadow-lg shadow-emerald-900/40 transition"
          >
            <Download size={12} /> {selected.size > 0 ? `导出已选 (${selected.size})` : '导出全部 CSV'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4" style={{ scrollbarWidth: 'thin' }}>
        <div className="rounded-[6px] border-2 border-slate-700/60 overflow-hidden bg-slate-950/30">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="bg-slate-900/80 border-b-2 border-slate-700/80 text-slate-400">
                <th className="w-10 px-3 py-3 text-left">
                  <Square size={12} />
                </th>
                <th className="w-24 px-3 py-3 text-left tracking-[0.15em] text-[10px]">编号</th>
                <th className="w-28 px-3 py-3 text-left tracking-[0.15em] text-[10px]">异常类型</th>
                <th className="w-24 px-3 py-3 text-left tracking-[0.15em] text-[10px]">分区 / 方案</th>
                <th className="px-3 py-3 text-left tracking-[0.15em] text-[10px]">描述 & 明细</th>
                <th className="w-24 px-3 py-3 text-left tracking-[0.15em] text-[10px]">记录状态</th>
                <th className="w-28 px-3 py-3 text-left tracking-[0.15em] text-[10px]">创建时间</th>
                <th className="w-44 px-3 py-3 text-center tracking-[0.15em] text-[10px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="inline-flex flex-col items-center gap-3">
                      <CheckCircle2 size={36} className="text-emerald-400/60" />
                      <p className="font-mono text-[13px] text-slate-400 tracking-wider">当前筛选下未发现异常 · 干净</p>
                      <p className="font-mono text-[10.5px] text-slate-600">切换方案或调整筛选条件继续检查</p>
                    </div>
                  </td>
                </tr>
              ) : sorted.map((a, idx) => {
                const Icon = TYPE_ICON[a.type];
                const zone = zones.find((z) => z.id === a.zoneId);
                const rec = records.find((r) => r.zoneId === a.zoneId && r.schemeId === a.schemeId);
                const isExp = !!expanded[a.id];
                const isSel = selected.has(a.id);
                return (
                  <>
                    <tr
                      key={a.id}
                      className={
                        'border-b border-slate-800/70 transition-colors ' +
                        (idx % 2 ? 'bg-slate-900/20' : '') +
                        (isSel ? ' !bg-sky-500/8' : '') +
                        (a.resolved ? ' opacity-70' : '')
                      }
                    >
                      <td className="px-3 py-3 align-top">
                        <button onClick={() => toggleSelect(a.id)}>
                          {isSel ? <CheckSquare size={13} className="text-sky-400" /> : <Square size={13} className="text-slate-600 hover:text-slate-400" />}
                        </button>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="font-bold tracking-wider" style={{ color: SCHEME_COLORS[a.schemeId].main }}>{a.id}</span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-white text-[10px] tracking-wider" style={{ background: ANOMALY_LABEL[a.type].color }}>
                          <Icon size={11} />
                          <span className="font-bold">{ANOMALY_LABEL[a.type].text}</span>
                          {a.type === 'collision_duplicate' && a.duplicateCount && a.duplicateCount > 1 && (
                            <span className="ml-0.5 px-1 py-0.5 rounded bg-black/30 text-[9px]">×{a.duplicateCount}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top space-y-1">
                        <div>
                          <span className="font-bold text-slate-200">{a.zoneId}</span>
                          <span className="text-slate-500 ml-1 text-[10px]">F{zone?.floor ?? '?'}层</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{zone?.name}</div>
                        <div>
                          <span
                            className="px-1.5 py-0.5 rounded-[2px] text-[9.5px] tracking-wider"
                            style={{ background: SCHEME_COLORS[a.schemeId].main + '22', color: SCHEME_COLORS[a.schemeId].main, border: `1px solid ${SCHEME_COLORS[a.schemeId].main}66` }}
                          >
                            方案 {a.schemeId}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top max-w-sm">
                        <p className="text-slate-200 font-semibold leading-relaxed">{a.description}</p>
                        <button
                          onClick={() => setExpanded((prev) => ({ ...prev, [a.id]: !prev[a.id] }))}
                          className="mt-1.5 flex items-center gap-1 text-[10.5px] text-slate-400 hover:text-slate-200 transition"
                        >
                          {isExp ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          {isExp ? '收起明细' : '查看明细（指出具体脏数据）'}
                        </button>
                        {isExp && (
                          <div className="mt-2 p-2.5 rounded-[4px] bg-rose-500/5 border border-rose-500/40 border-dashed space-y-1.5">
                            <p className="text-[10.5px] text-rose-200 leading-relaxed whitespace-pre-wrap">{a.detail}</p>
                            {rec && (
                              <div className="mt-2 pt-2 border-t border-rose-500/30">
                                <p className="text-[10px] text-slate-400 mb-0.5">文件结论（用于导出对照）：</p>
                                <p className="text-[10.5px] text-slate-300 leading-relaxed">{rec.fileConclusion}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {rec ? (
                          <span className={'inline-block px-2 py-1 rounded-[3px] border text-[10px] tracking-wider ' + STATUS_LABEL[rec.status].bg + ' ' + STATUS_LABEL[rec.status].border + ' ' + STATUS_LABEL[rec.status].color}>
                            {STATUS_LABEL[rec.status].text}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">未记录</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-slate-400 text-[10.5px] whitespace-nowrap">
                        <div>{new Date(a.createdAt).toLocaleDateString('zh-CN')}</div>
                        <div className="text-[9.5px] text-slate-600">{new Date(a.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            to="/"
                            onClick={() => locateIn3D(a)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] text-[10.5px] tracking-wider bg-sky-500/15 border border-sky-400/50 text-sky-200 hover:bg-sky-500/25 transition"
                          >
                            <MapPin size={11} /> 定位 3D
                          </Link>
                          <button
                            onClick={() => resolveAnomaly(a.id, !a.resolved)}
                            className={
                              'flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] text-[10.5px] tracking-wider border transition ' +
                              (a.resolved
                                ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/25'
                                : 'bg-slate-800/60 border-slate-600/60 text-slate-400 hover:text-emerald-300 hover:border-emerald-400/50')
                            }
                          >
                            <CheckCircle2 size={11} /> {a.resolved ? '已解决' : '标记解决'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

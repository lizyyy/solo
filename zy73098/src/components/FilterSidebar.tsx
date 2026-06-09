import { useMemo } from 'react';
import { Search, SlidersHorizontal, X, MapPin } from 'lucide-react';
import { useReviewStore, getFilteredRecords, getFilteredAnomalies } from '../store/reviewStore';
import { SCHEME_COLORS, STATUS_LABEL, ANOMALY_LABEL } from '../data/mockData';
import type { RecordStatus, AnomalyType } from '../types';

export default function FilterSidebar() {
  const {
    zones,
    activeScheme,
    selectedZoneId,
    selectZone,
    statusFilter,
    setStatusFilter,
    anomalyFilter,
    setAnomalyFilter,
    searchKeyword,
    setSearchKeyword
  } = useReviewStore();

  const records = useMemo(() => getFilteredRecords(), [activeScheme, statusFilter, searchKeyword, selectedZoneId, useReviewStore.getState().records]);
  const anomalies = useMemo(() => getFilteredAnomalies(), [activeScheme, anomalyFilter, statusFilter, useReviewStore.getState().anomalies, useReviewStore.getState().records]);
  const schemeConf = SCHEME_COLORS[activeScheme];

  return (
    <aside className="flex-shrink-0 w-[300px] border-r-2 border-slate-700/70 bg-[#141C2A] flex flex-col">
      <div className="p-3 border-b border-slate-700/60 space-y-2.5">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="搜索分区 / 备注 / 结论..."
            className="w-full pl-8 pr-7 py-2 rounded-[4px] bg-slate-900/60 border border-slate-600/60 font-mono text-[11.5px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-sky-400/70 focus:ring-1 focus:ring-sky-400/40"
          />
          {searchKeyword && (
            <button onClick={() => setSearchKeyword('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X size={12} />
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <SlidersHorizontal size={11} className="text-slate-500" />
            <span className="font-mono text-[10.5px] tracking-[0.2em] text-slate-500">状态筛选</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ['all', '全部'],
              ['confirmed', STATUS_LABEL.confirmed.text],
              ['pending', STATUS_LABEL.pending.text],
              ['returned', STATUS_LABEL.returned.text]
            ] as const).map(([v, label]) => {
              const active = statusFilter === v;
              return (
                <button
                  key={v}
                  onClick={() => setStatusFilter(v as RecordStatus | 'all')}
                  className={
                    'px-2 py-1.5 rounded-[3px] font-mono text-[10.5px] tracking-wider border transition-all ' +
                    (active
                      ? v === 'all'
                        ? 'bg-slate-600/60 border-slate-400/70 text-white'
                        : STATUS_LABEL[v as RecordStatus].bg + ' ' + STATUS_LABEL[v as RecordStatus].border + ' ' + STATUS_LABEL[v as RecordStatus].color
                      : 'bg-slate-900/40 border-slate-700/60 text-slate-500 hover:text-slate-300 hover:border-slate-600')
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <SlidersHorizontal size={11} className="text-slate-500" />
            <span className="font-mono text-[10.5px] tracking-[0.2em] text-slate-500">异常类型</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ['all', '全部异常'],
              ['collision_duplicate', ANOMALY_LABEL.collision_duplicate.text],
              ['remark_conflict', ANOMALY_LABEL.remark_conflict.text],
              ['remark_missing', ANOMALY_LABEL.remark_missing.text]
            ] as const).map(([v, label]) => {
              const active = anomalyFilter === v;
              return (
                <button
                  key={v}
                  onClick={() => setAnomalyFilter(v as AnomalyType | 'all')}
                  className={
                    'px-2 py-1.5 rounded-[3px] font-mono text-[10px] tracking-wide border transition-all ' +
                    (active
                      ? v === 'all'
                        ? 'bg-slate-600/60 border-slate-400/70 text-white'
                        : 'bg-slate-800/80 border-slate-400/70 text-white'
                      : 'bg-slate-900/40 border-slate-700/60 text-slate-500 hover:text-slate-300 hover:border-slate-600')
                  }
                  style={active && v !== 'all' ? { background: `${ANOMALY_LABEL[v as AnomalyType].color.replace('/90', '/25')}`, borderColor: ANOMALY_LABEL[v as AnomalyType].color.replace('/90', '/80') } : {}}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 pb-2 border-b border-slate-700/60">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10.5px] tracking-[0.2em] text-slate-500">分区清单</span>
          <span className="font-mono text-[10px] text-slate-500">{records.length} 条记录 · {anomalies.length} 项异常</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1.5" style={{ scrollbarWidth: 'thin' }}>
        {zones.map((z) => {
          const zRecs = records.filter((r) => r.zoneId === z.id);
          const zAnoms = anomalies.filter((a) => a.zoneId === z.id);
          const hasRecord = zRecs.length > 0;
          const rec = zRecs[0];
          const selected = selectedZoneId === z.id;
          return (
            <button
              key={z.id}
              onClick={() => selectZone(selected ? null : z.id)}
              className={
                'w-full text-left rounded-[4px] border-2 p-2.5 transition-all group ' +
                (selected
                  ? 'shadow-lg'
                  : 'border-slate-700/60 bg-slate-900/30 hover:bg-slate-800/50 hover:border-slate-600')
              }
              style={selected ? { borderColor: schemeConf.main, background: schemeConf.main + '12', boxShadow: `0 0 16px ${schemeConf.glow}` } : {}}
            >
              <div className="flex items-start gap-2">
                <div
                  className="w-10 h-10 rounded-[3px] border flex-shrink-0 flex items-center justify-center font-mono text-[11px] font-bold"
                  style={{
                    background: z.color[activeScheme] + '22',
                    borderColor: z.color[activeScheme] + '77',
                    color: z.color[activeScheme]
                  }}
                >
                  F{z.floor}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[12px] font-bold text-slate-100 tracking-wider">{z.id}</span>
                    {hasRecord && rec && (
                      <span className={'px-1.5 py-px rounded-[2px] font-mono text-[9px] border ' + STATUS_LABEL[rec.status].bg + ' ' + STATUS_LABEL[rec.status].border + ' ' + STATUS_LABEL[rec.status].color}>
                        {STATUS_LABEL[rec.status].text}
                      </span>
                    )}
                    {!hasRecord && (
                      <span className="px-1.5 py-px rounded-[2px] font-mono text-[9px] bg-slate-700/60 border border-slate-600/70 text-slate-400">未记录</span>
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-slate-400 mt-0.5 truncate">{z.name}</p>
                  {zAnoms.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {zAnoms.slice(0, 3).map((a) => (
                        <span key={a.id} className={'px-1.5 py-px rounded-[2px] text-[9px] font-mono text-white ' + ANOMALY_LABEL[a.type].color}>
                          {ANOMALY_LABEL[a.type].text}
                          {a.type === 'collision_duplicate' && a.duplicateCount ? `×${a.duplicateCount}` : ''}
                        </span>
                      ))}
                      {zAnoms.length > 3 && (
                        <span className="text-[9px] font-mono text-slate-500">+{zAnoms.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="font-mono text-[9.5px] text-slate-500 truncate pr-1">
                      {rec?.remarks.bimOriginal?.slice(0, 30) ?? '暂无 BIM 备注'}
                      {rec?.remarks.bimOriginal && rec.remarks.bimOriginal.length > 30 ? '...' : ''}
                    </p>
                    <MapPin
                      size={11}
                      className={
                        'flex-shrink-0 transition-colors ' +
                        (selected ? 'text-rose-400' : 'text-slate-600 group-hover:text-slate-400')
                      }
                    />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-slate-700/60 space-y-1.5 bg-slate-900/40">
        <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
          <span>方案 {activeScheme} · 分区</span>
          <span style={{ color: schemeConf.main }}>{zones.length} 个</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
          <span>异常队列</span>
          <span className="text-rose-300">{anomalies.length} 项</span>
        </div>
        <div className="h-1 rounded-full bg-slate-800 overflow-hidden mt-1">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${zones.length ? (records.length / zones.length) * 100 : 0}%`,
              background: `linear-gradient(90deg, ${schemeConf.main}, ${SCHEME_COLORS[(activeScheme === 'C' ? 'A' : 'C')].main})`
            }}
          />
        </div>
      </div>
    </aside>
  );
}

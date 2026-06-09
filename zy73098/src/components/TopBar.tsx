import { useMemo } from 'react';
import { Layers, CalendarDays, Target, Filter, Download, AlertOctagon, RotateCcw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useReviewStore, getStatusCounts } from '../store/reviewStore';
import { SCHEME_COLORS } from '../data/mockData';
import type { SchemeId, RecordStatus } from '../types';

export default function TopBar() {
  const loc = useLocation();
  const {
    activeScheme,
    setActiveScheme,
    zones,
    timeline,
    timelineIndex,
    setTimelineIndex,
    resetDemo
  } = useReviewStore();

  const counts = useMemo(() => getStatusCounts(), [activeScheme, useReviewStore.getState().records]);
  const today = new Date().toLocaleDateString('zh-CN');
  const currentNode = timeline[timelineIndex];

  return (
    <header className="flex-shrink-0 border-b-2 border-slate-700/70 bg-gradient-to-b from-[#17202E] via-[#161F2C] to-[#121A27]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[5px] bg-gradient-to-br from-rose-500 via-orange-400 to-amber-300 flex items-center justify-center shadow-lg shadow-rose-900/50">
              <Layers size={18} className="text-slate-900" />
            </div>
            <div>
              <h1 className="font-mono text-[15px] tracking-[0.18em] text-slate-100 font-bold leading-none">
                FIRE-ZONE · 消防分区方案比选
              </h1>
              <p className="font-mono text-[10.5px] text-slate-500 mt-1 tracking-wider">
                项目编号：XF-2026-017 · 建筑师：小赵 · 版本：Rev.04
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-600/60 mx-2" />

          <div className="flex items-center gap-3">
            <CalendarDays size={13} className="text-slate-500" />
            <span className="font-mono text-[11.5px] text-slate-400 tracking-wider">{today}</span>
            <span className="font-mono text-[10px] text-slate-600">/</span>
            <Target size={12} className="text-slate-500" />
            <span className="font-mono text-[11.5px] text-slate-400 tracking-wider">
              当前版本：{currentNode.date} · {currentNode.label}
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1.5">
          {([
            { to: '/', label: 'Web3D 比选主页' },
            { to: '/anomaly', label: '异常队列' },
            { to: '/export', label: '导出中心' }
          ] as const).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={
                'px-3 py-1.5 rounded-[4px] font-mono text-[11px] tracking-wider border-2 transition-all ' +
                (loc.pathname === n.to
                  ? 'bg-sky-500/15 border-sky-400/60 text-sky-200 shadow-inner shadow-sky-500/20'
                  : 'bg-slate-800/40 border-slate-600/60 text-slate-400 hover:text-slate-200 hover:border-slate-500/80 hover:bg-slate-800/80')
              }
            >
              {n.label}
            </Link>
          ))}
          <div className="w-px h-6 bg-slate-600/60 mx-1.5" />
          <button
            onClick={resetDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-mono text-[11px] tracking-wider bg-slate-800/40 border-2 border-slate-600/60 text-slate-400 hover:text-amber-200 hover:border-amber-400/60 hover:bg-amber-500/10 transition-all"
            title="重置为演示初始状态"
          >
            <RotateCcw size={12} /> 重置演示
          </button>
          <Link
            to="/export"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] font-mono text-[11px] tracking-wider bg-emerald-600/85 hover:bg-emerald-500 text-white border-2 border-emerald-400/70 shadow-lg shadow-emerald-900/40 transition-all"
          >
            <Download size={12} /> 导出 CSV
          </Link>
        </nav>
      </div>

      <div className="flex items-stretch border-b border-slate-700/50">
        <div className="flex items-center gap-1 px-5 py-2.5 border-r border-slate-700/60">
          <span className="font-mono text-[10.5px] text-slate-500 tracking-widest mr-2">方案比选</span>
          {(['A', 'B', 'C'] as SchemeId[]).map((s) => {
            const active = activeScheme === s;
            const conf = SCHEME_COLORS[s];
            return (
              <button
                key={s}
                onClick={() => setActiveScheme(s)}
                className={
                  'relative px-4 py-1.5 rounded-[3px] font-mono text-[11.5px] tracking-[0.2em] border-2 transition-all ' +
                  (active
                    ? 'text-white shadow-lg'
                    : 'bg-slate-900/40 border-slate-600/60 text-slate-400 hover:border-slate-500 hover:text-slate-200')
                }
                style={active ? { background: conf.main + '22', borderColor: conf.main, color: conf.main, boxShadow: `0 0 20px ${conf.glow}, inset 0 0 12px ${conf.glow}` } : {}}
              >
                <span className="font-bold mr-1.5">方案 {s}</span>
                <span className="text-[10px] opacity-80 tracking-wider">{SCHEME_COLORS[s].label.split(' · ')[1]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 px-5 py-2.5 flex items-center gap-4">
          <span className="font-mono text-[10.5px] text-slate-500 tracking-widest flex-shrink-0">时间轴</span>
          <div className="relative flex-1 h-8 flex items-center">
            <div className="absolute inset-x-0 top-1/2 h-[2px] bg-gradient-to-r from-slate-700 via-slate-500 to-slate-700 rounded-full" />
            <div className="relative w-full flex justify-between px-1">
              {timeline.map((n, i) => {
                const reached = i <= timelineIndex;
                const active = i === timelineIndex;
                return (
                  <button
                    key={n.date + n.label}
                    onClick={() => setTimelineIndex(i)}
                    className="relative group flex flex-col items-center"
                    style={{ transform: `translateY(0)` }}
                  >
                    <div
                      className={
                        'w-3.5 h-3.5 rounded-full border-2 transition-all -mt-[7px] ' +
                        (active
                          ? 'scale-125 shadow-lg'
                          : reached
                          ? ''
                          : 'bg-slate-900 border-slate-600')
                      }
                      style={active || reached ? {
                        background: reached ? SCHEME_COLORS[activeScheme].main : '#1e293b',
                        borderColor: active ? '#FFFFFF' : SCHEME_COLORS[activeScheme].main,
                        boxShadow: active ? `0 0 16px ${SCHEME_COLORS[activeScheme].glow}` : 'none'
                      } : {}}
                    />
                    <div className={'absolute top-5 whitespace-nowrap font-mono text-[10px] transition-all ' + (active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300')}>
                      <div className="tracking-wider">{n.date.slice(5)}</div>
                      <div className={'text-[9.5px] ' + (active ? 'opacity-90' : 'opacity-70')}>{n.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <input
              type="range"
              min={0}
              max={timeline.length - 1}
              value={timelineIndex}
              onChange={(e) => setTimelineIndex(Number(e.target.value))}
              className="absolute inset-x-0 w-full h-8 opacity-0 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 border-l border-slate-700/60">
          {([
            ['confirmed', counts.confirmed, '已确认', 'emerald'],
            ['pending', counts.pending, '待补件', 'amber'],
            ['returned', counts.returned, '退回', 'rose']
          ] as const).map(([k, v, label, c]) => (
            <Link
              key={k}
              to={'/anomaly'}
              onClick={() => useReviewStore.getState().setStatusFilter(k as RecordStatus)}
              className={
                'flex items-center gap-2 px-3 py-1.5 rounded-[4px] border-2 transition-all group hover:scale-[1.03] ' +
                (c === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                 : c === 'amber' ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                 : 'bg-rose-500/10 border-rose-500/40 text-rose-200')
              }
            >
              <span className="font-mono text-[18px] font-bold leading-none">{v}</span>
              <div className="flex flex-col leading-tight">
                <span className="font-mono text-[10px] tracking-wider opacity-90">{label}</span>
                <span className="font-mono text-[9px] opacity-60">点击跳转</span>
              </div>
            </Link>
          ))}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[4px] border-2 border-slate-600/60 bg-slate-800/40">
            <AlertOctagon size={13} className="text-slate-400" />
            <span className="font-mono text-[18px] font-bold leading-none text-slate-300">{counts.total}</span>
            <span className="font-mono text-[10px] tracking-wider text-slate-400">总计{zones.length}分区</span>
          </div>
        </div>
      </div>
    </header>
  );
}

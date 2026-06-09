import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScheduleStore } from '@/store/useScheduleStore';
import AnomalyChart from '@/components/AnomalyChart';
import SensorLogTable from '@/components/SensorLogTable';
import Drawer from '@/components/Drawer';
import { ConclusionBadge, HandoffBadge, StatCard } from '@/components/Badges';
import {
  ChevronRight,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Route,
  ArrowLeftRight,
  FileText,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';

export default function ScheduleList() {
  const { schedules, getLogsBySchedule, getMaterialsBySchedule, getHandoffGroups } =
    useScheduleStore();
  const nav = useNavigate();
  const groups = getHandoffGroups();
  const totalAnomaly = schedules.filter((s) =>
    ['anomaly', 'rejudged_anomaly'].includes(s.conclusion)
  ).length;

  const [filter, setFilter] = useState<'all' | 'anomaly' | 'releasable' | 'missing'>('all');
  const [keyword, setKeyword] = useState('');
  const [openLogFor, setOpenLogFor] = useState<string | null>(null);
  const [highlightLogId, setHighlightLogId] = useState<string | undefined>(undefined);

  const filtered = schedules.filter((s) => {
    if (filter === 'anomaly' && !['anomaly', 'rejudged_anomaly', 'pending'].includes(s.conclusion))
      return false;
    if (filter === 'releasable' && s.handoff !== 'releasable') return false;
    if (filter === 'missing' && s.handoff !== 'missing_material') return false;
    if (keyword) {
      const kw = keyword.toLowerCase();
      if (
        !s.scheduleNo.toLowerCase().includes(kw) &&
        !s.bridgeName.toLowerCase().includes(kw) &&
        !s.bearingCode.toLowerCase().includes(kw) &&
        !s.position.toLowerCase().includes(kw)
      )
        return false;
    }
    return true;
  });

  const handlePointClick = (logId: string) => setHighlightLogId(logId);
  const openLogs = (schId: string) => setOpenLogFor(schId);
  const openDetail = (schId: string) => nav(`/schedules/${schId}`);

  const currentSchedule = openLogFor ? schedules.find((s) => s.id === openLogFor) : null;
  const currentLogs = openLogFor ? getLogsBySchedule(openLogFor) : [];
  const currentMats = openLogFor ? getMaterialsBySchedule(openLogFor) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="总排程数"
          value={schedules.length}
          accent="blue"
          Icon={Activity}
          sub={`含 ${groups.pending.length} 待确认`}
        />
        <StatCard
          label="可放行"
          value={groups.releasable.length}
          accent="emerald"
          Icon={CheckCircle2}
          sub="材料齐全 · 结论通过"
          onClick={() => setFilter('releasable')}
        />
        <StatCard
          label="缺材料待补"
          value={groups.missing.length}
          accent="amber"
          Icon={AlertTriangle}
          sub="需补备件后方可交接"
          onClick={() => setFilter('missing')}
        />
        <StatCard
          label="含异常判读"
          value={totalAnomaly}
          accent="red"
          Icon={Clock}
          sub="点击图表下钻追原始日志"
          onClick={() => setFilter('anomaly')}
        />
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Route size={16} className="text-blue-600" />
              异常保留（均值不掩盖）· 散点时序概览
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              红色/橙色点为异常与断档，独立绘出不会被蓝色均值线抹平；点击散点可直达对应日志行。
            </p>
          </div>
          <div className="text-[11px] text-slate-500 hidden lg:block">
            阈值参考线 = 3.5 mm/MPa
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {schedules.map((sch) => (
            <div
              key={sch.id}
              className="border border-slate-200 rounded-md p-4 bg-slate-50/40 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[12px] font-semibold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    {sch.scheduleNo}
                  </span>
                  <span className="text-[12px] text-slate-600">
                    {sch.bridgeName} · {sch.position}
                  </span>
                  <ConclusionBadge value={sch.conclusion} />
                  <HandoffBadge value={sch.handoff} />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openLogs(sch.id)}
                    className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-white hover:border-blue-300 hover:text-blue-700 transition"
                  >
                    查看日志
                  </button>
                  <button
                    onClick={() => openDetail(sch.id)}
                    className="text-[11px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-0.5"
                  >
                    追明细 <ChevronRight size={12} />
                  </button>
                </div>
              </div>
              <AnomalyChart
                logs={getLogsBySchedule(sch.id)}
                height={220}
                onPointClick={(logId) => {
                  setOpenLogFor(sch.id);
                  setTimeout(() => handlePointClick(logId), 80);
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索编号/桥梁/支座/位置"
                className="pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none w-64"
              />
            </div>
            <div className="flex border border-slate-200 rounded overflow-hidden text-[12px]">
              {[
                { k: 'all', label: '全部' },
                { k: 'anomaly', label: '异常待判' },
                { k: 'releasable', label: '可放行' },
                { k: 'missing', label: '缺材料' },
              ].map((t) => (
                <button
                  key={t.k}
                  onClick={() => setFilter(t.k as any)}
                  className={cn(
                    'px-3 py-1.5 transition-colors',
                    filter === t.k
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => nav('/handoff')}
              className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1"
            >
              <ArrowLeftRight size={13} /> 交接状态
            </button>
            <button
              onClick={() => nav('/handover')}
              className="text-xs px-3 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-900 flex items-center gap-1"
            >
              <FileText size={13} /> 收尾文档
            </button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold border-b border-slate-200">排程编号</th>
                <th className="px-4 py-2.5 text-left font-semibold border-b border-slate-200">桥梁 / 位置</th>
                <th className="px-4 py-2.5 text-left font-semibold border-b border-slate-200">结论</th>
                <th className="px-4 py-2.5 text-left font-semibold border-b border-slate-200">交接</th>
                <th className="px-4 py-2.5 text-left font-semibold border-b border-slate-200">版本</th>
                <th className="px-4 py-2.5 text-left font-semibold border-b border-slate-200">最近更新</th>
                <th className="px-4 py-2.5 text-left font-semibold border-b border-slate-200">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  onClick={() => openDetail(s.id)}
                >
                  <td className="px-4 py-3 font-mono text-[13px] text-slate-800 group-hover:text-blue-700">
                    {s.scheduleNo}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="font-medium">{s.bridgeName}</div>
                    <div className="text-xs text-slate-500">{s.position} · {s.bearingCode}</div>
                  </td>
                  <td className="px-4 py-3"><ConclusionBadge value={s.conclusion} /></td>
                  <td className="px-4 py-3"><HandoffBadge value={s.handoff} /></td>
                  <td className="px-4 py-3 tabular-nums text-xs text-slate-600">v{s.versionCount}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">{formatDateTime(s.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(s.id);
                      }}
                    >
                      追明细 <ChevronRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                    没有匹配的排程
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Drawer
        open={!!openLogFor}
        onClose={() => {
          setOpenLogFor(null);
          setHighlightLogId(undefined);
        }}
        title={
          <span>
            <span className="font-mono">{currentSchedule?.scheduleNo}</span>
            <span className="text-slate-500 text-xs ml-2 font-normal">
              {currentSchedule?.bridgeName} · {currentSchedule?.position} 的传感器日志（{currentLogs.length} 条）
            </span>
          </span>
        }
        widthClass="w-[860px] max-w-[95vw]"
      >
        <div className="p-4">
          <div className="mb-4">
            <AnomalyChart
              logs={currentLogs}
              height={260}
              onPointClick={handlePointClick}
            />
          </div>
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <SensorLogTable
              logs={currentLogs}
              materials={currentMats}
              highlightLogId={highlightLogId}
              onHighlightCleared={() => setHighlightLogId(undefined)}
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}

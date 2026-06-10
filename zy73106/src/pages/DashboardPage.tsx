import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import MetricCard from '@/components/MetricCard';
import StatusBadge from '@/components/StatusBadge';
import {
  Layers, AlertTriangle, RefreshCw, CheckCircle2, Package,
  ChevronRight, FileCheck, Search, ArrowRight,
} from 'lucide-react';
import type { Drawing } from '@/types';

const severityOrder: Record<string, number> = {
  abnormal: 0,
  reviewing: 1,
  normal: 2,
  closed: 3,
};

export default function DashboardPage() {
  const summary = useAppStore(
    useShallow((s) => ({
      total: s.drawings.length,
      abnormal: s.drawings.filter((d) => d.status === 'abnormal').length,
      closed: s.drawings.filter((d) => d.status === 'closed').length,
      reviewing: s.drawings.filter((d) => d.status === 'reviewing').length,
      missingMaterials: s.materials.filter((m) => m.isMissing).length,
    })),
  );
  const drawings = useAppStore((s) => s.drawings);
  const materials = useAppStore((s) => s.materials);
  const navigate = useNavigate();

  const sortedDrawings = useMemo(() => {
    return [...drawings].sort(
      (a, b) => severityOrder[a.status] - severityOrder[b.status],
    );
  }, [drawings]);

  const missingCountForDrawing = (d: Drawing) =>
    materials.filter((m) => m.drawingId === d.id && m.isMissing).length;

  const steps = [
    { n: 1, label: '确认最新图纸版本', done: true },
    { n: 2, label: '检查异常列表', done: false },
    { n: 3, label: '核对缺料项', done: false },
    { n: 4, label: '导出封账报告', done: false },
  ];

  return (
    <div className="min-h-screen animate-blueprint-draw">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <FileCheck className="w-10 h-10 text-[#3498DB]" />
              <div>
                <h1 className="font-display text-3xl font-bold text-steel-100 tracking-tight">
                  日照体量碰撞预审 · 工作台
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="stamp-badge border-[#C0392B] text-[#E74C3C]">
                    BIM PREAUDIT · 2026-JUN
                  </span>
                  <span className="text-xs font-mono text-steel-400">
                    预审周期：2026.06.01 - 2026.06.30
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard
            label="项目总数"
            value={summary.total}
            tone="steel"
            icon={<Layers className="w-8 h-8" />}
          />
          <MetricCard
            label="异常图纸"
            value={summary.abnormal}
            tone="red"
            icon={<AlertTriangle className="w-8 h-8" />}
            hint="点击查看列表"
            onClick={() => navigate('/drawings?status=abnormal')}
          />
          <MetricCard
            label="复核中"
            value={summary.reviewing}
            tone="orange"
            icon={<RefreshCw className="w-8 h-8" />}
          />
          <MetricCard
            label="已闭环"
            value={summary.closed}
            tone="green"
            icon={<CheckCircle2 className="w-8 h-8" />}
          />
          <div className="panel-bordered p-4 border-[#E67E22] bg-[#784212]/30 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-steel-400 mb-2">
                  缺料待补
                </div>
                <div className="text-3xl font-display font-bold animate-number-pop text-[#F39C12]">
                  {summary.missingMaterials}
                </div>
                <div className="text-[10px] font-mono text-steel-500 mt-1">
                  批次记录缺料
                </div>
              </div>
              <Package className="w-8 h-8 opacity-60 text-[#F39C12]" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E67E22]" />
          </div>
        </section>

        <section className="panel-bordered overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b-2 border-steel-600">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#E74C3C]" />
              <h2 className="font-mono text-sm uppercase tracking-wider text-steel-200">
                TOP异常列表 · 按严重程度排序
              </h2>
            </div>
            <Link
              to="/drawings"
              className="flex items-center gap-1 text-xs font-mono text-[#3498DB] hover:text-[#5DADE2] uppercase tracking-wider"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="bg-steel-900/60 text-steel-400 text-xs uppercase tracking-wider">
                  <th className="text-left p-3 pl-6">项目编号</th>
                  <th className="text-left p-3">图纸名</th>
                  <th className="text-left p-3">楼栋</th>
                  <th className="text-left p-3">状态</th>
                  <th className="text-right p-3">碰撞数</th>
                  <th className="text-right p-3">不合格</th>
                  <th className="text-right p-3">缺料数</th>
                  <th className="text-center p-3 pr-6">操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedDrawings.map((d) => {
                  const miss = missingCountForDrawing(d);
                  const isAbn = d.status === 'abnormal';
                  return (
                    <tr
                      key={d.id}
                      className={
                        'zebra-row border-t border-steel-700/50 transition-colors hover:bg-steel-700/40'
                      }
                      style={isAbn ? { borderLeft: '3px solid #C0392B' } : undefined}
                    >
                      <td className="p-3 pl-6 text-steel-200 font-bold whitespace-nowrap">
                        {d.projectNo}
                      </td>
                      <td className="p-3 text-steel-100 font-medium max-w-[240px] truncate">
                        {d.name}
                      </td>
                      <td className="p-3 text-steel-400 whitespace-nowrap">
                        {d.buildingName}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={d.status} size="sm" />
                      </td>
                      <td
                        className={
                          'p-3 text-right font-bold ' +
                          (d.metrics.collisionPoints > 0 ? 'text-[#E74C3C]' : 'text-steel-300')
                        }
                      >
                        {d.metrics.collisionPoints}
                      </td>
                      <td
                        className={
                          'p-3 text-right font-bold ' +
                          (d.metrics.unqualifiedItems > 0 ? 'text-[#E74C3C]' : 'text-steel-300')
                        }
                      >
                        {d.metrics.unqualifiedItems}
                      </td>
                      <td
                        className={
                          'p-3 text-right font-bold ' + (miss > 0 ? 'text-[#F39C12]' : 'text-steel-300')
                        }
                      >
                        {miss}
                      </td>
                      <td className="p-3 text-center pr-6">
                        <Link
                          to={`/drawings/${d.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-mono uppercase border-2 border-steel-500 text-steel-300 hover:bg-steel-600/60 transition-all"
                        >
                          <Search className="w-3 h-3" />
                          详情
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel-bordered p-6 grid-paper">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <h2 className="font-mono text-sm uppercase tracking-wider text-steel-300 mb-4 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#3498DB]" />
                运行预审流程
              </h2>
              <div className="flex items-start gap-1 flex-wrap">
                {steps.map((step, idx) => (
                  <div key={step.n} className="flex items-center flex-1 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div
                        className={
                          'w-8 h-8 flex items-center justify-center border-2 font-mono text-xs font-bold transition-all ' +
                          (step.done
                            ? 'border-[#27AE60] bg-[#186A3B]/40 text-[#2ECC71]'
                            : 'border-steel-500 bg-steel-800 text-steel-400')
                        }
                      >
                        {step.done ? <CheckCircle2 className="w-4 h-4" /> : step.n}
                      </div>
                      <span
                        className={
                          'text-xs font-mono ' +
                          (step.done ? 'text-[#2ECC71]' : 'text-steel-400')
                        }
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < steps.length - 1 && (
                      <div
                        className={
                          'h-[2px] flex-1 mx-2 min-w-[20px] ' +
                          (step.done ? 'bg-[#27AE60]' : 'bg-steel-600')
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => navigate('/run-review')}
              className="btn-success whitespace-nowrap flex items-center gap-2"
            >
              一键运行预审
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

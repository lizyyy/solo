import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  Hash,
  History,
  Layers,
  Sigma,
} from 'lucide-react';
import { useMemo } from 'react';
import DetailDrawer from '../components/DetailDrawer';
import FilterToolbar from '../components/FilterToolbar';
import HistoryPanel from '../components/HistoryPanel';
import SampleTable from '../components/SampleTable';
import StatCard from '../components/StatCard';
import VerdictExport from '../components/VerdictExport';
import { selectStats, useSampleStore } from '../store/useSampleStore';

export default function Dashboard() {
  const samples = useSampleStore((s) => s.samples);
  const stats = useMemo(() => selectStats(samples), [samples]);
  const openHistory = useSampleStore((s) => s.openHistory);
  const selectSample = useSampleStore((s) => s.selectSample);
  const openVerdictPanel = useSampleStore((s) => s.openVerdictPanel);

  return (
    <div className="min-h-screen">
      <header className="bg-white/80 backdrop-blur border-b border-ink-200 sticky top-0 z-30">
        <div className="mx-auto max-w-[1400px] px-6 py-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ink-900 text-white flex items-center justify-center shadow-card">
              <Sigma className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-ink-950 leading-tight">
                图论路径批量验算
              </h1>
              <p className="text-xs text-ink-500">
                图论·第12次作业 · 2026-06-18 提交批次 · 老叶的审核工作台
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                selectSample(null);
                openHistory();
              }}
              className="btn-ghost"
            >
              <History className="w-4 h-4" /> 历史变更
            </button>
            <button onClick={openVerdictPanel} className="btn-primary">
              <FileText className="w-4 h-4" /> 审核结论 / 导出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6 space-y-5">
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="总样本数" value={stats.total} icon={Hash} accent="ink" filterKey="全部" index={0} />
          <StatCard
            label="异常"
            value={stats.abnormal}
            icon={AlertTriangle}
            accent="coral"
            filterKey="异常"
            tooltip="系统自动检测到与验算口径不符的样本，需人工复核。"
            index={1}
          />
          <StatCard
            label="空集合"
            value={stats.emptySet}
            icon={Layers}
            accent="ink"
            filterKey="空集合"
            tooltip="空集合∅在图论中为合法输入/输出，表示'不存在可达路径'。学生正确输出∅属于正常作答，不是程序异常。"
            index={2}
          />
          <StatCard
            label="重复样本"
            value={stats.duplicate}
            icon={BarChart3}
            accent="amber"
            filterKey="重复"
            tooltip="同一份作业被重复提交，以最后一次为准，其余保留用于追溯。"
            index={3}
          />
          <StatCard
            label="待确认"
            value={stats.pending}
            icon={Clock}
            accent="amber"
            filterKey="待确认"
            tooltip="已通过自动验算但尚未出具人工结论的样本。"
            index={4}
          />
          <StatCard label="已放行" value={stats.passed} icon={CheckCircle2} accent="emerald" filterKey="可放行" index={5} />
        </section>

        <FilterToolbar />

        <div className="card p-3 flex items-center gap-2 text-xs text-ink-600 bg-ink-50/60">
          <Layers className="w-4 h-4 text-ink-500" />
          <span>
            <b className="text-ink-900">使用提示：</b>
            点击统计卡按状态筛选；点击"查看"打开草稿与验算过程；hover 验算步骤可在草稿上高亮对应行；导出 CSV 后重复标记与空集合标注均保留。
          </span>
        </div>

        <SampleTable />
      </main>

      <DetailDrawer />
      <HistoryPanel />
      <VerdictExport />
    </div>
  );
}

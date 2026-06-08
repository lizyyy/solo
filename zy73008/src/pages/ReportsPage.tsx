import { useDogStore } from '@/store/dogStore';
import ReportCard from '@/components/reports/ReportCard';
import VersionTimeline from '@/components/reports/VersionTimeline';
import SnapshotViewer from '@/components/reports/SnapshotViewer';
import DiffView from '@/components/reports/DiffView';
import AnomalyExplainPanel from '@/components/reports/AnomalyExplainPanel';
import VerdictChain from '@/components/reports/VerdictChain';
import ManualConfirmView from '@/components/reports/ManualConfirmView';
import { useState } from 'react';
import { FileSearch, GitCompare, BookOpen, PanelRight, AlertCircle, RotateCcw, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabId = 'overview' | 'diff' | 'anomaly' | 'verdict' | 'manual';

export default function ReportsPage() {
  const {
    records,
    selectedRecordId, setSelectedRecord,
    selectedVersionA, selectedVersionB, setSelectedVersions,
  } = useDogStore();

  const record = records.find(r => r.id === selectedRecordId) || records[0];
  const [tab, setTab] = useState<TabId>('overview');
  const [snapshotVersion, setSnapshotVersion] = useState<number | null>(null);

  if (!record) {
    return <div className="max-w-7xl mx-auto px-5 py-16 text-center text-brand-500">暂无记录</div>;
  }

  const hist = record.versionHistory;
  const currentSnap = snapshotVersion ? hist.find(h => h.version === snapshotVersion) : hist[hist.length - 1];
  const verA = hist.find(h => h.version === selectedVersionA) || hist[0];
  const verB = hist.find(h => h.version === selectedVersionB) || hist[hist.length - 1];

  const tabs: Array<{ id: TabId; label: string; Icon: typeof FileSearch; show?: boolean }> = ([
    { id: 'overview', label: '快照总览', Icon: ZoomIn },
    { id: 'diff', label: '版本差异对比', Icon: GitCompare },
    { id: 'anomaly', label: '异常说明', Icon: AlertCircle, show: record.versionHistory.some(h => h.anomaly) },
    { id: 'verdict', label: '结论改判链路', Icon: RotateCcw, show: !!record.verdictChain && record.verdictChain.length > 0 },
    { id: 'manual', label: '人工确认对比', Icon: PanelRight, show: !!record.manualConfirm },
  ] as Array<{ id: TabId; label: string; Icon: typeof FileSearch; show?: boolean }>).filter(t => t.show !== false);

  const handleSelect = (v: number) => {
    setSnapshotVersion(v);
    // 默认用选中版本和最新版本对比
    const latest = hist[hist.length - 1].version;
    if (v === latest) {
      setSelectedVersions(hist[0].version, latest);
    } else {
      setSelectedVersions(v, latest);
    }
    setTab('overview');
  };

  const handleToggle = (v: number) => {
    // 双击切换到差异对比，当前版本作为 B
    setSelectedVersions(selectedVersionA, v);
    setTab('diff');
  };

  return (
    <div className="max-w-7xl mx-auto px-5 py-6 animate-fade-in-up">
      <section className="mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-md">
            <FileSearch className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold text-brand-800">疫苗报告导出 · 分析页</h2>
            <p className="text-sm text-brand-500 mt-0.5">
              现场老师彩排复盘专用 — 查看历史链、差异对比、异常原因、改判链路、人工确认前后对比
            </p>
          </div>
        </div>
      </section>

      {/* 报告卡片网格（4 条演示） */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-600" />
            <h3 className="font-semibold text-brand-700">案例卡 · 共 {records.length} 条（正常/补录/异常/改判）</h3>
          </div>
          <div className="text-xs text-brand-500">
            状态：<span className="chip chip-normal ml-1 mr-2">正常</span>
            <span className="chip chip-supplement mr-2">补录</span>
            <span className="chip chip-anomaly mr-2">异常</span>
            <span className="chip chip-verdict mr-2">改判</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {records.map(r => (
            <ReportCard
              key={r.id}
              record={r}
              selected={r.id === record.id}
              onClick={() => { setSelectedRecord(r.id); setSnapshotVersion(null); setTab('overview'); }}
            />
          ))}
        </div>
      </section>

      {/* 详情区：左时间轴 + 右内容 */}
      <section className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-5">
        {/* 左：时间轴 */}
        <div className="card p-5 h-fit xl:sticky xl:top-24">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold text-brand-800">
              版本时间轴 · {record.current.dogName}
            </h3>
            <span className="chip chip-normal">{hist.length} 个版本</span>
          </div>
          <VersionTimeline
            record={record}
            selectedA={selectedVersionA!}
            selectedB={selectedVersionB!}
            onSelect={handleSelect}
            onToggleCompare={handleToggle}
          />

          <div className="mt-5 pt-4 border-t border-brand-100 text-[11px] text-brand-500 space-y-1">
            <div className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-500" />无异常版本</div>
            <div className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-anomaly-500" />晚到附件 / 单位混写 / 附件模糊</div>
            <div className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-verdict-500" />结论改判</div>
            <div className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />人工确认通过</div>
          </div>
        </div>

        {/* 右：内容 */}
        <div className="space-y-5">
          {/* Tabs */}
          <div className="card p-2 flex flex-wrap gap-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all',
                  tab === t.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-brand-600 hover:bg-brand-50'
                )}
              >
                <t.Icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>

          <div className="card p-6">
            {tab === 'overview' && currentSnap && (
              <SnapshotViewer entry={currentSnap} />
            )}
            {tab === 'diff' && verA && verB && (
              <DiffView a={verA} b={verB} />
            )}
            {tab === 'anomaly' && (
              <AnomalyExplainPanel record={record} />
            )}
            {tab === 'verdict' && (
              <VerdictChain record={record} />
            )}
            {tab === 'manual' && (
              <ManualConfirmView record={record} />
            )}
          </div>

          {/* 底部：彩排提示 */}
          <div className="card p-5 border-dashed border-2 border-brand-200 bg-gradient-to-br from-cream-50/60 to-brand-50/40">
            <h4 className="font-serif font-bold text-brand-700 mb-2 flex items-center gap-1.5">
              <span className="text-xl">🎬</span> 彩排进场前 · 快速复盘流程
            </h4>
            <ol className="text-sm text-brand-700 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>点击上方案例卡选择一条记录（推荐顺序：豆豆→旺财→胖胖→可乐）</li>
              <li>左侧<strong>版本时间轴</strong>：单击任意节点切换快照，双击加入差异对比</li>
              <li>切换到<strong>异常说明</strong>页：查看「为什么没有按正常记录走」的解释</li>
              <li>切换到<strong>结论改判链路</strong>页：理解结论从 A 到 B 的改判原因与佐证材料</li>
              <li>切换到<strong>人工确认对比</strong>页（可乐）：对照确认前/后双栏，查看具体修改点</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}

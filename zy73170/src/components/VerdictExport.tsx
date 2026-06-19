import { AlertTriangle, CheckCircle2, Download, FileText, X } from 'lucide-react';
import { useSampleStore } from '../store/useSampleStore';
import { exportVerdicts } from '../utils/csvExport';
import StatusBadge from './StatusBadge';

function Section({
  title,
  subtitle,
  icon: Icon,
  accent,
  samples,
}: {
  title: string;
  subtitle: string;
  icon: any;
  accent: 'coral' | 'emerald';
  samples: any[];
}) {
  const openDrawer = useSampleStore((s) => s.openDrawer);
  const styles =
    accent === 'coral'
      ? {
          head: 'bg-coral-500 text-white',
          row: 'hover:bg-coral-50',
          chip: 'bg-coral-50 text-coral-700 border-coral-200',
          icon: 'text-coral-500',
        }
      : {
          head: 'bg-emerald2-500 text-white',
          row: 'hover:bg-emerald2-50',
          chip: 'bg-emerald2-50 text-emerald2-700 border-emerald2-200',
          icon: 'text-emerald2-500',
        };

  return (
    <section className="card overflow-hidden">
      <header className={`px-4 py-3 flex items-center gap-2 ${styles.head}`}>
        <Icon className="w-4 h-4" />
        <div>
          <h3 className="font-display text-base font-semibold leading-tight">{title}</h3>
          <p className="text-[11px] opacity-90">{subtitle}</p>
        </div>
        <span className="ml-auto text-xs bg-white/20 rounded-full px-2 py-0.5 font-semibold">
          {samples.length} 条
        </span>
      </header>
      {samples.length === 0 ? (
        <div className="p-8 text-center text-sm text-ink-500">当前没有该类别的样本</div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {samples.map((s) => (
            <li
              key={s.id}
              onClick={() => openDrawer(s.id)}
              className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer ${styles.row} transition-colors`}
            >
              <Icon className={`w-4 h-4 ${styles.icon} shrink-0`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-ink-900 text-sm">
                    {s.studentName}
                  </span>
                  <span className="font-mono text-[11px] text-ink-500">{s.studentId}</span>
                  {s.isDuplicate && (
                    <span className="text-[10px] font-semibold text-amber2-700 bg-amber2-50 border border-amber2-200 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" /> 重复
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-600 truncate mt-0.5">
                  {s.problemTitle} — <span className="font-medium">{s.resultSummary}</span>
                </div>
                {s.reviewNote && (
                  <div className="mt-1 text-[11px] text-ink-500 italic truncate">
                    备注：{s.reviewNote}
                  </div>
                )}
              </div>
              <StatusBadge status={s.status} showEmptyTooltip={false} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function VerdictExport() {
  const open = useSampleStore((s) => s.ui.isVerdictPanelOpen);
  const close = useSampleStore((s) => s.closeVerdictPanel);
  const samples = useSampleStore((s) => s.samples);

  const needSupplement = samples.filter((s) => s.finalVerdict === '需补材料');
  const passed = samples.filter((s) => s.finalVerdict === '可放行');
  const unreviewed = samples.filter((s) => !s.finalVerdict);

  const handleExport = () => exportVerdicts(samples);

  return (
    <>
      <div
        className={`fixed inset-0 bg-ink-950/30 backdrop-blur-sm z-40 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
      />
      <div
        className={`fixed top-0 left-0 bottom-0 z-50 w-full sm:w-[720px] lg:w-[860px] bg-ink-50 border-r border-ink-200 shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <header className="flex items-start justify-between gap-4 p-5 border-b border-ink-200 bg-white">
          <div>
            <h2 className="font-display text-xl text-ink-950 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              审核结论清单
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              给数学老师老叶的非技术版交付物：直接看出哪条要补、哪条能放行；
              导出后重复标记与空集合标注均保留。
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleExport} className="btn-primary">
              <Download className="w-4 h-4" /> 导出 CSV
            </button>
            <button onClick={close} className="btn-ghost !p-2" aria-label="关闭">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3">
              <div className="label">需补材料</div>
              <div className="font-display text-2xl text-coral-600">{needSupplement.length}</div>
            </div>
            <div className="card p-3">
              <div className="label">可放行</div>
              <div className="font-display text-2xl text-emerald2-600">{passed.length}</div>
            </div>
            <div className="card p-3">
              <div className="label">未审核</div>
              <div className="font-display text-2xl text-amber2-600">{unreviewed.length}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Section
              title="需补材料"
              subtitle="这些样本需要学生补齐内容或修改后再提交"
              icon={AlertTriangle}
              accent="coral"
              samples={needSupplement}
            />
            <Section
              title="可放行"
              subtitle="这些样本审核通过，可计入本次作业成绩"
              icon={CheckCircle2}
              accent="emerald"
              samples={passed}
            />
          </div>

          {unreviewed.length > 0 && (
            <div className="card p-4 border border-amber2-200 bg-amber2-50/50">
              <div className="flex items-center gap-2 text-amber2-700">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-semibold">还有 {unreviewed.length} 条未出具审核结论</span>
              </div>
              <p className="mt-1 text-xs text-amber2-700/90">
                建议先在主列表中完成所有样本的审核，再导出最终清单用于第二天复盘。
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

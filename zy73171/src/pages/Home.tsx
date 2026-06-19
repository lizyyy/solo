import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Beaker, Download, Layers } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function Home() {
  const { samples, exceptions, snapshots, paramTable } = useAppStore();

  const cards = [
    {
      title: '样例在哪',
      desc: `${samples.length} 条边界样本，点选直接跳回复核页`,
      icon: Beaker,
      to: '/samples',
      badge: samples.filter((s) => s.isExample).length,
      badgeColor: 'navy',
    },
    {
      title: '异常在哪',
      desc: `${exceptions.filter((e) => e.status === 'pending').length} 条待复核`,
      icon: AlertTriangle,
      to: '/exceptions',
      badge: exceptions.filter((e) => e.status !== 'resolved').length,
      badgeColor: 'amber',
    },
    {
      title: '结果怎么导出',
      desc: `${snapshots.length} 个筛选快照已保存`,
      icon: Download,
      to: '/exceptions',
      badge: snapshots.length,
      badgeColor: 'emerald',
    },
  ];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-slate-600 text-sm mb-1">交接速览 · 只需关注三件事</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map(({ title, desc, icon: Icon, to, badge, badgeColor }) => (
            <Link
              key={title}
              to={to}
              className="card hover-float p-6 flex flex-col gap-4 h-52 block"
            >
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 border-2 border-${badgeColor === 'navy' ? 'navy' : badgeColor === 'amber' ? 'amber' : 'emerald'}-600 flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 text-${badgeColor === 'navy' ? 'navy' : badgeColor === 'amber' ? 'amber' : 'emerald'}-700`} />
                </div>
                <span className={`badge badge-${badgeColor === 'navy' ? 'navy' : badgeColor === 'amber' ? 'amber' : 'emerald'}`}>
                  {badge}
                </span>
              </div>
              <div>
                <h2 className="font-display text-lg text-navy-800 font-semibold mb-1">{title}</h2>
                <p className="text-sm text-slate-500">{desc}</p>
              </div>
              <div className="mt-auto flex items-center justify-end text-navy-700 text-sm font-medium">
                进入 <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-navy-700" />
            <h3 className="font-display text-base text-navy-800 font-semibold">参数表批次</h3>
          </div>
          <div className="space-y-3">
            {paramTable.versions.slice().reverse().map((v) => (
              <div key={v.id} className="border-l-4 border-navy-400 pl-3 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">
                    版本 v{v.versionNo}
                  </span>
                  <span className="text-xs text-slate-500 font-mono-data">{v.createdAt}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{v.remark}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="font-display text-base text-navy-800 font-semibold">最近异常</h3>
          </div>
          <div className="space-y-2">
            {exceptions.slice(0, 4).map((e) => (
              <div key={e.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className={`badge mt-0.5 ${e.status === 'pending' ? 'badge-amber' : e.status === 'reviewing' ? 'badge-navy' : 'badge-emerald'}`}>
                  {e.status === 'pending' ? '待处理' : e.status === 'reviewing' ? '处理中' : '已解决'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 truncate">{e.sampleName}</p>
                  <p className="text-xs text-slate-500 truncate">{e.reason}</p>
                </div>
                <span className="text-xs text-slate-400 font-mono-data whitespace-nowrap">{e.createdAt.slice(5, 16)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="font-display text-base text-navy-800 font-semibold mb-3">操作说明 · 三条就够</h3>
        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
          <li>从「样例在哪」选一条样本 → 自动跳到边界复核页，参数版本与样本绑定</li>
          <li>点「复算」→ 中间路径图与口径对比同步刷新，右侧因果链逐条解释为什么结论变了</li>
          <li>异常队列里先选筛选条件 → 保存快照 → 导出，文件名自带快照 ID，后续输 ID 即追回同批</li>
        </ol>
      </section>
    </div>
  );
}

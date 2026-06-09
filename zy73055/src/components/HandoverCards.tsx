import { useNavigate } from 'react-router-dom';
import { FileSearch, AlertOctagon, Download, ArrowRight, X } from 'lucide-react';
import { useWorkOrderStore } from '../store/workOrderStore';

interface HandoverCardsProps {
  asOverlay?: boolean;
  onClose?: () => void;
}

export function HandoverCards({ asOverlay = false, onClose }: HandoverCardsProps) {
  const navigate = useNavigate();
  const { locateSampleOrder, abnormalQueue, statistics, exportFilteredCSV, resetFilters, toggleHandoverGuide } = useWorkOrderStore();

  const handleExport = () => {
    resetFilters();
    setTimeout(() => {
      const csv = exportFilteredCSV();
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `电梯故障工单回放_全部导出_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }, 50);
  };

  const cards = [
    {
      title: '样例工单在哪？',
      sub: '点按钮直接打开"旧说法+晚到附件"双命中样例工单',
      desc: '阿敏最担心的就是照片里翻出旧说法被平均值掩盖，直接看GD20260601002这条样例。',
      icon: <FileSearch className="w-6 h-6" />,
      gradient: 'from-indigo-500 to-indigo-600',
      bg: 'from-indigo-50 to-white',
      border: 'border-indigo-200',
      btn: '打开样例工单',
      onClick: () => { locateSampleOrder(); if (asOverlay && onClose) onClose(); else navigate('/'); },
      meta: `样例工单共 ${statistics.oldTerminologyHits + statistics.lateArrivalCount >= 2 ? '多条' : '1条'}`,
    },
    {
      title: '异常在哪？',
      sub: '直接跳转到异常队列顶部，按优先级处理',
      desc: `当前异常/待复核共 ${abnormalQueue.length} 条，异常队列位于主页右侧固定面板，按紧急程度从上到下排列。`,
      icon: <AlertOctagon className="w-6 h-6" />,
      gradient: 'from-red-500 to-red-600',
      bg: 'from-red-50 to-white',
      border: 'border-red-200',
      btn: '前往主页 · 异常队列',
      onClick: () => { resetFilters(); if (asOverlay && onClose) onClose(); else navigate('/'); },
      meta: `共 ${abnormalQueue.length} 条 · ${statistics.abnormal} 异常 ${statistics.pending} 待复核`,
    },
    {
      title: '结果怎么导出？',
      sub: '一键导出当前筛选结果为CSV，Excel直接打开',
      desc: `当前全量共 ${statistics.total} 条，导出含工单/设备/判断/人工备注/晚到附件数/旧说法命中 等15列信息。`,
      icon: <Download className="w-6 h-6" />,
      gradient: 'from-emerald-500 to-emerald-600',
      bg: 'from-emerald-50 to-white',
      border: 'border-emerald-200',
      btn: '一键导出全量结果',
      onClick: () => { handleExport(); if (asOverlay && onClose) onClose(); },
      meta: `${statistics.total} 条 · CSV 格式 · Excel可直接打开`,
    },
  ];

  const wrapCls = asOverlay
    ? 'fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn'
    : '';

  return (
    <div className={wrapCls} onClick={asOverlay ? onClose : undefined}>
      <div
        className={asOverlay ? 'bg-white rounded-2xl shadow-2xl p-6 max-w-5xl w-full animate-slideInUp relative' : ''}
        onClick={(e) => asOverlay && e.stopPropagation()}
      >
        {asOverlay && onClose && (
          <button
            onClick={() => { toggleHandoverGuide(false); onClose(); }}
            className="absolute top-4 right-4 p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="mb-6">
          <div className="text-sm font-semibold text-indigo-600 mb-1">
            {asOverlay ? '👋 阿敏/接班同事 — 快速入口' : '接班快速指引（三卡片）'}
          </div>
          <div className={`font-bold ${asOverlay ? 'text-2xl' : 'text-xl'} text-slate-900 mb-1.5`}>
            接班只需要知道三件事
          </div>
          <div className="text-sm text-slate-500">
            样例在哪 → 异常在哪 → 结果怎么导出 · 每步不超过2行说明
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {cards.map((c, i) => (
            <button
              key={i}
              onClick={c.onClick}
              className={`group text-left p-5 rounded-xl bg-gradient-to-br ${c.bg} border-2 ${c.border} shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}
              style={{ animation: asOverlay ? `fadeInUp 0.4s ease-out ${0.1 + i * 0.1}s both` : undefined }}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.gradient} text-white shadow-lg mb-3 flex items-center justify-center`}>
                {c.icon}
              </div>
              <div className="font-bold text-slate-900 text-base mb-1">{c.title}</div>
              <div className="text-xs text-slate-600 mb-2 leading-snug">{c.sub}</div>
              <div className="text-[11px] text-slate-500 mb-4 leading-relaxed">{c.desc}</div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800 group-hover:translate-x-0.5 transition-transform">
                  {c.btn} <ArrowRight className="w-4 h-4" />
                </span>
                <span className="text-[10px] text-slate-400 bg-white/70 px-2 py-0.5 rounded border border-slate-200">
                  {c.meta}
                </span>
              </div>
            </button>
          ))}
        </div>

        {asOverlay && (
          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              💡 历史判断的修改原因？打开任意工单详情抽屉，底部有完整<b className="text-indigo-600">判断时间链</b>，每个最终值的决策背景都可追溯。
            </div>
            <button
              onClick={() => { navigate('/history'); onClose?.(); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              查看全部判断历史 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

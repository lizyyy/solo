import { useEffect } from 'react';
import { X, Play, CheckCircle2, AlertTriangle, Edit3, Sparkles } from 'lucide-react';
import { useReviewStore } from '../store/reviewStore';
import { SCHEME_COLORS } from '../data/mockData';

const STEPS = [
  {
    title: '第 1 步 · 顺利记录',
    tag: '已确认',
    tagColor: 'emerald',
    zoneId: 'F1-Z01',
    zoneName: '东侧商业区',
    desc: '点击 Web3D 视图中浅绿色的「东侧商业区」体块 → 右侧查看三源备注完全一致 → 点「已确认」形成记录。',
    icon: CheckCircle2
  },
  {
    title: '第 2 步 · 补录记录',
    tag: '待补件',
    tagColor: 'amber',
    zoneId: 'F1-Z02',
    zoneName: '核心筒走道',
    desc: '顶部切到「方案 B」 → 点击「核心筒走道」→ 后补备注卡片点「补录」按钮 → 输入实测口径并保存 → 点「待补件」。',
    icon: Edit3
  },
  {
    title: '第 3 步 · 异常记录',
    tag: '退回',
    tagColor: 'rose',
    zoneId: 'F2-Z03',
    zoneName: '西侧库房',
    desc: '切到「方案 B」 → 点击 2 楼「西侧库房」→ 三源备注出现红色虚线差异标 + 碰撞点×3 重复 → 点「退回」+「标记异常」。',
    icon: AlertTriangle
  }
];

export default function GuideOverlay() {
  const { showGuide, setShowGuide, guidedStep, setGuidedStep, selectZone, setActiveScheme } = useReviewStore();

  useEffect(() => {
    if (!showGuide) return;
    const step = STEPS[guidedStep];
    if (!step) return;
    if (step.zoneId === 'F1-Z02' || step.zoneId === 'F2-Z03') setActiveScheme('B');
    else setActiveScheme('A');
    const t = setTimeout(() => selectZone(step.zoneId), 180);
    return () => clearTimeout(t);
  }, [guidedStep, showGuide]);

  if (!showGuide) return null;

  const step = STEPS[guidedStep];
  const schemeConf = SCHEME_COLORS[guidedStep === 0 ? 'A' : 'B'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/55 backdrop-blur-[3px]">
      <div className="w-[620px] rounded-[10px] border-2 shadow-2xl overflow-hidden" style={{ borderColor: schemeConf.main, boxShadow: `0 0 40px ${schemeConf.glow}` }}>
        <div className="relative px-6 py-5 bg-gradient-to-br from-[#17202E] via-[#131B27] to-[#0F1621] border-b" style={{ borderColor: schemeConf.main + '55' }}>
          <button
            onClick={() => { setShowGuide(false); selectZone(null); }}
            className="absolute right-4 top-4 w-8 h-8 rounded-[4px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/70 transition"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-[6px] flex items-center justify-center"
              style={{ background: schemeConf.main + '22', border: `2px solid ${schemeConf.main}` }}
            >
              <Sparkles size={22} style={{ color: schemeConf.main }} />
            </div>
            <div>
              <h3 className="font-mono text-[15px] tracking-[0.18em] text-slate-100 font-bold">演示引导 · 消防分区方案比选</h3>
              <p className="font-mono text-[10.5px] text-slate-500 mt-0.5">
                跟着 3 条小数据走一遍：顺利记录 → 补录记录 → 异常记录
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            {STEPS.map((_, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className="flex-1 relative h-2 rounded-full bg-slate-800/70 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                    style={{
                      width: `${i <= guidedStep ? '100%' : '0%'}`,
                      background: i < guidedStep ? SCHEME_COLORS['A'].main : schemeConf.main
                    }}
                  />
                </div>
                <div
                  className={'w-7 h-7 rounded-full flex items-center justify-center font-mono text-[11px] font-bold border-2 transition-all ' +
                    (i <= guidedStep ? 'text-white shadow-lg' : 'bg-slate-900 border-slate-600 text-slate-500')}
                  style={i <= guidedStep ? { background: schemeConf.main, borderColor: '#FFFFFF' } : {}}
                >
                  {i + 1}
                </div>
              </div>
            )).slice(0, -1)}
            <div
              className={'w-7 h-7 rounded-full flex items-center justify-center font-mono text-[11px] font-bold border-2 transition-all ' +
                (guidedStep >= STEPS.length - 1 ? 'text-white shadow-lg' : 'bg-slate-900 border-slate-600 text-slate-500')}
              style={guidedStep >= STEPS.length - 1 ? { background: schemeConf.main, borderColor: '#FFFFFF' } : {}}
            >
              3
            </div>
          </div>
        </div>

        <div className="bg-slate-950/80 px-6 py-5 space-y-4">
          <div className="flex items-start gap-4">
            <div
              className={'w-14 h-14 rounded-[6px] flex items-center justify-center flex-shrink-0 ' +
                (step.tagColor === 'emerald' ? 'bg-emerald-500/15 border-2 border-emerald-400/70'
                 : step.tagColor === 'amber' ? 'bg-amber-500/15 border-2 border-amber-400/70'
                 : 'bg-rose-500/15 border-2 border-rose-400/70')}
            >
              <step.icon
                size={26}
                className={step.tagColor === 'emerald' ? 'text-emerald-300' : step.tagColor === 'amber' ? 'text-amber-300' : 'text-rose-300'}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <h4 className="font-mono text-[14px] tracking-[0.15em] text-slate-100 font-bold">{step.title}</h4>
                <span
                  className={'px-2 py-0.5 rounded-[3px] font-mono text-[10px] tracking-wider border ' +
                    (step.tagColor === 'emerald' ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-200'
                     : step.tagColor === 'amber' ? 'bg-amber-500/15 border-amber-400/60 text-amber-200'
                     : 'bg-rose-500/15 border-rose-400/60 text-rose-200')}
                >
                  {step.tag}
                </span>
              </div>
              <p className="font-mono text-[10.5px] text-slate-500 mb-2">目标分区：<span className="font-bold text-slate-300">{step.zoneId}</span> · {step.zoneName}</p>
              <p className="font-mono text-[12px] text-slate-300 leading-[1.75]">{step.desc}</p>
            </div>
          </div>

          <div className="rounded-[5px] border border-dashed border-slate-700/80 bg-slate-900/50 p-3 space-y-1.5">
            <p className="font-mono text-[10.5px] text-slate-500 tracking-wider">💡 你会同时看到联动效果：</p>
            <ul className="space-y-1 pl-4 list-disc">
              <li className="font-mono text-[10.5px] text-slate-400">Web3D 分区自动选中并高亮 + 外发光</li>
              <li className="font-mono text-[10.5px] text-slate-400">右侧备注三栏联动显示 BIM/后补/口头 口径对比</li>
              <li className="font-mono text-[10.5px] text-slate-400">左侧清单同步高亮 + 顶部状态卡片数字实时变化</li>
              <li className="font-mono text-[10.5px] text-slate-400">异常队列页可看到碰撞点×N 的具体明细（不只是总数！）</li>
            </ul>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-900/60 border-t border-slate-800/70 flex items-center justify-between">
          <button
            onClick={() => { setShowGuide(false); selectZone(null); }}
            className="px-4 py-2 rounded-[4px] font-mono text-[11px] tracking-wider text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-700/60 transition"
          >
            跳过引导 · 自己探索
          </button>
          <div className="flex items-center gap-2">
            <button
              disabled={guidedStep === 0}
              onClick={() => setGuidedStep(Math.max(0, guidedStep - 1))}
              className="px-4 py-2 rounded-[4px] font-mono text-[11px] tracking-wider disabled:opacity-40 disabled:cursor-not-allowed bg-slate-800/70 text-slate-300 hover:text-white border border-slate-600/60 hover:border-slate-500 transition"
            >
              上一步
            </button>
            {guidedStep < STEPS.length - 1 ? (
              <button
                onClick={() => setGuidedStep(guidedStep + 1)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-[4px] font-mono text-[11px] tracking-wider text-white shadow-lg transition active:scale-[0.97]"
                style={{ background: `linear-gradient(135deg, ${schemeConf.main}, ${schemeConf.main}CC)`, boxShadow: `0 0 18px ${schemeConf.glow}` }}
              >
                <Play size={11} fill="currentColor" /> 下一步，去操作
              </button>
            ) : (
              <button
                onClick={() => { setGuidedStep(0); setShowGuide(false); selectZone(null); }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-[4px] font-mono text-[11px] tracking-wider text-white bg-gradient-to-r from-emerald-500 to-sky-500 shadow-lg shadow-emerald-900/40 transition active:scale-[0.97]"
              >
                <CheckCircle2 size={12} /> 走完啦 · 开始使用
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

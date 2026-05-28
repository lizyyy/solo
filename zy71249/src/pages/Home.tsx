import { Link, useNavigate } from 'react-router-dom';
import { Ship, DollarSign, Unplug, PlayCircle, History, Anchor } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';

export default function Home() {
  const navigate = useNavigate()
  const startGame = useGameStore(s => s.startGame)

  const handleStart = () => {
    startGame()
    navigate('/game')
  }

  const risks = [
    {
      icon: Ship,
      title: '港口拥堵',
      desc: '全球港口运力骤降，集装箱滞留超30天，交期不可控',
      accent: 'from-orange-500/20 to-orange-900/5',
      border: 'hover:border-orange-500/50',
    },
    {
      icon: DollarSign,
      title: '汇率变化',
      desc: '主要结算货币剧烈波动，利润空间被汇率吞噬',
      accent: 'from-blue-500/20 to-blue-900/5',
      border: 'hover:border-blue-500/50',
    },
    {
      icon: Unplug,
      title: '供应商断供',
      desc: '核心供应商突发停产，关键物料链路瞬间断裂',
      accent: 'from-red-500/20 to-red-900/5',
      border: 'hover:border-red-500/50',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-[#E0E1DD] overflow-hidden relative">
      {/* 背景网格 */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#E0E1DD 1px, transparent 1px), linear-gradient(90deg, #E0E1DD 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* 顶部扫描线动画 */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#E85D04]/40 to-transparent animate-[scan_6s_ease-in-out_infinite]" />

      <div className="relative z-10 flex flex-col items-center">
        {/* ===== Hero ===== */}
        <section className="flex flex-col items-center justify-center pt-24 pb-16 px-6 text-center w-full">
          {/* 状态指示器 */}
          <div className="flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-[#415A77]/40 bg-[#1B2838]/60 text-xs tracking-widest uppercase text-[#415A77]">
            <span className="w-2 h-2 rounded-full bg-[#E85D04] animate-pulse" />
            供应链监控系统 — 在线
          </div>

          {/* 锚点图标 */}
          <Anchor className="w-10 h-10 text-[#E85D04]/60 mb-4" strokeWidth={1.5} />

          {/* 标题 */}
          <h1
            className="text-5xl sm:text-7xl font-black tracking-tight leading-none"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            <span className="bg-gradient-to-b from-[#E0E1DD] to-[#415A77] bg-clip-text text-transparent">
              供应链
            </span>
            <br />
            <span className="text-[#E85D04]">断点求生</span>
          </h1>

          {/* 副标题 */}
          <p className="mt-6 max-w-xl text-base sm:text-lg text-[#415A77] leading-relaxed">
            当全球供应链在12个回合内接连崩塌，
            <br className="hidden sm:block" />
            你能否在港口拥堵、汇率风暴与断供危机中维持运转？
          </p>

          {/* CTA 按钮 */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleStart}
              className="group relative flex items-center gap-2.5 px-8 py-3.5 bg-[#E85D04] text-[#0D1B2A] font-bold rounded-lg text-sm tracking-wide transition-all duration-200 hover:shadow-[0_0_30px_rgba(232,93,4,0.4)] hover:scale-[1.03] active:scale-[0.98]"
            >
              <PlayCircle className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              开始游戏
              <span className="absolute inset-0 rounded-lg border border-[#E85D04]/50 group-hover:border-[#E85D04] transition-colors" />
            </button>

            <Link
              to="/replay"
              className="group flex items-center gap-2.5 px-8 py-3.5 bg-[#1B2838] text-[#415A77] font-bold rounded-lg text-sm tracking-wide border border-[#415A77]/30 transition-all duration-200 hover:text-[#E0E1DD] hover:border-[#415A77]/60 hover:scale-[1.03] active:scale-[0.98]"
            >
              <History className="w-5 h-5" />
              回放记录
            </Link>
          </div>

          {/* 数据指标条 */}
          <div className="mt-14 flex gap-8 sm:gap-14 text-center">
            {[
              { value: '12', label: '回合' },
              { value: '3', label: '核心风险' },
              { value: '∞', label: '策略组合' },
            ].map((m) => (
              <div key={m.label}>
                <div
                  className="text-2xl sm:text-3xl font-extrabold text-[#E85D04]"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  {m.value}
                </div>
                <div className="text-xs text-[#415A77] tracking-wider mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 风险卡片 ===== */}
        <section className="w-full max-w-5xl px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#415A77]/30 to-transparent" />
            <span className="text-xs tracking-[0.3em] uppercase text-[#415A77]">核心威胁</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#415A77]/30 to-transparent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {risks.map((r) => (
              <div
                key={r.title}
                className={`relative group rounded-xl border border-[#415A77]/20 bg-[#1B2838]/50 p-6 transition-all duration-300 ${r.border} hover:bg-[#1B2838]/80 hover:-translate-y-1 hover:shadow-lg`}
              >
                <div
                  className={`absolute inset-0 rounded-xl bg-gradient-to-b ${r.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#0D1B2A] flex items-center justify-center border border-[#415A77]/30">
                      <r.icon className="w-5 h-5 text-[#E85D04]" />
                    </div>
                    <h3 className="font-bold text-base tracking-wide">{r.title}</h3>
                  </div>
                  <p className="text-sm text-[#415A77] leading-relaxed">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 游戏简介 ===== */}
        <section className="w-full max-w-3xl px-6 pb-24">
          <div className="rounded-xl border border-[#415A77]/15 bg-[#1B2838]/30 p-8 relative overflow-hidden">
            {/* 左侧装饰条 */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#E85D04] via-[#E85D04]/30 to-transparent" />

            <h2 className="text-lg font-bold tracking-wide mb-4 text-[#E0E1DD]">游戏规则</h2>
            <div className="space-y-3 text-sm text-[#415A77] leading-relaxed">
              <p>
                你将扮演一家全球化制造企业的供应链总监。在
                <span className="text-[#E85D04] font-mono font-bold">12</span>
                个回合中，系统将随机触发港口拥堵、汇率剧烈波动与供应商突发断供等事件。
              </p>
              <p>
                每回合你需要做出采购、库存与物流决策——选择替代供应商、调整采购时机、对冲汇率风险。
                每一个决策都将影响你的
                <span className="text-[#E0E1DD] font-medium">供应链韧性指数</span>与
                <span className="text-[#E0E1DD] font-medium">财务健康度</span>。
              </p>
              <p>
                回合结束后，系统将生成你的生存报告：你的供应链是否扛住了冲击，还是在某个断点处彻底崩溃？
              </p>
            </div>

            {/* 底部装饰 */}
            <div className="mt-6 pt-4 border-t border-[#415A77]/15 flex items-center justify-between text-xs text-[#415A77]/60">
              <span className="font-mono">SYS::SUPPLY_CHAIN_v2.1</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                运行正常
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

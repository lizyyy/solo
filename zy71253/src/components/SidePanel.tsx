import { useStore } from '@/store/useStore';
import { EQ_TYPE_LABELS, EQ_TYPE_COLORS } from '@/utils/mathEngine';
import { PanelRightClose, PanelRightOpen, AlertCircle, CheckCircle2, Clock, Link2 } from 'lucide-react';

function SystemInfoCard() {
  const params = useStore((s) => s.params);
  const equilibria = useStore((s) => s.equilibria);

  const eq = equilibria[0];
  const eigen = eq?.eigen;

  const tr = eigen?.tr ?? 0;
  const det = eigen?.det ?? 0;
  const disc = eigen?.discriminant ?? 0;

  const formatComplex = (real: number, imag: number) => {
    if (Math.abs(imag) < 1e-8) return real.toFixed(3);
    const sign = imag >= 0 ? '+' : '-';
    return `${real.toFixed(3)} ${sign} ${Math.abs(imag).toFixed(3)}i`;
  };

  return (
    <div className="bg-[#0a1628]/80 border border-[#1a3050]/50 rounded-xl p-4 space-y-3">
      <h4 className="text-xs font-semibold text-[#8899aa] uppercase tracking-wider"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        系统信息
      </h4>

      <div className="space-y-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        <div className="text-xs text-[#667788]">方程组</div>
        <div className="text-xs text-[#aabbcc] pl-2">
          dx/dt = <span style={{ color: '#FF6B4A' }}>{params.a.toFixed(1)}</span>x + <span style={{ color: '#00D4AA' }}>{params.b.toFixed(1)}</span>y
        </div>
        <div className="text-xs text-[#aabbcc] pl-2">
          dy/dt = <span style={{ color: '#FFB84D' }}>{params.c.toFixed(1)}</span>x + <span style={{ color: '#AABBFF' }}>{params.d.toFixed(1)}</span>y
        </div>
      </div>

      <div className="space-y-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        <div className="text-xs text-[#667788]">雅可比矩阵 J</div>
        <div className="grid grid-cols-2 gap-0.5 w-28 mx-auto">
          <div className="text-xs text-center py-1 bg-[#FF6B4A]/10 text-[#FF6B4A] rounded-l">{params.a.toFixed(1)}</div>
          <div className="text-xs text-center py-1 bg-[#00D4AA]/10 text-[#00D4AA] rounded-r">{params.b.toFixed(1)}</div>
          <div className="text-xs text-center py-1 bg-[#FFB84D]/10 text-[#FFB84D] rounded-l">{params.c.toFixed(1)}</div>
          <div className="text-xs text-center py-1 bg-[#AABBFF]/10 text-[#AABBFF] rounded-r">{params.d.toFixed(1)}</div>
        </div>
      </div>

      <div className="space-y-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        <div className="text-xs text-[#667788]">特征值</div>
        {eigen && (
          <div className="text-xs text-[#aabbcc] pl-2 space-y-0.5">
            {disc >= -1e-8 ? (
              <>
                <div>λ₁ = {eigen.eigenvalues[0].toFixed(3)}</div>
                <div>λ₂ = {eigen.eigenvalues[1].toFixed(3)}</div>
              </>
            ) : (
              <>
                <div>λ₁ = {formatComplex(eigen.eigenvalues[0], eigen.eigenvalues[1])}</div>
                <div>λ₂ = {formatComplex(eigen.eigenvalues[0], -eigen.eigenvalues[1])}</div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        <div className="text-xs text-[#667788]">判据</div>
        <div className="flex gap-4 text-xs">
          <span className="text-[#aabbcc]">tr = <span className="text-[#FF6B4A]">{tr.toFixed(3)}</span></span>
          <span className="text-[#aabbcc]">det = <span className="text-[#00D4AA]">{det.toFixed(3)}</span></span>
          <span className="text-[#aabbcc]">Δ = <span className="text-[#FFB84D]">{disc.toFixed(3)}</span></span>
        </div>
      </div>

      {eq && (
        <div className="pt-2 border-t border-[#1a3050]">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: EQ_TYPE_COLORS[eq.type], boxShadow: `0 0 8px ${EQ_TYPE_COLORS[eq.type]}` }}
            />
            <span className="text-xs font-bold" style={{ color: EQ_TYPE_COLORS[eq.type] }}>
              {EQ_TYPE_LABELS[eq.type]}
            </span>
          </div>
          <div className="text-xs text-[#667788] mt-1 pl-5"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            位置: ({eq.x.toFixed(2)}, {eq.y.toFixed(2)})
          </div>
        </div>
      )}
    </div>
  );
}

function PendingItemsCard() {
  const pendingItems = useStore((s) => s.pendingItems);
  const supplementPendingItem = useStore((s) => s.supplementPendingItem);

  const statusConfig = {
    missing: { icon: AlertCircle, color: '#FF6B4A', label: '待补' },
    supplemented: { icon: CheckCircle2, color: '#00D4AA', label: '已补' },
    late: { icon: Clock, color: '#FFB84D', label: '晚到' },
  };

  return (
    <div className="bg-[#0a1628]/80 border border-[#1a3050]/50 rounded-xl p-4 space-y-3">
      <h4 className="text-xs font-semibold text-[#8899aa] uppercase tracking-wider"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        待办与版本
      </h4>

      <div className="space-y-2">
        {pendingItems.map((item) => {
          const cfg = statusConfig[item.status];
          const Icon = cfg.icon;
          return (
            <div
              key={item.id}
              className="flex items-start gap-2 p-2 rounded-lg bg-[#060e1a]/60 border border-[#1a3050]/30"
            >
              <Icon size={14} style={{ color: cfg.color }} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold"
                    style={{ color: cfg.color, fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${cfg.color}15`,
                      color: cfg.color,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-[10px] text-[#556677]"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    v{item.version}
                  </span>
                </div>
                <div className="text-xs text-[#667788] mt-0.5">{item.description}</div>
                {item.linkedConclusionId && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-[#00D4AA]">
                    <Link2 size={10} />
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      → 结论 {item.linkedConclusionId}
                    </span>
                  </div>
                )}
                {item.status === 'missing' && !item.linkedConclusionId && (
                  <button
                    onClick={() => supplementPendingItem(item.id, `C-${item.id}`)}
                    className="mt-1 text-[10px] px-2 py-0.5 rounded-full border border-[#FF6B4A]/30 text-[#FF6B4A] hover:bg-[#FF6B4A]/10 transition-colors"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    补充资料
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SidePanel() {
  const sidePanelOpen = useStore((s) => s.sidePanelOpen);
  const toggleSidePanel = useStore((s) => s.toggleSidePanel);

  return (
    <div className={`transition-all duration-300 ${sidePanelOpen ? 'w-80' : 'w-10'} flex flex-col h-full`}>
      <button
        onClick={toggleSidePanel}
        className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full border border-[#1a3050] bg-[#0a1628] text-[#667788] hover:text-[#FF6B4A] hover:border-[#FF6B4A]/40 transition-colors"
      >
        {sidePanelOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
      </button>

      {sidePanelOpen && (
        <div className="flex-1 overflow-y-auto space-y-3 p-3 pr-12">
          <SystemInfoCard />
          <PendingItemsCard />
        </div>
      )}
    </div>
  );
}

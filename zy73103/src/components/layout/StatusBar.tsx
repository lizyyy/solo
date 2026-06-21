import { useAppStore } from '../../store/useStore';
import { schemeStatusLabel } from '../../utils/helpers';
import { Activity, FileText, AlertOctagon, Clock } from 'lucide-react';

export default function StatusBar() {
  const selectedSchemeId = useAppStore((s) => s.selectedSchemeId);
  const schemes = useAppStore((s) => s.schemes);
  const notesLength = useAppStore((s) => s.notes.length);
  const anomalies = useAppStore((s) => s.anomalies);
  const rerunHistory = useAppStore((s) => s.rerunHistory);

  const scheme = schemes.find((x) => x.id === selectedSchemeId)!;
  const activeAnomalies = anomalies.filter((a) => a.status !== 'resolved').length;
  const lastRerun = rerunHistory[rerunHistory.length - 1];

  const items: { icon: React.ReactNode; label: string; value: string; accent: string }[] = [
    {
      icon: <Activity size={12} className="text-blue-400" />,
      label: '当前方案',
      value: `${selectedSchemeId} · ${scheme.name} · ${schemeStatusLabel(scheme.status)}`,
      accent: 'text-blue-200',
    },
    {
      icon: <FileText size={12} className="text-slate-400" />,
      label: '已录入备注',
      value: `${notesLength} 条（共 8 条样例）`,
      accent: 'text-slate-200',
    },
    {
      icon: <AlertOctagon size={12} className="text-red-400" />,
      label: '活跃异常',
      value: `${activeAnomalies} 条（已拎出，未混入正常结果）`,
      accent: 'text-red-200',
    },
    {
      icon: <Clock size={12} className="text-amber-400" />,
      label: '最近重跑',
      value: lastRerun
        ? `第 ${lastRerun.runIndex} 轮 · ${new Date(lastRerun.timestamp).toLocaleString('zh-CN', { hour12: false })}`
        : '尚未重跑',
      accent: 'text-amber-200',
    },
  ];

  return (
    <div className="relative border-t border-slate-700/60 bg-slate-950/80 backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(148,163,184,0.3), transparent)',
        }}
      />
      <div className="flex h-8 items-center gap-6 overflow-x-auto px-5 text-[11px]">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5 whitespace-nowrap">
            {it.icon}
            <span className="text-slate-500">{it.label}：</span>
            <span
              className={it.accent}
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {it.value}
            </span>
          </div>
        ))}
        <span
          className="ml-auto font-mono text-[10px] text-slate-600"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          © 2026 · 结构工程师协同平台 · 口径一致性校验：ON
        </span>
      </div>
    </div>
  );
}

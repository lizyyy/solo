import { useStore } from '@/store/useStore';
import { X, Download, FileText, Clock } from 'lucide-react';
import { EQ_TYPE_LABELS } from '@/utils/mathEngine';

export default function ReportExport() {
  const reportModalOpen = useStore((s) => s.reportModalOpen);
  const closeReportModal = useStore((s) => s.closeReportModal);
  const exportReport = useStore((s) => s.exportReport);
  const reportVersions = useStore((s) => s.reportVersions);
  const params = useStore((s) => s.params);
  const equilibria = useStore((s) => s.equilibria);
  const trajectories = useStore((s) => s.trajectories);
  const pendingItems = useStore((s) => s.pendingItems);

  if (!reportModalOpen) return null;

  const handleExportJSON = () => {
    const nextVersion = reportVersions.length + 1;
    const existing = reportVersions.find((r) => r.version === nextVersion);
    const version = existing ? nextVersion + 1 : nextVersion;

    const report = {
      version,
      timestamp: new Date().toISOString(),
      params,
      equations: {
        dxdt: `dx/dt = ${params.a}x + ${params.b}y`,
        dydt: `dy/dt = ${params.c}x + ${params.d}y`,
      },
      equilibria: equilibria.map((eq) => ({
        position: [eq.x, eq.y],
        type: EQ_TYPE_LABELS[eq.type],
        eigenvalues: eq.eigen.eigenvalues,
      })),
      trajectorySummary: {
        totalPoints: trajectories.length,
        startPoint: trajectories[0]
          ? [trajectories[0].x, trajectories[0].y]
          : null,
        endPoint: trajectories[trajectories.length - 1]
          ? [trajectories[trajectories.length - 1].x, trajectories[trajectories.length - 1].y]
          : null,
      },
      pendingItems,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phase-report-v${version}.json`;
    a.click();
    URL.revokeObjectURL(url);
    exportReport();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1b2e] border border-[#1a3050] rounded-2xl w-[520px] max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[#1a3050]">
          <h3 className="text-sm font-bold text-[#aabbcc]"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            课堂报告导出
          </h3>
          <button
            onClick={closeReportModal}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#667788] hover:text-[#FF6B4A] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-[#060e1a] rounded-xl p-4 space-y-2">
            <h4 className="text-xs text-[#667788] uppercase tracking-wider"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              参数摘要
            </h4>
            <div className="grid grid-cols-4 gap-2" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {(['a', 'b', 'c', 'd'] as const).map((key) => (
                <div key={key} className="text-center">
                  <div className="text-xs text-[#667788]">{key}</div>
                  <div className="text-sm text-[#aabbcc] font-bold">{params[key].toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#060e1a] rounded-xl p-4 space-y-2">
            <h4 className="text-xs text-[#667788] uppercase tracking-wider"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              平衡点
            </h4>
            {equilibria.map((eq) => (
              <div key={eq.id} className="text-xs text-[#aabbcc]"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                ({eq.x.toFixed(1)}, {eq.y.toFixed(1)}) — {EQ_TYPE_LABELS[eq.type]}
              </div>
            ))}
          </div>

          <div className="bg-[#060e1a] rounded-xl p-4 space-y-2">
            <h4 className="text-xs text-[#667788] uppercase tracking-wider"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              待办项
            </h4>
            {pendingItems.map((item) => (
              <div key={item.id} className="text-xs text-[#aabbcc]"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {item.label} [{item.status}] — {item.description}
              </div>
            ))}
          </div>

          {reportVersions.length > 0 && (
            <div className="bg-[#060e1a] rounded-xl p-4 space-y-2">
              <h4 className="text-xs text-[#667788] uppercase tracking-wider"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                历史版本
              </h4>
              {reportVersions.map((rv) => (
                <div key={rv.version} className="flex items-center gap-2 text-xs text-[#667788]"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  <Clock size={10} />
                  <span>v{rv.version}</span>
                  <span>{new Date(rv.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleExportJSON}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FF6B4A] text-white text-sm font-bold hover:bg-[#FF6B4A]/80 transition-colors"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              <Download size={16} />
              导出 JSON
            </button>
            <button
              onClick={closeReportModal}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#1a3050] text-[#667788] text-sm hover:text-[#aabbcc] transition-colors"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              取消
            </button>
          </div>

          <div className="text-[10px] text-[#445566] text-center"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            版本号自动递增，不会覆盖已有报告；重复编号将附加后缀
          </div>
        </div>
      </div>
    </div>
  );
}

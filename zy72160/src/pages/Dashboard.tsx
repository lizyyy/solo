import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Database, GitMerge, AlertTriangle, AlertCircle, ArrowRight, Clock, Import, FileText } from "lucide-react";
import { useAppStore } from "../store/app.store";
import StatusBadge from "../components/StatusBadge";

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Database; label: string; value: number | string; color: string }) {
  return (
    <div className="card">
      <div className="card-body flex items-center gap-4">
        <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-2xl font-serif font-bold text-ink">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

const actionIcons: Record<string, typeof Import> = {
  import: Import,
  merge: GitMerge,
  resolve: AlertTriangle,
  export: FileText,
  note_append: FileText,
};

function TimelineItem({ log }: { log: { action: string; actor: string; timestamp: string; detail: string } }) {
  const Icon = actionIcons[log.action] || Clock;
  return (
    <div className="flex gap-3 pb-4 last:pb-0">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-ochre-tint flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-ochre" />
        </div>
        <div className="w-px flex-1 bg-gray-200 mt-1" />
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <div className="text-sm text-ink">{log.detail}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          {log.actor} · {new Date(log.timestamp).toLocaleString("zh-CN")}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    currentBatch,
    summary,
    auditLogs,
    anomalies,
    conflicts,
    dashboardLoading,
    fetchDashboard,
    createBatch,
  } = useAppStore();

  useEffect(() => {
    if (currentBatch) {
      fetchDashboard(currentBatch.id);
    }
  }, [currentBatch, fetchDashboard]);

  if (!currentBatch) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="font-serif text-xl font-bold text-ink mb-2">暂无活跃批次</h2>
        <p className="text-sm text-gray-500 mb-6">请先创建一个批次以开始使用系统</p>
        <button
          className="btn-primary"
          onClick={async () => {
            const name = `批次 ${new Date().toLocaleDateString("zh-CN")}`;
            await createBatch(name);
          }}
        >
          创建新批次
        </button>
      </div>
    );
  }

  if (dashboardLoading && !summary) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 skeleton" />
          ))}
        </div>
        <div className="h-64 skeleton" />
      </div>
    );
  }

  const pendingItems = [
    ...conflicts.map((c) => ({
      id: c.id,
      type: "conflict" as const,
      title: `冲突: ${c.fieldName}`,
      mergedPointId: c.mergedPointId,
    })),
    ...anomalies.map((a) => ({
      id: a.id,
      type: "anomaly" as const,
      title: a.humanReadable,
      mergedPointId: a.mergedPointId,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl font-bold text-ink">项目总览</h2>
        <span className="text-sm text-gray-500">当前批次: {currentBatch.name}</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Database}
          label="数据来源数"
          value={summary?.importCount ?? 0}
          color="bg-source"
        />
        <StatCard
          icon={GitMerge}
          label="归并完成度"
          value={summary ? `${summary.mergedPointCount} 点位` : "0 点位"}
          color="bg-ochre"
        />
        <StatCard
          icon={AlertTriangle}
          label="待处理冲突"
          value={summary?.unresolvedConflictCount ?? 0}
          color="bg-conflict"
        />
        <StatCard
          icon={AlertCircle}
          label="异常数"
          value={summary?.anomalyCount ?? 0}
          color="bg-pending"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <h3 className="section-title">待处理事项</h3>
            <span className="text-xs text-gray-500">{pendingItems.length} 项</span>
          </div>
          <div className="card-body">
            {pendingItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">暂无待处理事项</div>
            ) : (
              <div className="space-y-2">
                {pendingItems.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border-l-[3px] hover:bg-gray-50 transition-colors ${
                      item.type === "conflict"
                        ? "border-l-conflict bg-red-50/50"
                        : "border-l-pending bg-amber-50/50"
                    }`}
                  >
                    <StatusBadge status={item.type === "conflict" ? "conflict" : "pending"} />
                    <span className="flex-1 text-sm text-ink truncate">{item.title}</span>
                    <button
                      className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                      onClick={() =>
                        item.type === "conflict"
                          ? navigate(`/review/${item.id}`)
                          : navigate("/review")
                      }
                    >
                      处理 <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="section-title">操作时间线</h3>
          </div>
          <div className="card-body max-h-80 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">暂无操作记录</div>
            ) : (
              auditLogs.slice(0, 8).map((log) => <TimelineItem key={log.id} log={log} />)
            )}
          </div>
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="section-title">异常摘要</h3>
            <span className="text-xs text-gray-500">{anomalies.length} 条异常</span>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {anomalies.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-sm bg-amber-50/50 border border-amber-100"
                >
                  <AlertCircle className="w-4 h-4 text-pending mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-ink">{a.humanReadable}</div>
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">
                      {a.type === "capacity_overlimit" ? "容量超限" : "时间段冲突"} ·{" "}
                      {new Date(a.detectedAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Palette, Wrench, AlertTriangle, Clock } from "lucide-react";
import { useStore } from "@/store/useStore";
import StatusBadge from "@/components/StatusBadge";
import AnomalyBadge from "@/components/AnomalyBadge";
import { RESTORATION_STATUS_LABELS } from "../../shared/types";

export default function Dashboard() {
  const { artworks, restorations, anomalies, fetchArtworks, fetchRestorations, fetchAnomalies } = useStore();

  useEffect(() => {
    fetchArtworks();
    fetchRestorations();
  }, [fetchArtworks, fetchRestorations]);

  const activeRestorations = restorations.filter(
    (r) => r.status === "in_progress" || r.status === "under_review"
  );

  const openAnomalies = anomalies.filter((a) => a.status === "open");

  const pendingReviews = restorations.filter((r) => r.status === "under_review");

  const recentRestorations = [...restorations]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  useEffect(() => {
    if (restorations.length > 0) {
      const firstRestoration = restorations[0];
      fetchAnomalies(firstRestoration.id);
    }
  }, [restorations, fetchAnomalies]);

  const summaryCards = [
    {
      label: "作品总数",
      value: artworks.length,
      icon: Palette,
      color: "text-primary",
      bg: "bg-primary-50",
    },
    {
      label: "进行中修复",
      value: activeRestorations.length,
      icon: Wrench,
      color: "text-amber",
      bg: "bg-amber-50",
    },
    {
      label: "未解决异常",
      value: openAnomalies.length,
      icon: AlertTriangle,
      color: "text-anomaly-red",
      bg: "bg-anomaly-red-50",
    },
    {
      label: "待审核",
      value: pendingReviews.length,
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl font-bold text-primary-800">仪表盘</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-400">{card.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: card.color === "text-primary" ? "#8B6914" : card.color === "text-amber" ? "#D4A843" : card.color === "text-anomaly-red" ? "#8B2500" : "#2563eb" }}>
                  {card.value}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${card.bg}`}>
                <card.icon size={24} className={card.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-serif text-lg font-semibold text-primary-800 mb-4">最近修复记录</h3>
          {recentRestorations.length === 0 ? (
            <p className="text-sm text-primary-300 py-8 text-center">暂无修复记录</p>
          ) : (
            <div className="space-y-3">
              {recentRestorations.map((r) => (
                <Link
                  key={r.id}
                  to={`/restorations/${r.id}`}
                  className="flex items-center justify-between p-3 rounded-md hover:bg-ivory-200 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-primary-800">{r.restorerName}</p>
                    <p className="text-xs text-primary-400 mt-0.5">
                      {new Date(r.startDate).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-serif text-lg font-semibold text-primary-800 mb-4">未解决异常</h3>
          {openAnomalies.length === 0 ? (
            <p className="text-sm text-primary-300 py-8 text-center">暂无未解决异常</p>
          ) : (
            <div className="space-y-3">
              {openAnomalies.map((a) => (
                <Link
                  key={a.id}
                  to={`/restorations/${a.restorationId}`}
                  className="flex items-center justify-between p-3 rounded-md hover:bg-ivory-200 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary-800 truncate">{a.description}</p>
                    <p className="text-xs text-primary-400 mt-0.5">
                      {new Date(a.detectedAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                  <AnomalyBadge anomaly={a} size="sm" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

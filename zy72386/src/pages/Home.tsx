import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Database,
  ClipboardCheck,
  AlertTriangle,
  ShieldCheck,
  Plus,
  Eye,
} from "lucide-react";
import useImportStore from "@/stores/importStore";
import useSelfcheckStore from "@/stores/selfcheckStore";
import PendingBanner from "@/components/PendingBanner";

export default function Home() {
  const navigate = useNavigate();
  const { importHistory, loading, fetchHistory } = useImportStore();
  const { results: selfcheckResults, fetchResults: fetchSelfcheck } =
    useSelfcheckStore();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const pendingCount = useMemo(() => {
    return importHistory.reduce((sum, item) => {
      return sum + (item.anomaly_count ?? 0);
    }, 0);
  }, [importHistory]);

  const totalAnomaly = useMemo(() => {
    return importHistory.reduce(
      (sum, item) => sum + (item.anomaly_count ?? 0),
      0
    );
  }, [importHistory]);

  const latestSelfcheckSummary = useMemo(() => {
    if (!selfcheckResults || selfcheckResults.length === 0) return "未执行";
    const latest = selfcheckResults[selfcheckResults.length - 1];
    if (latest.status === "pass") return "全部通过";
    if (latest.status === "warning") return "存在警告";
    if (latest.status === "fail") return "存在失败";
    return "未执行";
  }, [selfcheckResults]);

  const recentImports = useMemo(() => {
    return [...importHistory]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 5);
  }, [importHistory]);

  useEffect(() => {
    if (importHistory.length > 0) {
      const latestImport = importHistory[importHistory.length - 1];
      if (latestImport?.id) {
        fetchSelfcheck(latestImport.id);
      }
    }
  }, [importHistory, fetchSelfcheck]);

  const summaryCards = [
    {
      label: "总导入批次",
      value: importHistory.length,
      icon: Database,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "待复核项",
      value: pendingCount,
      icon: ClipboardCheck,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "异常记录",
      value: totalAnomaly,
      icon: AlertTriangle,
      color: "text-red-600 bg-red-50",
    },
    {
      label: "自检状态",
      value: latestSelfcheckSummary,
      icon: ShieldCheck,
      color:
        latestSelfcheckSummary === "全部通过"
          ? "text-emerald-600 bg-emerald-50"
          : "text-amber-600 bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      <PendingBanner
        count={pendingCount}
        onClick={() => navigate("/review")}
      />

      <div className="grid grid-cols-2 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${card.color}`}>
                <card.icon size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {card.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            最近导入记录
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            加载中...
          </div>
        ) : recentImports.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            暂无导入记录
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="px-5 py-3 text-left font-medium">
                    批次标签
                  </th>
                  <th className="px-5 py-3 text-left font-medium">文件名</th>
                  <th className="px-5 py-3 text-left font-medium">总行数</th>
                  <th className="px-5 py-3 text-left font-medium">异常数</th>
                  <th className="px-5 py-3 text-left font-medium">
                    导入时间
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentImports.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-50 transition hover:bg-gray-50"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {item.batch_label}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {item.file_name}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {item.total_rows}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          item.anomaly_count > 0
                            ? "font-medium text-red-600"
                            : "text-gray-600"
                        }
                      >
                        {item.anomaly_count}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {item.created_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate("/import")}
          className="flex items-center gap-2 rounded-lg bg-[#1B2A4A] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#24365e]"
        >
          <Plus size={16} />
          新建导入
        </button>
        <button
          onClick={() => navigate("/selfcheck")}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <Eye size={16} />
          查看自检
        </button>
      </div>
    </div>
  );
}

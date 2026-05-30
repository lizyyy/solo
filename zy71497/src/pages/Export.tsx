import { useState, useEffect } from "react";
import { Download, CheckCircle, AlertCircle, Database } from "lucide-react";
import { api } from "../api/client";

export default function Export() {
  const [exportType, setExportType] = useState<
    "checkins" | "transactions" | "leaves_makeups"
  >("transactions");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [exporting, setExporting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    download_url: string;
    record_count: number;
    db_total_count: number;
    is_consistent: boolean;
  } | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await api.export.exportData({
        type: exportType,
        from: fromDate,
        to: toDate,
      });
      setLastResult(result);
      if (result.download_url) {
        window.open(result.download_url, "_blank");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      checkins: "打卡明细",
      transactions: "星星流水",
      leaves_makeups: "请假补练记录",
    };
    return labels[type] || type;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-display text-secondary mb-2">数据导出</h1>
        <p className="text-gray-500">导出历史数据，并校验数据一致性</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-display text-lg text-secondary mb-4">导出配置</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                导出类型
              </label>
              <select
                value={exportType}
                onChange={(e) =>
                  setExportType(
                    e.target.value as "checkins" | "transactions" | "leaves_makeups"
                  )
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
              >
                <option value="checkins">打卡明细</option>
                <option value="transactions">星星流水</option>
                <option value="leaves_makeups">请假补练记录</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  开始日期
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  结束日期
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                />
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2 py-2 bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              <Download size={18} />
              {exporting ? "导出中..." : "导出 CSV"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-display text-lg text-secondary mb-4 flex items-center gap-2">
              <Database size={20} className="text-gold" />
              数据一致性校验
            </h2>

            {lastResult ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">导出类型</span>
                  <span className="font-medium">{getTypeLabel(exportType)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">日期范围</span>
                  <span className="font-medium">
                    {fromDate} ~ {toDate}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">导出记录数</span>
                  <span className="font-medium">{lastResult.record_count} 条</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">数据库总流水</span>
                  <span className="font-medium">
                    {lastResult.db_total_count} 条
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">一致性校验</span>
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                      lastResult.is_consistent
                        ? "bg-mint/10 text-mint"
                        : "bg-coral/10 text-coral"
                    }`}
                  >
                    {lastResult.is_consistent ? (
                      <>
                        <CheckCircle size={14} /> 一致 ✓
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} /> 不一致 ⚠
                      </>
                    )}
                  </span>
                </div>

                {lastResult.download_url && (
                  <a
                    href={lastResult.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-gold hover:underline text-sm"
                  >
                    <Download size={14} />
                    如未自动下载，点击此处下载
                  </a>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>请先执行导出以查看校验结果</p>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-medium text-blue-800 mb-3">📋 业务规则说明</h3>
            <ul className="text-sm text-blue-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-gold">①</span>
                <span>
                  <strong>数据持久化：</strong>所有数据存储在本地 SQLite
                  数据库文件（<code>data/piano_ledger.db</code>
                  ），重启服务或第二次运行后，历史记录和导出数字完全一致。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold">②</span>
                <span>
                  <strong>打卡归集：</strong>练琴时长 × 每分钟星数 =
                  当日获得星星；确认后不可被前端静默修改。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold">③</span>
                <span>
                  <strong>补练状态：</strong>一条请假只能补练一次，重复提交时系统强制拒绝并提示。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold">④</span>
                <span>
                  <strong>请假扣分：</strong>请假当日独立扣除星星，补练通过后返还星星；两条记录分别保留，不合并。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold">⑤</span>
                <span>
                  <strong>时长夸大：</strong>超过阈值仅作警告标记，不阻止提交；后端记录标注"时长异常"供后续核对。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold">⑥</span>
                <span>
                  <strong>规则修改：</strong>修改奖励规则只影响后续记录，已生成的流水不再回算。
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
            <h3 className="font-medium text-yellow-800 mb-2">⚠️ 风险提示（分开说明）</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>
                <strong>补练重复风险：</strong>
                已通过数据库唯一约束（UNIQUE(leave_id)）在底层阻止，但仍需注意业务侧是否有"多次补练"的真实需求。
              </li>
              <li>
                <strong>请假仍扣分风险：</strong>
                即使后续补练完成，请假扣分记录始终保留在流水中，这是设计意图而非 Bug——便于审计"该学生当月曾请假"的事实。
              </li>
              <li>
                <strong>时长夸大风险：</strong>
                系统仅标记不拦截，老师需结合实际情况判断；如后续需要强拦截，可在后端将"is_abnormal"加入确认逻辑。
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

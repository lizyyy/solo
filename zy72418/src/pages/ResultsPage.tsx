import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Download, Edit, UserPlus, FileText, RefreshCw, Filter } from "lucide-react";
import { api } from "@/api/client";
import { useAppStore } from "@/store/appStore";
import StatusBadge from "@/components/StatusBadge";
import type { RecordStatus, AudioRecord, ReviewSubstituteRequest } from "@shared/types";

export default function ResultsPage() {
  const { currentUser, setLoading, setError, records, recordsHash, setRecords } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">("all");
  const [pageHash, setPageHash] = useState("");

  const loadRecords = async () => {
    setLoading(true);
    try {
      const status = statusFilter === "all" ? undefined : statusFilter;
      const res = await api.records.list(status);
      setRecords(res.data, res.dataHash);
      setPageHash(res.dataHash);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [statusFilter]);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await api.records.export();
      const exportHash = res.headers.get("X-Data-Hash");

      console.log("数据一致性校验：");
      console.log("API Hash:", recordsHash);
      console.log("页面 Hash:", pageHash);
      console.log("导出 Hash:", exportHash);
      console.log("一致:", recordsHash === pageHash && pageHash === exportHash);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audio_records_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubstitute = async (recordId: string, approved: boolean) => {
    const reason = prompt(
      approved ? "请输入通过理由：" : "请输入驳回理由：",
      approved ? "信息核对无误，确认有效" : "资料不全，需补充信息"
    );
    if (reason === null) return;

    setLoading(true);
    try {
      await api.records.reviewSubstitute({
        recordId,
        approved,
        reason,
        operator: currentUser.name,
        operatorRole: "ticket",
      });
      await loadRecords();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const statusOptions: { value: RecordStatus | "all"; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "normal", label: "正常" },
    { value: "new", label: "新记录" },
    { value: "pending_review", label: "待票务复核" },
    { value: "conflict", label: "存在冲突" },
    { value: "duplicate_current", label: "本次重复" },
    { value: "duplicate_history", label: "历史重复" },
  ];

  const summaryStats = {
    total: records.length,
    normal: records.filter((r) => r.status === "normal").length,
    pending: records.filter((r) => r.status === "pending_review").length,
    conflict: records.filter((r) => r.status === "conflict").length,
    totalAmount: records.reduce((sum, r) => sum + r.amount, 0),
    totalSettlement: records.reduce((sum, r) => sum + (r.settlementAmount || 0), 0),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">总记录数</p>
          <p className="text-3xl font-bold text-gray-800">{summaryStats.total}</p>
        </div>
        <div className="card p-6 border-l-4 border-l-success-500">
          <p className="text-sm text-gray-500 mb-1">正常记录</p>
          <p className="text-3xl font-bold text-success-600">{summaryStats.normal}</p>
        </div>
        <div className="card p-6 border-l-4 border-l-warning-500">
          <p className="text-sm text-gray-500 mb-1">待复核</p>
          <p className="text-3xl font-bold text-warning-600">{summaryStats.pending}</p>
        </div>
        <div className="card p-6 border-l-4 border-l-danger-500">
          <p className="text-sm text-gray-500 mb-1">待处理冲突</p>
          <p className="text-3xl font-bold text-danger-600">{summaryStats.conflict}</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="input-field w-40"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-gray-500">
              数据校验：
              <span
                className={`ml-1 font-mono ${
                  recordsHash === pageHash ? "text-success-600" : "text-danger-600"
                }`}
              >
                {recordsHash === pageHash ? "✓ 一致" : "✗ 不一致"}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadRecords}
              className="btn-secondary flex items-center gap-2"
              disabled={useAppStore.getState().loading}
            >
              <RefreshCw
                size={16}
                className={useAppStore.getState().loading ? "animate-spin" : ""}
              />
              刷新
            </button>
            <button onClick={handleExport} className="btn-primary flex items-center gap-2">
              <Download size={16} />
              导出 CSV
            </button>
          </div>
        </div>

        <div className="card p-4 bg-gray-50 border-l-4 border-l-primary-500 mb-4">
          <div className="flex items-center gap-3 text-sm">
            <FileText size={18} className="text-primary-600" />
            <div>
              <span className="text-gray-600">分账汇总：</span>
              <span className="font-semibold text-gray-800">
                总金额 ¥{summaryStats.totalAmount.toFixed(2)}
              </span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="font-semibold text-primary-700">
                分账金额 ¥{summaryStats.totalSettlement.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin max-h-[600px]">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">状态</th>
                <th className="table-header">音频文件</th>
                <th className="table-header">课程名称</th>
                <th className="table-header">治疗师</th>
                <th className="table-header">日期</th>
                <th className="table-header">时长</th>
                <th className="table-header">原始金额</th>
                <th className="table-header">分账金额</th>
                <th className="table-header">授权到期</th>
                <th className="table-header">备注</th>
                <th className="table-header">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((record) => (
                <tr
                  key={record.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    record.isTemporarySubstitute
                      ? "border-l-4 border-l-warning-500 bg-warning-50/30"
                      : "even:bg-gray-50/50"
                  }`}
                >
                  <td className="table-cell">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="table-cell">
                    <div>
                      <p className="font-medium">{record.audioFileName}</p>
                      <p className="text-xs text-gray-400 font-mono">
                        {record.audioFileId}
                      </p>
                    </div>
                  </td>
                  <td className="table-cell">{record.courseName}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      {record.isTemporarySubstitute && (
                        <UserPlus size={14} className="text-warning-500" />
                      )}
                      <span
                        className={
                          record.isTemporarySubstitute ? "text-warning-700 font-medium" : ""
                        }
                      >
                        {record.therapistName}
                      </span>
                    </div>
                    {record.isTemporarySubstitute && (
                      <p className="text-xs text-warning-600">
                        来源：
                        {record.substituteSource === "group_message"
                          ? "群消息"
                          : "音频备注"}
                      </p>
                    )}
                  </td>
                  <td className="table-cell">{record.sessionDate}</td>
                  <td className="table-cell">{record.duration}分钟</td>
                  <td className="table-cell font-medium">¥{record.amount.toFixed(2)}</td>
                  <td className="table-cell font-semibold text-primary-700">
                    ¥{(record.settlementAmount || 0).toFixed(2)}
                  </td>
                  <td className="table-cell">{record.authorizationExpiryDate}</td>
                  <td className="table-cell max-w-[200px]">
                    <p className="truncate" title={record.remark}>
                      {record.remark}
                    </p>
                    {record.errorNote && (
                      <p className="text-xs text-danger-600 mt-1">
                        误差：{record.errorNote}
                      </p>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <Link
                        to={`/supplement/${record.id}`}
                        className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-sm"
                      >
                        <Edit size={14} />
                        补录
                      </Link>
                      {record.status === "pending_review" &&
                        currentUser.role === "coordinator" && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleReviewSubstitute(record.id, true)}
                              className="text-success-600 hover:text-success-800 text-xs px-2 py-1 bg-success-50 rounded"
                            >
                              通过
                            </button>
                            <button
                              onClick={() => handleReviewSubstitute(record.id, false)}
                              className="text-danger-600 hover:text-danger-800 text-xs px-2 py-1 bg-danger-50 rounded"
                            >
                              驳回
                            </button>
                          </div>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

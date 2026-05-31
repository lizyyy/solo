import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  SearchCheck,
  Check,
  X,
  AlertTriangle,
  User,
  Clock,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/store";
import type { Record } from "@/types";

export function ReviewPage() {
  const navigate = useNavigate();
  const { records, updateRecordStatus, getCurrentUser, users } = useAppStore();
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentUser = getCurrentUser();
  const pendingRecords = records.filter((r) => r.status === "pending");
  const selectedRecord = records.find((r) => r.id === selectedRecordId);

  useEffect(() => {
    if (canvasRef.current && records.length > 0) {
      drawZeroDriftChart();
    }
  }, [records, selectedRecordId]);

  const drawZeroDriftChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.fillStyle = "#1a2332";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#2f3d54";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    const zeroLineY = padding.top + chartHeight / 2;
    ctx.strokeStyle = "#d4a843";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroLineY);
    ctx.lineTo(width - padding.right, zeroLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    const upperLimitY =
      padding.top + chartHeight / 2 - (0.02 / 0.05) * (chartHeight / 2);
    const lowerLimitY =
      padding.top + chartHeight / 2 + (0.02 / 0.05) * (chartHeight / 2);
    ctx.strokeStyle = "#c94040";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padding.left, upperLimitY);
    ctx.lineTo(width - padding.right, upperLimitY);
    ctx.moveTo(padding.left, lowerLimitY);
    ctx.lineTo(width - padding.right, lowerLimitY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#9aa7b8";
    ctx.font = "11px JetBrains Mono";
    ctx.textAlign = "right";
    ctx.fillText("+0.05", padding.left - 8, padding.top + 4);
    ctx.fillText("+0.02", padding.left - 8, upperLimitY + 4);
    ctx.fillText("0", padding.left - 8, zeroLineY + 4);
    ctx.fillText("-0.02", padding.left - 8, lowerLimitY + 4);
    ctx.fillText("-0.05", padding.left - 8, height - padding.bottom + 4);

    const sortedRecords = [...records].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (sortedRecords.length === 0) return;

    const xStep =
      sortedRecords.length > 1
        ? chartWidth / (sortedRecords.length - 1)
        : chartWidth;

    const getY = (drift: number) => {
      const clamped = Math.max(-0.05, Math.min(0.05, drift));
      return zeroLineY - (clamped / 0.05) * (chartHeight / 2);
    };

    ctx.strokeStyle = "#d4a843";
    ctx.lineWidth = 2;
    ctx.beginPath();
    sortedRecords.forEach((r, i) => {
      const x = padding.left + i * xStep;
      const y = getY(r.zeroDrift);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    sortedRecords.forEach((r, i) => {
      const x = padding.left + i * xStep;
      const y = getY(r.zeroDrift);
      const isSelected = r.id === selectedRecordId;
      const isOverLimit = Math.abs(r.zeroDrift) > 0.02;

      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isOverLimit ? "#c94040" : "#3a9a5c";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#d4a843" : "transparent";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    if (selectedRecord) {
      const idx = sortedRecords.findIndex((r) => r.id === selectedRecord.id);
      if (idx >= 0) {
        const x = padding.left + idx * xStep;
        const y = getY(selectedRecord.zeroDrift);
        ctx.fillStyle = "rgba(212, 168, 67, 0.9)";
        const text = `漂移: ${selectedRecord.zeroDrift.toFixed(3)}mm`;
        const textWidth = ctx.measureText(text).width + 12;
        const tooltipX = Math.min(
          x + 8,
          width - padding.right - textWidth - 4
        );
        ctx.fillRect(tooltipX, y - 20, textWidth, 18);
        ctx.fillStyle = "#1a2332";
        ctx.font = "11px JetBrains Mono";
        ctx.textAlign = "left";
        ctx.fillText(text, tooltipX + 6, y - 7);
      }
    }

    ctx.fillStyle = "#9aa7b8";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(
      `阈值线: ±0.02mm (红色虚线) · 共 ${records.length} 条记录`,
      width / 2,
      height - 8
    );
  };

  const handleApprove = (recordId: string) => {
    if (!currentUser) {
      alert("请先设置操作人");
      return;
    }
    updateRecordStatus(recordId, "reviewed", "零点漂移复核通过");
    if (selectedRecordId === recordId) {
      setSelectedRecordId(null);
    }
  };

  const handleRejectClick = (recordId: string) => {
    if (!currentUser) {
      alert("请先设置操作人");
      return;
    }
    setSelectedRecordId(recordId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleConfirmReject = () => {
    if (!selectedRecordId || !rejectReason.trim()) {
      alert("请填写驳回原因");
      return;
    }
    updateRecordStatus(
      selectedRecordId,
      "rejected",
      rejectReason.trim(),
      rejectReason.trim()
    );
    setShowRejectModal(false);
    setRejectReason("");
    setSelectedRecordId(null);
  };

  const getOperatorName = (id: string) => {
    return users.find((u) => u.id === id)?.name || "未知";
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="card max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-lab-accent mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-2">请先设置操作人</h2>
          <p className="text-sm text-lab-textMuted mb-4">
            所有操作都会记录操作人信息，请先在左下角设置当前操作人
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-lab-text flex items-center gap-2">
          <SearchCheck className="w-6 h-6 text-lab-accent" />
          复核
        </h1>
        <p className="text-sm text-lab-textMuted mt-1">
          检查零点漂移，审核待处理记录
        </p>
      </div>

      <div className="card">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-lab-accent" />
          零点漂移趋势图
        </h3>
        <div className="bg-lab-bg rounded-lg p-3">
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ height: "220px" }}
          />
        </div>
        <p className="text-xs text-lab-textMuted mt-2">
          提示：点击图上的数据点可查看对应记录。红色虚线为阈值（±0.02mm），超限点标记为红色。
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-2">
        <div className="card col-span-2">
          <h3 className="font-medium mb-3">
            待处理记录
            <span className="badge badge-pending ml-2">
              {pendingRecords.length}
            </span>
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {pendingRecords.length === 0 ? (
              <div className="text-center py-8 text-lab-textMuted text-sm">
                暂无待处理记录
              </div>
            ) : (
              pendingRecords.map((record) => (
                <button
                  key={record.id}
                  onClick={() => setSelectedRecordId(record.id)}
                  className={`w-full text-left p-3 rounded border transition-all ${
                    selectedRecordId === record.id
                      ? "border-lab-accent bg-lab-accent/10 shadow-glow-amber"
                      : "border-lab-bgLighter hover:bg-lab-bgLighter/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`badge ${
                            record.source === "sensor"
                              ? "badge-source-sensor"
                              : "badge-source-manual"
                          }`}
                        >
                          {record.source === "sensor" ? "传感器" : "手动"}
                        </span>
                        <span
                          className={`badge ${
                            Math.abs(record.zeroDrift) > 0.02
                              ? "badge-rejected"
                              : "badge-reviewed"
                          }`}
                        >
                          漂移 {record.zeroDrift.toFixed(3)}mm
                        </span>
                      </div>
                      <p className="font-medium text-sm truncate">
                        {record.experimentName}
                      </p>
                      <p className="text-xs text-lab-textMuted mt-0.5 truncate">
                        {record.studentName || "未填写学生"}
                        {record.studentId && ` (${record.studentId})`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-lab-textMuted flex-shrink-0 mt-1" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card col-span-3">
          <h3 className="font-medium mb-3">记录详情</h3>
          {selectedRecord ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-lab-textMuted">实验名称</label>
                  <p className="font-medium">{selectedRecord.experimentName}</p>
                </div>
                <div>
                  <label className="text-xs text-lab-textMuted">来源</label>
                  <p>
                    <span
                      className={`badge ${
                        selectedRecord.source === "sensor"
                          ? "badge-source-sensor"
                          : "badge-source-manual"
                      }`}
                    >
                      {selectedRecord.source === "sensor"
                        ? "传感器日志"
                        : "手动录入"}
                    </span>
                    {selectedRecord.sensorLogId && (
                      <span className="text-xs text-lab-textMuted ml-2 font-mono">
                        {selectedRecord.sensorLogId}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-lab-textMuted">学生信息</label>
                  <p className="font-mono text-sm">
                    {selectedRecord.studentName || "-"}
                    {selectedRecord.studentId && (
                      <span className="text-lab-textMuted ml-2">
                        {selectedRecord.studentId}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-lab-textMuted">状态</label>
                  <p>
                    <span className="badge badge-pending">待处理</span>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-lab-textMuted">理论焦距</label>
                  <p className="font-mono">
                    {selectedRecord.focalLength.toFixed(3)} mm
                  </p>
                </div>
                <div>
                  <label className="text-xs text-lab-textMuted">实测焦距</label>
                  <p className="font-mono">
                    {selectedRecord.measuredFocalLength.toFixed(3)} mm
                  </p>
                </div>
                <div>
                  <label className="text-xs text-lab-textMuted">物距</label>
                  <p className="font-mono">
                    {selectedRecord.objectDistance.toFixed(3)} mm
                  </p>
                </div>
                <div>
                  <label className="text-xs text-lab-textMuted">像距</label>
                  <p className="font-mono">
                    {selectedRecord.imageDistance.toFixed(3)} mm
                  </p>
                </div>
                <div>
                  <label className="text-xs text-lab-textMuted">零点漂移</label>
                  <p
                    className={`font-mono font-medium ${
                      Math.abs(selectedRecord.zeroDrift) > 0.02
                        ? "text-lab-danger"
                        : "text-lab-success"
                    }`}
                  >
                    {selectedRecord.zeroDrift.toFixed(3)} mm
                    {Math.abs(selectedRecord.zeroDrift) > 0.02 && (
                      <span className="text-xs ml-1">(超限)</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-lab-textMuted">总误差</label>
                  <p className="font-mono">
                    {selectedRecord.error.toFixed(3)} mm
                  </p>
                </div>
              </div>

              <div className="border-t border-lab-bgLighter pt-4">
                <label className="text-xs text-lab-textMuted block mb-1">
                  进入待处理原因
                </label>
                <p className="text-sm bg-lab-bg p-2 rounded border border-lab-bgLighter">
                  {selectedRecord.pendingReason}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-lab-textMuted">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  操作人：{getOperatorName(selectedRecord.operatorId)}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  创建时间：{formatTime(selectedRecord.createdAt)}
                </div>
              </div>

              <div className="border-t border-lab-bgLighter pt-4 flex justify-end gap-2">
                <button
                  onClick={() =>
                    navigate(`/correction?recordId=${selectedRecord.id}`)
                  }
                  className="btn-secondary text-sm"
                >
                  去修正标定表
                </button>
                <button
                  onClick={() => handleRejectClick(selectedRecord.id)}
                  className="btn-danger text-sm"
                >
                  <X className="w-4 h-4 inline mr-1" />
                  驳回
                </button>
                <button
                  onClick={() => handleApprove(selectedRecord.id)}
                  className="btn-success text-sm"
                >
                  <Check className="w-4 h-4 inline mr-1" />
                  通过
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-lab-textMuted text-sm">
              选择左侧记录查看详情
            </div>
          )}
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md">
            <h3 className="font-medium mb-2">驳回原因</h3>
            <p className="text-sm text-lab-textMuted mb-4">
              请填写驳回原因，将作为历史记录保存
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="如：零点漂移超限，请重新测量..."
              rows={3}
              className="input-field resize-none mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="btn-secondary text-sm"
              >
                取消
              </button>
              <button
                onClick={handleConfirmReject}
                className="btn-danger text-sm"
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  PenTool,
  Save,
  AlertCircle,
  Info,
  User,
  Clock,
  ArrowLeftRight,
  Check,
} from "lucide-react";
import { useAppStore } from "@/store";
import type { CalibrationEntry, Record as LensRecord } from "@/types";

export function CorrectionPage() {
  const [searchParams] = useSearchParams();
  const initialRecordId = searchParams.get("recordId");

  const { records, updateCalibrationTable, getCurrentUser, users, history } =
    useAppStore();
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(
    initialRecordId
  );
  const [editingTable, setEditingTable] = useState<CalibrationEntry[]>([]);
  const [originalTable, setOriginalTable] = useState<CalibrationEntry[]>([]);
  const [reason, setReason] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const currentUser = getCurrentUser();
  const selectedRecord = records.find((r) => r.id === selectedRecordId);

  const reviewedRecords = useMemo(
    () => records.filter((r) => r.status === "reviewed"),
    [records]
  );

  const modifiedCells = useMemo(() => {
    const modified: { [key: string]: { old: number; new: number } } = {};
    editingTable.forEach((entry, idx) => {
      const original = originalTable[idx];
      if (!original) return;
      if (entry.measuredValue !== original.measuredValue) {
        modified[`${entry.id}-measured`] = {
          old: original.measuredValue,
          new: entry.measuredValue,
        };
      }
      if (entry.theoreticalValue !== original.theoreticalValue) {
        modified[`${entry.id}-theoretical`] = {
          old: original.theoreticalValue,
          new: entry.theoreticalValue,
        };
      }
    });
    return modified;
  }, [editingTable, originalTable]);

  const hasChanges = Object.keys(modifiedCells).length > 0;

  useEffect(() => {
    if (selectedRecord) {
      setEditingTable(
        selectedRecord.calibrationTable.map((e) => ({ ...e }))
      );
      setOriginalTable(
        selectedRecord.calibrationTable.map((e) => ({ ...e }))
      );
      setReason("");
    } else {
      setEditingTable([]);
      setOriginalTable([]);
      setReason("");
    }
  }, [selectedRecordId]);

  const handleCellChange = (
    entryId: string,
    field: "measuredValue" | "theoreticalValue",
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setEditingTable((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry;
        const updated = { ...entry, [field]: numValue };
        updated.error = parseFloat(
          (updated.measuredValue - updated.theoreticalValue).toFixed(3)
        );
        return updated;
      })
    );
  };

  const handleSave = () => {
    if (!selectedRecordId || !hasChanges) return;
    if (!currentUser) {
      alert("请先设置操作人");
      return;
    }
    if (!reason.trim()) {
      alert("请填写修正原因");
      return;
    }
    updateCalibrationTable(
      selectedRecordId,
      editingTable,
      reason.trim()
    );
    setOriginalTable(editingTable.map((e) => ({ ...e })));
    setReason("");
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleAddRow = () => {
    if (!selectedRecordId) return;
    const now = new Date().toISOString();
    const newEntry: CalibrationEntry = {
      id: `new-${Date.now()}`,
      label: `测量点${editingTable.length + 1}`,
      theoreticalValue: 0,
      measuredValue: 0,
      error: 0,
      createdAt: now,
      updatedAt: now,
    };
    setEditingTable((prev) => [...prev, newEntry]);
  };

  const handleRemoveRow = (entryId: string) => {
    if (editingTable.length <= 1) {
      alert("标定表至少保留一行");
      return;
    }
    setEditingTable((prev) => prev.filter((e) => e.id !== entryId));
  };

  const totalError = useMemo(
    () => editingTable.reduce((sum, e) => sum + e.error, 0),
    [editingTable]
  );

  const originalTotalError = useMemo(
    () => originalTable.reduce((sum, e) => sum + e.error, 0),
    [originalTable]
  );

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

  const getLastCorrection = (recordId: string) => {
    return history
      .filter(
        (h) => h.recordId === recordId && h.action === "calibration_correct"
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-lab-text flex items-center gap-2">
            <PenTool className="w-6 h-6 text-lab-accent" />
            修正
          </h1>
          <p className="text-sm text-lab-textMuted mt-1">
            编辑标定表，修正后自动写入历史记录
          </p>
        </div>
        {showSuccess && (
          <div className="flex items-center gap-2 text-lab-success bg-lab-success/10 px-3 py-2 rounded border border-lab-success/30">
            <Check className="w-4 h-4" />
            <span className="text-sm">修正已保存</span>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-medium mb-3">选择已复核记录</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
          {reviewedRecords.length === 0 ? (
            <div className="col-span-full text-center py-4 text-lab-textMuted text-sm">
              暂无已复核记录，请先在复核页审核通过
            </div>
          ) : (
            reviewedRecords.map((record) => (
              <button
                key={record.id}
                onClick={() => setSelectedRecordId(record.id)}
                className={`text-left p-3 rounded border transition-all ${
                  selectedRecordId === record.id
                    ? "border-lab-accent bg-lab-accent/10 shadow-glow-amber"
                    : "border-lab-bgLighter hover:bg-lab-bgLighter/50"
                }`}
              >
                <p className="font-medium text-sm truncate">
                  {record.experimentName}
                </p>
                <p className="text-xs text-lab-textMuted mt-0.5">
                  {record.studentName || "-"} · 误差{" "}
                  {record.error.toFixed(3)}mm
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {selectedRecord && (
        <>
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-medium mb-1">
                  {selectedRecord.experimentName}
                </h3>
                <div className="flex items-center gap-4 text-xs text-lab-textMuted">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {getOperatorName(selectedRecord.operatorId)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(selectedRecord.createdAt)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm">
                  理论焦距：
                  <span className="font-mono ml-1">
                    {selectedRecord.focalLength.toFixed(3)} mm
                  </span>
                </div>
                <div className="text-sm">
                  实测焦距：
                  <span className="font-mono ml-1">
                    {selectedRecord.measuredFocalLength.toFixed(3)} mm
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-lab-bgLighter">
                    <th className="text-left py-2 px-3 text-lab-textMuted font-medium">
                      测量点
                    </th>
                    <th className="text-right py-2 px-3 text-lab-textMuted font-medium">
                      理论值 (mm)
                    </th>
                    <th className="text-right py-2 px-3 text-lab-textMuted font-medium">
                      实测值 (mm)
                    </th>
                    <th className="text-right py-2 px-3 text-lab-textMuted font-medium">
                      误差 (mm)
                    </th>
                    <th className="text-center py-2 px-3 text-lab-textMuted font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {editingTable.map((entry, idx) => {
                    const isModifiedMeasured =
                      !!modifiedCells[`${entry.id}-measured`];
                    const isModifiedTheoretical =
                      !!modifiedCells[`${entry.id}-theoretical`];
                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-lab-bgLighter/50 hover:bg-lab-bg/50"
                      >
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={entry.label}
                            onChange={(e) =>
                              setEditingTable((prev) =>
                                prev.map((item) =>
                                  item.id === entry.id
                                    ? { ...item, label: e.target.value }
                                    : item
                                )
                              )
                            }
                            className="w-full bg-transparent border-b border-transparent focus:border-lab-accent outline-none font-mono"
                          />
                        </td>
                        <td className="py-2 px-3 relative">
                          <div
                            className={`relative ${
                              isModifiedTheoretical
                                ? "bg-lab-accent/20 -mx-1 px-1 rounded"
                                : ""
                            }`}
                          >
                            <input
                              type="number"
                              step="0.001"
                              value={entry.theoreticalValue}
                              onChange={(e) =>
                                handleCellChange(
                                  entry.id,
                                  "theoreticalValue",
                                  e.target.value
                                )
                              }
                              className="w-full text-right bg-transparent border-b border-transparent focus:border-lab-accent outline-none"
                            />
                            {isModifiedTheoretical && (
                              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-lab-bg border border-lab-accent px-2 py-1 rounded text-xs whitespace-nowrap z-10">
                                原值:{" "}
                                {
                                  modifiedCells[`${entry.id}-theoretical`]
                                    ?.old
                                }
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 relative">
                          <div
                            className={`relative ${
                              isModifiedMeasured
                                ? "bg-lab-accent/20 -mx-1 px-1 rounded"
                                : ""
                            }`}
                          >
                            <input
                              type="number"
                              step="0.001"
                              value={entry.measuredValue}
                              onChange={(e) =>
                                handleCellChange(
                                  entry.id,
                                  "measuredValue",
                                  e.target.value
                                )
                              }
                              className="w-full text-right bg-transparent border-b border-transparent focus:border-lab-accent outline-none"
                            />
                            {isModifiedMeasured && (
                              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-lab-bg border border-lab-accent px-2 py-1 rounded text-xs whitespace-nowrap z-10">
                                原值:{" "}
                                {modifiedCells[`${entry.id}-measured`]?.old}
                              </div>
                            )}
                          </div>
                        </td>
                        <td
                          className={`py-2 px-3 text-right ${
                            Math.abs(entry.error) > 0.02
                              ? "text-lab-danger"
                              : "text-lab-success"
                          }`}
                        >
                          {entry.error.toFixed(3)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleRemoveRow(entry.id)}
                            className="text-lab-textMuted hover:text-lab-danger transition-colors"
                            title="删除行"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-lab-bgLighter bg-lab-bg/50">
                    <td className="py-3 px-3 font-medium" colSpan={3}>
                      <span className="flex items-center gap-2">
                        <ArrowLeftRight className="w-4 h-4 text-lab-accent" />
                        标定表误差合计
                      </span>
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-bold ${
                        Math.abs(totalError - (selectedRecord?.error || 0)) >
                        0.001
                          ? "text-lab-danger"
                          : "text-lab-success"
                      }`}
                    >
                      {totalError.toFixed(3)}
                      {hasChanges && (
                        <span className="text-xs text-lab-textMuted ml-2">
                          (原: {originalTotalError.toFixed(3)})
                        </span>
                      )}
                    </td>
                    <td />
                  </tr>
                  <tr className="bg-lab-bg/30">
                    <td className="py-2 px-3 font-medium" colSpan={3}>
                      记录总误差（保持一致）
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {selectedRecord.error.toFixed(3)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleAddRow}
                className="btn-secondary text-sm"
              >
                + 添加测量点
              </button>
            </div>
          </div>

          {hasChanges && (
            <div className="card border-lab-accent/50 bg-lab-accent/5">
              <div className="flex items-start gap-2 mb-3">
                <Info className="w-4 h-4 text-lab-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">检测到 {Object.keys(modifiedCells).length} 处修改</p>
                  <p className="text-xs text-lab-textMuted mt-1">
                    保存后将自动写入历史记录，包含修改前后对比
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-lab-textMuted mb-1">
                    修正原因 *
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="如：零点漂移修正、标定值调整、传感器校准..."
                    rows={2}
                    className="input-field resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={!reason.trim()}
                    className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4 inline mr-1" />
                    保存修正
                  </button>
                </div>
              </div>
            </div>
          )}

          {(() => {
            const lastCorr = getLastCorrection(selectedRecord.id);
            if (!lastCorr) return null;
            return (
              <div className="card">
                <h3 className="font-medium mb-2 text-sm">最近一次修正</h3>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-lab-textMuted" />
                    {getOperatorName(lastCorr.operatorId)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-lab-textMuted" />
                    {formatTime(lastCorr.createdAt)}
                  </span>
                </div>
                <p className="text-sm bg-lab-bg p-2 rounded border border-lab-bgLighter mt-2">
                  {lastCorr.reason}
                </p>
              </div>
            );
          })()}
        </>
      )}

      {!selectedRecord && reviewedRecords.length > 0 && (
        <div className="card text-center py-12">
          <Info className="w-10 h-10 text-lab-textMuted mx-auto mb-3" />
          <p className="text-lab-textMuted">选择上方记录开始修正</p>
        </div>
      )}
    </div>
  );
}

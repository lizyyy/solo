import {
  X,
  FileText,
  ShieldCheck,
  Upload,
  FileWarning,
  ArrowLeftRight,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Flame,
} from "lucide-react";
import { useReviewStore } from "@/store/reviewStore";
import { mapSpareFields, isFieldProtected } from "@/utils/fieldMapper";
import { getStatusConsistencyBadge } from "@/utils/consistencyChecker";
import type { AlertStatus, ConclusionFile } from "@/types";
import { useState } from "react";

const statusOptions: { value: AlertStatus; label: string; icon: any; cls: string }[] = [
  { value: "pending", label: "待复核", icon: Clock, cls: "badge-pending" },
  { value: "reviewing", label: "复核中", icon: FileWarning, cls: "badge-reviewing" },
  { value: "approved", label: "已通过", icon: CheckCircle2, cls: "badge-approved" },
  { value: "rejected", label: "已驳回", icon: XCircle, cls: "badge-rejected" },
];

export default function DetailDrawer() {
  const {
    selectedRecordId,
    selectRecord,
    records,
    fieldMappings,
    updateRecordStatus,
    updateRecordRemark,
    updateRecordConclusion,
  } = useReviewStore();
  const record = records.find((r) => r.id === selectedRecordId);
  const [localRemark, setLocalRemark] = useState(record?.remark ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  if (!record) return null;

  const mapped = mapSpareFields(record.sparePartsFields, fieldMappings);
  const consistency = getStatusConsistencyBadge(record);

  const triggerSavedToast = () => {
    setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    setTimeout(() => setSavedAt(null), 1500);
  };

  const onRemarkBlur = () => {
    updateRecordRemark(record.id, localRemark);
    triggerSavedToast();
  };

  const onUploadFile = () => {
    const file: ConclusionFile = {
      name: `复核结论_${record.unifiedDeviceId}_${Date.now()}.pdf`,
      uploadedAt: new Date().toISOString(),
      conclusion: record.status === "approved" ? "pass" : record.status === "rejected" ? "fail" : "pending",
    };
    updateRecordConclusion(record.id, file);
    triggerSavedToast();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      <div
        className="absolute inset-0 bg-industrial-900/30 backdrop-blur-[1px]"
        onClick={() => selectRecord(null)}
      />
      <div className="relative w-[560px] bg-white shadow-drawer animate-slide-in-right flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-industrial-800">
                  复核详情
                </h3>
                <span
                  className={`badge ${consistency.isConsistent ? "badge-approved" : "badge-temp"}`}
                >
                  {consistency.isConsistent ? (
                    <ShieldCheck size={12} strokeWidth={2.5} />
                  ) : (
                    <ShieldAlert size={12} strokeWidth={2.5} />
                  )}
                  <span>{consistency.message}</span>
                </span>
              </div>
              <p className="font-mono text-sm text-industrial-600">
                {record.unifiedDeviceId}
              </p>
            </div>
            <button
              onClick={() => selectRecord(null)}
              className="p-1.5 rounded-industrial hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <X size={20} strokeWidth={2} />
            </button>
          </div>

          {savedAt && (
            <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-success-400 to-transparent animate-pulse-soft" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {record.isTempThresholdAdjusted && (
              <div className="bg-alert-50 border-2 border-alert-200 rounded-industrial p-4">
                <div className="flex items-center gap-2 mb-2 text-alert-700 font-semibold">
                  <Flame size={18} strokeWidth={2} />
                  <span>阈值临时调高记录 — 已单独拎出标记</span>
                </div>
                <div className="space-y-1 text-sm text-alert-800">
                  <p>
                    <span className="text-alert-600 font-medium">调整原因：</span>
                    {record.tempAdjustReason}
                  </p>
                  <div className="flex gap-6">
                    <p>
                      <span className="text-alert-600 font-medium">审批人：</span>
                      {record.tempAdjustApprover}
                    </p>
                    <p>
                      <span className="text-alert-600 font-medium">审批时间：</span>
                      {record.tempAdjustTime &&
                        new Date(record.tempAdjustTime).toLocaleString("zh-CN")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <section>
              <div className="flex items-center gap-2 mb-3 text-industrial-700 font-semibold text-sm">
                <ArrowLeftRight size={16} strokeWidth={2} />
                <span>设备编号归一化对照</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-industrial-600/5 border border-industrial-200 rounded-industrial p-3">
                  <p className="text-[10px] text-industrial-500 uppercase tracking-wider mb-1 font-semibold">
                    统一编号
                  </p>
                  <p className="font-mono font-bold text-industrial-700">
                    {record.unifiedDeviceId}
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-industrial p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-semibold">
                    原始写法（不统一）
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {record.originalDeviceIds.map((id, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-industrial text-xs font-mono text-gray-600 italic"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3 text-industrial-700 font-semibold text-sm">
                <User size={16} strokeWidth={2} />
                <span>处理状态</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {statusOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = record.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        updateRecordStatus(record.id, opt.value);
                        triggerSavedToast();
                      }}
                      className={`p-3 rounded-industrial border-2 transition-all text-left ${
                        active
                          ? "border-industrial-500 bg-industrial-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-industrial-300"
                      }`}
                    >
                      <Icon
                        size={16}
                        className={active ? "text-industrial-600" : "text-gray-400"}
                        strokeWidth={2}
                      />
                      <p
                        className={`mt-1 text-sm font-medium ${
                          active ? "text-industrial-700" : "text-gray-600"
                        }`}
                      >
                        {opt.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-industrial-700 font-semibold text-sm">
                  <FileText size={16} strokeWidth={2} />
                  <span>复核人备注</span>
                </div>
                {savedAt && (
                  <span className="text-[11px] text-success-600 animate-fade-in">
                    ✓ 已自动保存 · {savedAt}
                  </span>
                )}
              </div>
              <textarea
                value={localRemark}
                onChange={(e) => setLocalRemark(e.target.value)}
                onBlur={onRemarkBlur}
                rows={4}
                placeholder="输入复核意见、备注信息、处理说明...（失焦自动保存）"
                className="input-field resize-none font-serif text-sm leading-relaxed"
              />
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3 text-industrial-700 font-semibold text-sm">
                <Upload size={16} strokeWidth={2} />
                <span>结论文件</span>
              </div>
              {record.conclusionFile ? (
                <div className="bg-success-50 border border-success-200 rounded-industrial p-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-industrial border border-success-200">
                      <FileText size={20} className="text-success-600" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {record.conclusionFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        上传于 {new Date(record.conclusionFile.uploadedAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        record.conclusionFile.conclusion === "pass"
                          ? "badge-approved"
                          : record.conclusionFile.conclusion === "fail"
                          ? "badge-rejected"
                          : "badge-pending"
                      }`}
                    >
                      {record.conclusionFile.conclusion === "pass"
                        ? "文件结论：通过"
                        : record.conclusionFile.conclusion === "fail"
                        ? "文件结论：驳回"
                        : "待确认"}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={onUploadFile}
                  className="w-full p-6 border-2 border-dashed border-gray-300 rounded-industrial hover:border-industrial-400 hover:bg-industrial-50/40 transition-all group"
                >
                  <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-industrial-600">
                    <Upload size={24} strokeWidth={1.5} />
                    <span className="text-sm">点击上传结论文件（模拟）</span>
                    <span className="text-xs text-gray-400">
                      支持 PDF / Word / Excel，状态、备注、文件结论将自动比对
                    </span>
                  </div>
                </button>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-industrial-700 font-semibold text-sm">
                  <ShieldCheck size={16} strokeWidth={2} />
                  <span>备件清单字段映射</span>
                </div>
                <span className="text-[11px] text-gray-400">
                  带 🔒 的字段为受保护字段（来源、处理状态）
                </span>
              </div>
              <div className="border border-gray-200 rounded-industrial overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-muted">
                      <th className="px-3 py-2 text-left font-semibold text-industrial-700 w-1/3">
                        备件原始字段名
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-industrial-700 w-10 text-center">
                        →
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-industrial-700 w-1/3">
                        系统字段
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-industrial-700">
                        值
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(mapped).map(([spareKey, info], i) => {
                      const protectedField =
                        info.isProtected ||
                        isFieldProtected(info.systemField, fieldMappings);
                      return (
                        <tr
                          key={spareKey}
                          className={`border-t border-gray-100 ${
                            protectedField ? "bg-amber-50/50" : i % 2 ? "bg-gray-50/50" : ""
                          }`}
                        >
                          <td className="px-3 py-2 text-gray-500 italic font-serif">
                            {protectedField && "🔒 "}
                            {spareKey}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-300">→</td>
                          <td className="px-3 py-2 font-mono text-industrial-700 font-semibold">
                            {info.systemField}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{info.value}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            <span>创建：{new Date(record.createdAt).toLocaleString("zh-CN")}</span>
            <span className="mx-2">·</span>
            <span>更新：{new Date(record.updatedAt).toLocaleString("zh-CN")}</span>
          </div>
          <button onClick={() => selectRecord(null)} className="btn-industrial">
            完成复核，关闭
          </button>
        </div>
      </div>
    </div>
  );
}

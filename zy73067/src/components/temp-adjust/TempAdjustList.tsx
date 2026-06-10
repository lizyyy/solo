import {
  Flame,
  User,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { useReviewStore } from "@/store/reviewStore";
import { useState } from "react";

export default function TempAdjustList() {
  const { records, updateRecordStatus, selectRecord } = useReviewStore();
  const tempRecords = records.filter((r) => r.isTempThresholdAdjusted);
  const [expandedId, setExpandedId] = useState<string | null>(
    tempRecords[0]?.id ?? null
  );

  return (
    <div className="space-y-4">
      <div className="card-surface p-5 border-2 border-alert-200 bg-gradient-to-br from-alert-50/70 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-alert-500 text-white rounded-industrial shadow-lg shadow-alert-500/20">
              <Flame size={28} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-industrial-800 mb-1">
                阈值临时调高记录
                <span className="ml-2 text-2xl font-mono text-alert-600">
                  {tempRecords.length}
                </span>
              </h3>
              <p className="text-sm text-gray-600">
                复核人最头疼阈值临时调高被揉进正常结果 — 这类记录已被单独拎出集中处理
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">独立过滤开关也在工作台可用</p>
            <p className="font-mono font-bold text-alert-600 text-sm">
              此类记录不会与正常预警合并统计
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {tempRecords.map((r, idx) => {
          const expanded = expandedId === r.id;
          return (
            <div
              key={r.id}
              className={`card-surface border-2 transition-all animate-fade-in ${
                expanded ? "border-alert-400 shadow-card-hover" : "border-alert-200"
              }`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div
                className="p-4 flex items-center gap-4 cursor-pointer"
                onClick={() => setExpandedId(expanded ? null : r.id)}
              >
                <div
                  className={`p-2 rounded-industrial transition-colors ${
                    expanded ? "bg-alert-500 text-white" : "bg-alert-100 text-alert-600"
                  }`}
                >
                  <Flame size={18} strokeWidth={2.5} />
                </div>

                <div className="flex-1 grid grid-cols-6 gap-4 items-center">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      设备
                    </p>
                    <p className="font-mono font-bold text-industrial-700">
                      {r.unifiedDeviceId}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      角度阈值
                    </p>
                    <p className="font-mono text-sm">
                      <span className="text-alert-600 font-semibold line-through decoration-alert-400 decoration-2">
                        {r.bladeAngleThreshold}°
                      </span>
                      <span className="mx-1 text-gray-400">→</span>
                      <span className="text-industrial-700 font-semibold">
                        临{Math.round(r.bladeAngleThreshold * 1.2)}°
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      振动阈值
                    </p>
                    <p className="font-mono text-sm">
                      <span className="text-alert-600 font-semibold line-through decoration-alert-400 decoration-2">
                        {r.vibrationThreshold}
                      </span>
                      <span className="mx-1 text-gray-400">→</span>
                      <span className="text-industrial-700 font-semibold">
                        临{(r.vibrationThreshold * 1.2).toFixed(1)}
                      </span>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      调整原因
                    </p>
                    <p className="text-sm text-gray-700 line-clamp-1">
                      {r.tempAdjustReason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge ${
                        r.status === "pending"
                          ? "badge-pending"
                          : r.status === "reviewing"
                          ? "badge-reviewing"
                          : r.status === "approved"
                          ? "badge-approved"
                          : "badge-rejected"
                      }`}
                    >
                      {r.status === "pending"
                        ? "待复核"
                        : r.status === "reviewing"
                        ? "复核中"
                        : r.status === "approved"
                        ? "通过"
                        : "驳回"}
                    </span>
                    {expanded ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {expanded && (
                <div className="border-t-2 border-alert-100 p-5 bg-alert-50/30 animate-fade-in">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white border border-gray-200 rounded-industrial p-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                        <User size={12} strokeWidth={2} />
                        <span>审批人</span>
                      </div>
                      <p className="font-semibold text-industrial-700">
                        {r.tempAdjustApprover}
                      </p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-industrial p-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                        <Clock size={12} strokeWidth={2} />
                        <span>审批时间</span>
                      </div>
                      <p className="font-mono text-sm text-industrial-700">
                        {r.tempAdjustTime &&
                          new Date(r.tempAdjustTime).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-industrial p-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                        <FileText size={12} strokeWidth={2} />
                        <span>来源</span>
                      </div>
                      <p className="text-sm text-industrial-700">{r.source}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-industrial p-4 mb-4">
                    <AlertTriangle
                      size={20}
                      className="text-alert-500 mt-0.5 shrink-0"
                      strokeWidth={2}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-industrial-700 mb-1">
                        详细审批理由
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed font-serif">
                        {r.tempAdjustReason}。本次临时调整仅针对当前批次复核，调整期间的数据不计入正常季度统计。
                        请复核人重点确认：①阈值恢复时间是否到期；②调整期间是否有额外监测记录；③是否有对应审批文件编号。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      原始编号：{r.originalDeviceIds.join(" / ")}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => selectRecord(r.id)}
                        className="btn-outline"
                      >
                        打开完整详情
                      </button>
                      <div className="inline-flex rounded-industrial overflow-hidden border border-gray-300">
                        <button
                          onClick={() => updateRecordStatus(r.id, "approved")}
                          className={`px-3 py-2 text-sm transition-colors ${
                            r.status === "approved"
                              ? "bg-success-500 text-white"
                              : "bg-white text-success-700 hover:bg-success-50"
                          }`}
                        >
                          ✓ 准予通过
                        </button>
                        <button
                          onClick={() => updateRecordStatus(r.id, "rejected")}
                          className={`px-3 py-2 text-sm border-l border-gray-300 transition-colors ${
                            r.status === "rejected"
                              ? "bg-red-500 text-white"
                              : "bg-white text-red-700 hover:bg-red-50"
                          }`}
                        >
                          ✗ 打回整改
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {tempRecords.length === 0 && (
          <div className="card-surface p-16 text-center text-gray-400 border border-gray-200">
            <Flame size={48} className="mx-auto mb-3 opacity-40" strokeWidth={1.5} />
            <p className="text-lg font-medium">当前没有阈值临时调高的记录</p>
            <p className="text-sm mt-1">所有记录均使用标准阈值</p>
          </div>
        )}
      </div>
    </div>
  );
}

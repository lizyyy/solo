import {
  Handshake,
  ArrowRight,
  FileSearch,
  ClipboardList,
  Search,
  Link,
  Quote,
  FileCheck,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { useReviewStore } from "@/store/reviewStore";
import type { AlertRecord } from "@/types";

function formatStatus(s: string) {
  return {
    pending: "待复核",
    reviewing: "复核中",
    approved: "✅ 已通过",
    rejected: "❌ 已驳回",
  }[s] ?? s;
}

function compareFields(record: AlertRecord) {
  const leftFields = Object.entries(record.sparePartsFields);
  const rightSummary = [
    { label: "统一设备编号", value: record.unifiedDeviceId },
    { label: "处理状态", value: formatStatus(record.status) },
    { label: "复核人备注", value: record.remark || "(未填写)" },
    {
      label: "结论文件",
      value: record.conclusionFile
        ? `${record.conclusionFile.name} (${
            record.conclusionFile.conclusion === "pass"
              ? "通过"
              : record.conclusionFile.conclusion === "fail"
              ? "驳回"
              : "待确认"
          })`
        : "(未上传)",
    },
    { label: "叶片角度", value: `${record.bladeAngle}° / 阈值 ${record.bladeAngleThreshold}°` },
    {
      label: "振动水平",
      value: `${record.vibrationLevel} mm/s / 阈值 ${record.vibrationThreshold} mm/s`,
    },
    {
      label: "临时阈值调整",
      value: record.isTempThresholdAdjusted
        ? `⚠ 是 · ${record.tempAdjustReason}`
        : "否",
    },
  ];
  return { leftFields, rightSummary };
}

function HandoverRow({ record, defaultOpen }: { record: AlertRecord; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { leftFields, rightSummary } = compareFields(record);

  return (
    <div className="card-surface border border-gray-200 overflow-hidden mb-4 animate-fade-in">
      <div
        className="p-4 bg-gradient-to-r from-industrial-50/60 to-white border-b border-gray-200 cursor-pointer flex items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-industrial-600 text-white rounded-industrial">
            <Handshake size={16} strokeWidth={2} />
          </div>
          <div>
            <p className="font-mono font-bold text-industrial-700">
              {record.unifiedDeviceId}
            </p>
            <p className="text-xs text-gray-500">
              来源：{record.source} · 更新：
              {new Date(record.updatedAt).toLocaleString("zh-CN")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`badge ${
              record.status === "approved"
                ? "badge-approved"
                : record.status === "rejected"
                ? "badge-rejected"
                : record.status === "reviewing"
                ? "badge-reviewing"
                : "badge-pending"
            }`}
          >
            {formatStatus(record.status)}
          </span>
          {open ? (
            <ChevronUp size={18} className="text-gray-400" strokeWidth={2.5} />
          ) : (
            <ChevronDown size={18} className="text-gray-400" strokeWidth={2.5} />
          )}
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-0 min-h-[400px] animate-fade-in">
          <div className="border-r border-gray-200">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
              <Quote size={16} className="text-industrial-600" strokeWidth={2} />
              <p className="text-sm font-bold text-industrial-700">
                备件清单原话（原始记录）
              </p>
              <span className="text-xs text-gray-500 ml-auto italic font-serif">
                维保主管阿敏交接时，先看这里
              </span>
            </div>
            <div className="p-5 space-y-3">
              {leftFields.map(([key, value], i) => (
                <div
                  key={key}
                  className="group relative pl-4 border-l-2 border-gray-100 hover:border-industrial-300 transition-colors"
                >
                  <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-gray-200 group-hover:bg-industrial-400 transition-colors" />
                  <p className="text-xs italic font-serif text-gray-500 mb-0.5">
                    "{key}"
                  </p>
                  <p className="text-sm font-serif text-gray-800 leading-relaxed">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="bg-industrial-50/60 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
              <ClipboardList size={16} className="text-industrial-600" strokeWidth={2} />
              <p className="text-sm font-bold text-industrial-700">
                页面摘要（处理结论说明）
              </p>
              <span className="text-xs text-gray-500 ml-auto">
                再用这里的摘要解释结论
              </span>
            </div>
            <div className="p-5 space-y-3">
              {rightSummary.map((s, i) => {
                const isMatch =
                  (s.label === "处理状态" && record.status !== "pending") ||
                  (s.label === "复核人备注" && record.remark) ||
                  (s.label === "结论文件" && record.conclusionFile) ||
                  s.label === "统一设备编号";
                return (
                  <div key={s.label} className="flex gap-3">
                    <div className="shrink-0 mt-0.5">
                      <CornerDownRight
                        size={14}
                        className={`${
                          isMatch ? "text-success-500" : "text-gray-300"
                        }`}
                        strokeWidth={2.5}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-industrial-500">
                          {s.label}
                        </p>
                        {isMatch && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-success-600 bg-success-50 border border-success-200 rounded px-1.5 py-px">
                            <Link size={9} strokeWidth={3} />
                            已关联
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 font-medium">{s.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mx-5 mb-5 p-4 bg-gradient-to-br from-industrial-50 to-white border-2 border-dashed border-industrial-200 rounded-industrial">
              <div className="flex items-start gap-2 mb-2">
                <FileSearch size={18} className="text-industrial-600 mt-0.5" strokeWidth={2} />
                <p className="text-sm font-bold text-industrial-700">
                  交接解释话术（自动生成）
                </p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed font-serif pl-6">
                根据备件清单，该设备
                <span className="font-mono font-semibold text-industrial-700 mx-1">
                  "{Object.entries(record.sparePartsFields)[0]?.[1]}"
                </span>
                对应的统一编号为
                <span className="font-mono font-semibold text-industrial-700 mx-1">
                  {record.unifiedDeviceId}
                </span>
                。当前处理状态为
                <span className="font-semibold text-industrial-700 mx-1">
                  {formatStatus(record.status)}
                </span>
                {record.remark && (
                  <>
                    ，复核人备注说明：
                    <span className="italic mx-1">"{record.remark}"</span>
                  </>
                )}
                。
                {record.conclusionFile &&
                  `结论文件已上传：${record.conclusionFile.name}。`}
                {record.isTempThresholdAdjusted &&
                  `⚠ 特别注意：本记录存在阈值临时调高（${record.tempAdjustReason}），请向交接人重点说明。`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HandoverPanel() {
  const { records } = useReviewStore();
  const [search, setSearch] = useState("");

  const filtered = records.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toUpperCase();
    return (
      r.unifiedDeviceId.toUpperCase().includes(q) ||
      r.remark.toUpperCase().includes(q) ||
      r.source.toUpperCase().includes(q) ||
      Object.values(r.sparePartsFields).some((v) => v.toUpperCase().includes(q))
    );
  });

  return (
    <div className="space-y-5">
      <div className="card-surface p-5 border border-industrial-200 bg-gradient-to-br from-industrial-50/80 to-white">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-industrial-600 text-white rounded-industrial shadow-lg shadow-industrial-600/20">
            <Handshake size={28} strokeWidth={2} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-industrial-800 mb-1">
              风机叶片阈值预警 · 交接面板
            </h2>
            <p className="text-sm text-gray-600">
              维保主管阿敏交接时：
              <ArrowRight
                size={14}
                className="inline mx-1 text-industrial-500"
                strokeWidth={2.5}
              />
              先找到备件清单里的原话
              <ArrowRight
                size={14}
                className="inline mx-1 text-industrial-500"
                strokeWidth={2.5}
              />
              再用页面摘要解释处理结论
            </p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            strokeWidth={2}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索设备编号 / 备件原话 / 备注 / 来源..."
            className="input-field pl-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="card-surface p-16 text-center text-gray-400 border border-gray-200">
            <FileSearch size={48} className="mx-auto mb-3 opacity-40" strokeWidth={1.5} />
            <p className="text-lg font-medium">没有匹配的交接记录</p>
          </div>
        ) : (
          filtered.map((r, i) => (
            <HandoverRow key={r.id} record={r} defaultOpen={i === 0} />
          ))
        )}
      </div>

      <div className="flex justify-end p-3">
        <button className="btn-industrial inline-flex items-center gap-1.5">
          <FileCheck size={16} strokeWidth={2} />
          <span>生成交接确认单</span>
        </button>
      </div>
    </div>
  );
}

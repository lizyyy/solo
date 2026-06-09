import { useState } from "react";
import { useModelStore } from "@/stores/useModelStore";
import { useAnomaliesStore } from "@/stores/useAnomaliesStore";
import { useMinutesStore } from "@/stores/useMinutesStore";
import { useMaterialsStore } from "@/stores/useMaterialsStore";
import {
  Layers,
  MapPin,
  FileText,
  Package,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Grid3X3,
} from "lucide-react";
import { StatusBadge, SeverityBadge, ImportanceBadge, HoldBadge } from "@/components/StatusBadges";
import DecisionBanner from "@/components/DecisionBanner";
import { useUIGlobalStore } from "@/stores/useUIGlobalStore";

export default function ModelView() {
  const { annotations, floors, activeFloor, setActiveFloor, selectedId, setSelected } = useModelStore();
  const { anomalies, updateHoldDecision } = useAnomaliesStore();
  const { minutes } = useMinutesStore();
  const { getBatchesForAnnotation, getDecision } = useMaterialsStore();
  const { showToast } = useUIGlobalStore();
  const [zoom, setZoom] = useState(1);

  const floorAnnotations = annotations.filter((a) => a.floor === activeFloor);
  const selected = annotations.find((a) => a.id === selectedId) || null;

  const selectedAnomalies = selected ? anomalies.filter((a) => a.annotationId === selected.id) : [];
  const selectedMinutes = selected?.minutesId ? minutes.find((m) => m.id === selected.minutesId) : null;
  const selectedMaterials = selected ? getBatchesForAnnotation(selected.id) : [];
  const selectedDecision = selected ? getDecision(selected.id) : null;

  const statusColor = (s: string) =>
    s === "abnormal" ? "#DC2626" : s === "suspended" ? "#EA580C" : "#16A34A";
  const pulseClass = (s: string) =>
    s === "abnormal" ? "pulse-ring-danger" : s === "suspended" ? "pulse-ring-warn" : "";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_380px] gap-6">
        {/* 左：楼层选择 */}
        <aside className="space-y-4">
          <div className="eng-card p-4">
            <h3 className="eng-section-title mb-3">
              <Layers size={14} />
              楼层 · 平面图切换
            </h3>
            <ul className="space-y-1.5">
              {floors.map((f) => {
                const count = annotations.filter((a) => a.floor === f).length;
                const abn = annotations.filter((a) => a.floor === f && a.status !== "normal").length;
                return (
                  <li key={f}>
                    <button
                      onClick={() => setActiveFloor(f)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-eng text-sm font-medium transition-all ${
                        activeFloor === f
                          ? "bg-brand-600 text-white shadow-eng"
                          : "bg-ink-50 text-ink-700 hover:bg-ink-100"
                      }`}
                    >
                      <span>{f}</span>
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            activeFloor === f ? "bg-white/20" : "bg-ink-200 text-ink-600"
                          }`}
                        >
                          {count}
                        </span>
                        {abn > 0 && (
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              activeFloor === f ? "bg-danger-400/90 text-white" : "bg-danger-100 text-danger-700"
                            }`}
                          >
                            ⚠ {abn}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="eng-card p-4">
            <h3 className="eng-section-title mb-3">
              <Grid3X3 size={14} />
              图例
            </h3>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-danger-600 pulse-ring-danger" />
                异常 · 需复核
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-warn-600 pulse-ring-warn" />
                挂起 · 待处理
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-safe-600" />
                正常 · 已复核
              </li>
            </ul>
          </div>
        </aside>

        {/* 中：平面图 */}
        <section className="eng-card overflow-hidden flex flex-col">
          <div className="h-12 px-4 flex items-center justify-between border-b border-ink-200 shrink-0">
            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-brand-600" />
              <h3 className="text-sm font-bold text-ink-900">{activeFloor} · 平面图标注</h3>
              <span className="font-mono text-[11px] text-ink-500">
                {floorAnnotations.length} 处标注 · 异常{" "}
                {floorAnnotations.filter((a) => a.status !== "normal").length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                className="eng-btn !p-2 !px-2"
                title="缩小"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-xs font-mono text-ink-600 w-14 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                className="eng-btn !p-2 !px-2"
                title="放大"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          </div>

          <div className="relative flex-1 eng-grid-bg overflow-hidden" style={{ minHeight: 520 }}>
            <div
              className="absolute inset-0 transition-transform duration-300 origin-center"
              style={{ transform: `scale(${zoom})` }}
            >
              {/* 房间轮廓示意 */}
              <svg className="absolute inset-0 w-full h-full p-8" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect
                  x="5"
                  y="5"
                  width="90"
                  height="90"
                  fill="none"
                  stroke="#D4D4D8"
                  strokeWidth="0.4"
                  strokeDasharray="1 1"
                />
                <line x1="50" y1="5" x2="50" y2="95" stroke="#E4E4E7" strokeWidth="0.3" />
                <line x1="5" y1="50" x2="95" y2="50" stroke="#E4E4E7" strokeWidth="0.3" />
                <text x="27" y="27" fill="#A1A1AA" fontSize="2.5" fontFamily="monospace">
                  西北区 NW
                </text>
                <text x="72" y="27" fill="#A1A1AA" fontSize="2.5" fontFamily="monospace">
                  东北区 NE
                </text>
                <text x="27" y="77" fill="#A1A1AA" fontSize="2.5" fontFamily="monospace">
                  西南区 SW
                </text>
                <text x="72" y="77" fill="#A1A1AA" fontSize="2.5" fontFamily="monospace">
                  东南区 SE
                </text>
              </svg>

              {/* 标注点 */}
              {floorAnnotations.map((a) => {
                const color = statusColor(a.status);
                const isSelected = a.id === selectedId;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    style={{ left: `${a.posX}%`, top: `${a.posY}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 group z-10`}
                  >
                    <div
                      className={`relative w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg border-2 ${
                        isSelected ? "border-white ring-4 ring-brand-400/60 z-20" : "border-white"
                      } ${pulseClass(a.status)}`}
                      style={{ backgroundColor: color }}
                    >
                      <MapPin size={14} />
                    </div>
                    <div
                      className={`absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap px-2 py-1 rounded text-[10px] font-bold shadow-eng transition-all ${
                        isSelected
                          ? "opacity-100 bg-ink-900 text-white"
                          : "opacity-0 group-hover:opacity-100 bg-white text-ink-800 border border-ink-200"
                      }`}
                    >
                      {a.locationCode}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 右：详情面板 · 三段固定结构（零交接设计） */}
        <aside className="space-y-4 flex flex-col" style={{ maxHeight: "calc(100vh - 160px)" }}>
          {!selected ? (
            <div className="eng-card p-8 flex flex-col items-center justify-center text-ink-400 gap-3 flex-1">
              <MapPin size={42} strokeWidth={1} />
              <div className="text-sm font-medium">点击平面图上的标注点</div>
              <div className="text-xs text-center">
                详情面板固定分为三段：
                <br />
                ① 位置信息 · ② 关联纪要 · ③ 材料/异常
              </div>
            </div>
          ) : (
            <>
              {/* ① 位置信息 */}
              <div className="eng-card p-4 shrink-0">
                <h4 className="eng-section-title mb-3 text-brand-700">
                  <MapPin size={13} /> 位置信息
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-500">位置编码</span>
                    <span className="font-mono font-bold text-ink-900">{selected.locationCode}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-500">楼层/区域</span>
                    <span className="text-ink-800 text-xs font-medium">
                      {selected.floor} / {selected.area}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-500">坐标</span>
                    <span className="font-mono text-xs text-ink-600">
                      ({selected.posX}, {selected.posY})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-500">结构重要性</span>
                    <ImportanceBadge importance={selected.structuralImportance} />
                  </div>
                  <div className="pt-2 border-t border-ink-100">
                    <div className="text-xs text-ink-500 mb-1">变更描述</div>
                    <div className="text-sm text-ink-800 bg-ink-50 p-2 rounded-eng border border-ink-100">
                      {selected.description}
                    </div>
                  </div>
                </div>
              </div>

              {/* ② 关联纪要 */}
              <div className="eng-card p-4 shrink-0">
                <h4 className="eng-section-title mb-3 text-ink-700">
                  <FileText size={13} /> 关联会议纪要
                </h4>
                {selectedMinutes ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-500 text-xs">来源</span>
                      <StatusBadge status={selectedMinutes.status} size="xs" />
                    </div>
                    <div className="text-xs font-bold text-ink-900 break-words bg-brand-50 p-2 rounded-eng border border-brand-100">
                      📎 {selectedMinutes.source}
                    </div>
                    {selectedMinutes.title && (
                      <div className="text-xs text-ink-600">
                        <span className="text-ink-400">主题：</span>
                        {selectedMinutes.title}
                      </div>
                    )}
                    {selectedMinutes.participant && (
                      <div className="text-xs text-ink-600">
                        <span className="text-ink-400">参会：</span>
                        {selectedMinutes.participant}
                      </div>
                    )}
                    {selectedMinutes.fieldMappings.length > 0 && (
                      <div className="pt-2 mt-2 border-t border-ink-100">
                        <div className="text-[10px] font-bold text-ink-500 mb-1 uppercase tracking-wider">
                          字段兼容映射（{selectedMinutes.fieldMappings.length}项）
                        </div>
                        <div className="space-y-1 max-h-[90px] overflow-y-auto scrollbar-eng">
                          {selectedMinutes.fieldMappings.map((m, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 text-[10px] font-mono bg-ink-50 px-2 py-1 rounded"
                            >
                              <span className="text-ink-600 truncate max-w-[80px]" title={m.originalName}>
                                {m.originalName}
                              </span>
                              <span className="text-brand-500">→</span>
                              <span className="text-brand-700 font-bold">{m.canonicalName}</span>
                              <span className="ml-auto text-ink-400">
                                {Math.round(m.confidence * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-3 text-xs text-warn-600 bg-warn-50 rounded-eng border border-warn-200">
                    ⚠ 未关联会议纪要 · 需补录洽商
                  </div>
                )}
              </div>

              {/* ③ 材料/异常 */}
              <div className="eng-card p-4 flex-1 overflow-y-auto scrollbar-eng">
                <h4 className="eng-section-title mb-3 text-warn-700">
                  <Package size={13} /> 材料批次
                </h4>
                {selectedDecision && (
                  <div className="mb-3">
                    <DecisionBanner
                      decision={selectedDecision.decision}
                      reason={selectedDecision.reason}
                      onHold={() => {
                        selectedAnomalies.forEach((a) =>
                          updateHoldDecision(a.id, "hold", selectedDecision!.reason, "系统判定", "材料校验引擎")
                        );
                        showToast("success", "已执行挂起决策");
                      }}
                      onRelease={() => {
                        selectedAnomalies.forEach((a) =>
                          updateHoldDecision(a.id, "release", selectedDecision!.reason, "系统判定", "材料校验引擎")
                        );
                        showToast("success", "已放行材料缺失项");
                      }}
                      onEvaluate={() => {
                        selectedAnomalies.forEach((a) =>
                          updateHoldDecision(a.id, "evaluate", selectedDecision!.reason, "系统判定", "材料校验引擎")
                        );
                        showToast("warning", "已提交评估，请项目总工判断");
                      }}
                    />
                  </div>
                )}

                {selectedMaterials.length === 0 ? (
                  <div className="text-xs text-ink-400 py-2">暂无材料批次记录</div>
                ) : (
                  <ul className="space-y-2 mb-4">
                    {selectedMaterials.map((m) => (
                      <li
                        key={m.id}
                        className={`p-2 rounded-eng border text-xs ${
                          m.isMissing
                            ? "bg-danger-50 border-danger-200"
                            : "bg-safe-50/50 border-safe-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-ink-800">{m.materialType}</span>
                          {m.isMissing ? (
                            <span className="eng-tag bg-danger-600 text-white text-[10px]">缺失</span>
                          ) : (
                            <span className="eng-tag bg-safe-600 text-white text-[10px]">齐全</span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-ink-500 space-y-0.5">
                          <div>批次：{m.batchNumber || "—"}</div>
                          <div>报告：{m.testReport || "—"}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <h4 className="eng-section-title mb-3 text-danger-700 mt-5">
                  <AlertTriangle size={13} /> 关联异常
                </h4>
                {selectedAnomalies.length === 0 ? (
                  <div className="text-xs text-safe-600 py-2 bg-safe-50 rounded-eng border border-safe-200 text-center">
                    ✅ 无异常记录
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {selectedAnomalies.map((a) => (
                      <li key={a.id} className="p-3 rounded-eng bg-ink-50 border border-ink-100">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <SeverityBadge severity={a.severity} />
                          <StatusBadge status={a.status} size="xs" />
                        </div>
                        <div className="text-xs font-bold text-ink-800 mb-1">{a.title}</div>
                        <div className="text-[11px] text-ink-600 mb-2">{a.description}</div>
                        <div className="flex items-center justify-between">
                          <HoldBadge decision={a.holdDecision} />
                          <span className="font-mono text-[10px] text-ink-400">{a.id}</span>
                        </div>
                        {a.holdReason && (
                          <div className="mt-2 text-[10px] text-ink-500 bg-white p-1.5 rounded border border-ink-100">
                            💡 {a.holdReason}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

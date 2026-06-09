import { useMemo } from "react";
import {
  AlertTriangle,
  CheckSquare,
  FileWarning,
  Shield,
  Sparkles,
  X,
  XSquare,
} from "lucide-react";
import { usePreviewStore } from "@/store/usePreviewStore";
import { SOURCE_LABEL, type SourceRow } from "@/types";
import { normalizeLevel, normalizeZone } from "@/logic/collisions";

export function ImportDrawer() {
  const open = usePreviewStore((s) => s.importDrawerOpen);
  const rows = usePreviewStore((s) => s.importPreviewRows);
  const close = usePreviewStore((s) => s.closeImportDrawer);
  const confirm = usePreviewStore((s) => s.confirmImport);
  const sourceRows = usePreviewStore((s) => s.sourceRows);

  const analysis = useMemo(() => analyzeRows(rows, sourceRows), [rows, sourceRows]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div
        className="absolute inset-0 bg-blueprint-900/60 backdrop-blur-sm"
        onClick={close}
      />
      <div className="relative w-[720px] max-w-[92vw] h-full bg-paper-100 border-l-4 border-blueprint-500 shadow-2xl flex flex-col animate-slide-in-right">
        <div className="px-5 py-4 border-b border-paper-300 bg-gradient-to-r from-blueprint-500/10 to-paper-100 flex items-start justify-between gap-4">
          <div>
            <div className="font-eng text-[10px] text-blueprint-500 tracking-[0.3em] mb-1">
              MATERIAL · IMPORT · PREVIEW
            </div>
            <div className="font-sans text-base font-semibold text-steel-700">
              材料导入预览 · 将保留原始数据痕迹
            </div>
            <div className="mt-1 text-[11px] text-steel-500 leading-relaxed flex items-start gap-1.5">
              <Shield size={12} className="mt-0.5 text-blueprint-500" />
              <span>
                所有 <code className="font-eng text-fire-critical">raw_</code>{" "}
                字段保持原样导入，不做自动清洗；下方仅作"对齐参考"预览供您确认。
              </span>
            </div>
          </div>
          <button
            onClick={close}
            className="bp-btn !py-1.5"
            title="取消导入"
          >
            <X size={12} />
            取消
          </button>
        </div>

        {analysis && (
          <div className="px-5 py-3 border-b border-paper-300 bg-blueprint-grid bg-paper-50 grid grid-cols-4 gap-3">
            <StatBox
              Icon={CheckSquare}
              label="待导入行"
              value={String(analysis.totalRows)}
              tone="info"
            />
            <StatBox
              Icon={Sparkles}
              label="版本节点"
              value={analysis.versionIds.slice(0, 2).join(" · ")}
              tone="primary"
              small
            />
            <StatBox
              Icon={FileWarning}
              label="脏数据检测"
              value={`${analysis.dirtyCount} 处`}
              tone={analysis.dirtyCount ? "warning" : "ok"}
            />
            <StatBox
              Icon={AlertTriangle}
              label="严重等级行"
              value={String(analysis.criticalCount)}
              tone={analysis.criticalCount ? "danger" : "ok"}
            />
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-5 py-2 border-b border-paper-300 bg-paper-50 flex items-center justify-between">
            <div className="font-eng text-[10px] text-steel-500 tracking-widest">
              RAW · PREVIEW TABLE · 原始字段
            </div>
            <div className="text-[10px] text-steel-500">
              红色斜线角标 = 脏数据（空格/空/疑似拼写异常）
            </div>
          </div>
          <div className="flex-1 overflow-auto scrollbar-thin">
            <table className="w-full border-collapse text-[10px] font-eng">
              <thead className="sticky top-0 z-10">
                <tr className="bg-blueprint-500 text-paper-50">
                  <th className="px-2 py-2 text-left w-6">#</th>
                  <th className="px-2 py-2 text-left w-20">来源类型</th>
                  <th className="px-2 py-2 text-left">raw_source_name</th>
                  <th className="px-2 py-2 text-left w-24">raw_zone_a</th>
                  <th className="px-2 py-2 text-left w-24">raw_zone_b</th>
                  <th className="px-2 py-2 text-left w-36">raw_position</th>
                  <th className="px-2 py-2 text-left w-28">raw_level</th>
                  <th className="px-2 py-2 text-left w-24">对齐参考</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const dirtA = isDirty(r.raw_fire_zone_a);
                  const dirtB = isDirty(r.raw_fire_zone_b);
                  const za = normalizeZone(r.raw_fire_zone_a);
                  const zb = normalizeZone(r.raw_fire_zone_b, za);
                  const lvl = normalizeLevel(r.raw_level);
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-paper-200 ${i % 2 ? "bg-paper-50/60" : "bg-white/60"} hover:bg-blueprint-50/40`}
                    >
                      <td className="px-2 py-1.5 text-steel-400">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`bp-chip !text-[9px] ${sourceStyle(r.sourceType)}`}
                        >
                          {SOURCE_LABEL[r.sourceType]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-steel-700 font-sans align-top max-w-[220px]">
                        {r.raw_source_name}
                      </td>
                      <td className="px-2 py-1.5">
                        <DirtyCell dirty={dirtA} value={r.raw_fire_zone_a} />
                      </td>
                      <td className="px-2 py-1.5">
                        <DirtyCell dirty={dirtB} value={r.raw_fire_zone_b} />
                      </td>
                      <td className="px-2 py-1.5 text-steel-600 font-sans align-top">
                        {r.raw_position}
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`px-1.5 py-0.5 border ${
                            lvl === "critical"
                              ? "border-fire-critical text-fire-critical bg-fire-critical/5"
                              : lvl === "warning"
                                ? "border-fire-warning text-fire-warning bg-fire-warning/5"
                                : "border-fire-info text-fire-info bg-fire-info/5"
                          }`}
                        >
                          {r.raw_level}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-[9px] text-blueprint-600 tracking-wide">
                        <div className="font-eng">
                          {za} × {zb || "?"}
                        </div>
                        <div className="text-steel-400 mt-0.5">
                          {lvl.toUpperCase()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-paper-300 bg-gradient-to-r from-paper-100 to-paper-200 flex items-center justify-between gap-3">
          <div className="text-[10px] text-steel-500 max-w-md">
            <span className="font-eng text-steel-600">提示：</span>
            点击确认导入后，系统将生成新版本时间轴节点，并自动计入碰撞去重与结论计算。
          </div>
          <div className="flex items-center gap-2">
            <button onClick={close} className="bp-btn">
              <XSquare size={12} />
              取消导入
            </button>
            <button
              onClick={confirm}
              className="bp-btn bp-btn-primary"
              disabled={!rows.length}
            >
              <CheckSquare size={12} />
              确认导入（{rows.length} 行）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirtyCell({ dirty, value }: { dirty: boolean; value: string }) {
  return (
    <div
      className={`relative px-1.5 py-0.5 border inline-block ${
        dirty
          ? "border-fire-critical/50 bg-fire-critical/5 text-fire-fail before:absolute before:inset-0 before:border-l-2 before:border-t-2 before:border-fire-critical before:clip-path-[polygon(0_0,10px_0,0_10px)]"
          : "border-paper-300 text-steel-700"
      }`}
      style={
        dirty
          ? {
              background:
                "linear-gradient(135deg, transparent 40%, rgba(214,40,40,0.12) 42%, transparent 44%), rgba(251,250,247,1)",
            }
          : undefined
      }
    >
      <code>{JSON.stringify(value)}</code>
    </div>
  );
}

function isDirty(s: string) {
  return s !== s.trim() || s === "";
}

function analyzeRows(
  rows: SourceRow[],
  existing: SourceRow[],
) {
  if (!rows.length) return null;
  const dirtyCount = rows.reduce(
    (acc, r) =>
      acc +
      (isDirty(r.raw_fire_zone_a) ? 1 : 0) +
      (isDirty(r.raw_fire_zone_b) ? 1 : 0) +
      (r.raw_source_name.startsWith("【") ? 0 : 0),
    0,
  );
  const criticalCount = rows.filter(
    (r) => normalizeLevel(r.raw_level) === "critical",
  ).length;
  const versionIds = Array.from(new Set(rows.map((r) => r.versionId)));
  void existing;
  return {
    totalRows: rows.length,
    dirtyCount,
    criticalCount,
    versionIds,
  };
}

function StatBox({
  Icon,
  label,
  value,
  tone,
  small,
}: {
  Icon: typeof CheckSquare;
  label: string;
  value: string;
  tone: "primary" | "info" | "ok" | "warning" | "danger";
  small?: boolean;
}) {
  const toneMap = {
    primary: "border-blueprint-500 text-blueprint-600 bg-blueprint-50",
    info: "border-steel-500 text-steel-600 bg-paper-50",
    ok: "border-fire-pass text-fire-pass bg-fire-pass/5",
    warning: "border-fire-warning text-fire-warning bg-fire-warning/5",
    danger: "border-fire-critical text-fire-critical bg-fire-critical/5",
  };
  return (
    <div
      className={`border ${toneMap[tone]} px-3 py-2 flex items-start gap-2 shadow-eng-inset`}
    >
      <Icon size={14} className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="font-eng text-[9px] tracking-widest opacity-80">
          {label}
        </div>
        <div
          className={`font-sans font-semibold ${small ? "text-[11px]" : "text-base"} truncate`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function sourceStyle(t: SourceRow["sourceType"]) {
  switch (t) {
    case "cad_layer":
      return "border-blueprint-400 text-blueprint-600 bg-blueprint-50";
    case "disclosure_doc":
      return "border-paper-400 text-steel-600 bg-paper-200";
    case "attachment":
      return "border-fire-fail/50 text-fire-fail bg-fire-fail/5";
  }
}

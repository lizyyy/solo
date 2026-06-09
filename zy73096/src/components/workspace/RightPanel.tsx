import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Gauge,
  GitCompare,
  History,
  Layers,
  Plus,
  ShieldAlert,
  Sparkles,
  StickyNote,
  User,
} from "lucide-react";
import { usePreviewStore } from "@/store/usePreviewStore";
import {
  CONCLUSION_LABEL,
  LEVEL_LABEL,
  SOURCE_LABEL,
  type CollisionLevel,
  type SourceType,
} from "@/types";
import { buildSnapshotDiff } from "@/logic/csv";
import { ZONE_NAME_MAP } from "@/data/zones";

const LEVEL_STYLE: Record<CollisionLevel, string> = {
  critical: "bg-fire-critical text-white border-fire-fail",
  warning: "bg-fire-warning text-white border-fire-doubt",
  info: "bg-fire-info text-white border-blueprint-400",
};

function CollisionTab() {
  const { filteredCollisions, filteredRows } = usePreviewStore((s) =>
    s.getVisibleState(),
  );
  const selectedId = usePreviewStore((s) => s.ui.selectedCollisionId);
  const setSel = usePreviewStore((s) => s.setSelectedCollision);
  const expanded = usePreviewStore((s) => s.ui.expandedSourceRows);
  const toggle = usePreviewStore((s) => s.toggleSourceRowExpanded);

  const rowById = useMemo(() => {
    const m = new Map(filteredRows.map((r) => [r.id, r]));
    return m;
  }, [filteredRows]);

  const cols = filteredCollisions.length ? filteredCollisions : [];

  if (!cols.length)
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <ShieldAlert size={36} className="text-paper-300 mb-3" />
        <div className="font-eng text-[11px] text-steel-400 tracking-widest mb-1">
          NO COLLISIONS IN CURRENT FILTER
        </div>
        <div className="text-xs text-steel-500">
          无碰撞命中 · 请调整筛选条件或切换到其它时间轴版本
        </div>
      </div>
    );

  return (
    <div className="space-y-2.5">
      {cols.map((c) => {
        const isSel = selectedId === c.id;
        return (
          <div
            key={c.id}
            className={`border transition-all animate-slide-in-right
            ${isSel
              ? "border-blueprint-500 bg-blueprint-50/70 shadow-eng-inset"
              : "border-paper-300 bg-paper-50/80 hover:border-blueprint-300"
            }`}
          >
            <button
              onClick={() => setSel(isSel ? null : c.id)}
              className="w-full text-left p-3 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`bp-chip border-0 ${LEVEL_STYLE[c.level]}`}
                  >
                    <AlertTriangle size={9} />
                    {LEVEL_LABEL[c.level]}
                  </span>
                  {c.duplicateCount > 1 && (
                    <span className="bp-chip border-fire-critical/50 text-fire-critical bg-fire-critical/5">
                      <GitCompare size={9} />
                      重复来源 × {c.duplicateCount}
                    </span>
                  )}
                  <span className="font-eng text-[10px] text-steel-400 tracking-widest ml-auto">
                    {c.positionHash}
                  </span>
                </div>
                <div className="text-[12px] font-semibold text-steel-700 truncate">
                  <span className="font-eng text-blueprint-600">{c.zoneA}</span>
                  <span className="mx-1.5 text-fire-critical">×</span>
                  <span className="font-eng text-blueprint-600">{c.zoneB}</span>
                  <span className="text-steel-500 mx-1.5">·</span>
                  <span className="font-normal text-steel-600">
                    {ZONE_NAME_MAP[c.zoneA] ?? c.zoneA}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-steel-500 flex items-center gap-1">
                  <Gauge size={10} /> 影响范围：{c.impactZone}
                </div>
              </div>
              {expanded.includes(c.id) ? (
                <ChevronUp size={14} className="text-steel-500 mt-1" />
              ) : (
                <ChevronDown size={14} className="text-steel-500 mt-1" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggle(c.id);
              }}
              className="w-full border-t border-paper-200 bg-paper-100/50 px-3 py-1.5 flex items-center justify-between text-[10px] font-eng tracking-wider text-steel-500 hover:bg-paper-100"
            >
              <span className="flex items-center gap-1">
                <Layers size={10} /> 来源行追溯（{c.sourceRows.length}）
              </span>
              <span>
                {expanded.includes(c.id) ? "折叠" : "展开"}影响范围明细
              </span>
            </button>
            {expanded.includes(c.id) && (
              <div className="border-t border-dashed border-paper-300 bg-paper-100">
                <div className="p-2 space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                  {c.sourceRows.map((rid, i) => {
                    const r = rowById.get(rid);
                    if (!r) return null;
                    return (
                      <div
                        key={rid}
                        className="border border-paper-300 bg-paper-50 p-2 text-[10px] leading-relaxed"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-eng text-steel-500">
                              #{i + 1}
                            </span>
                            <span
                              className={`bp-chip ${SOURCE_STYLE[r.sourceType]}`}
                            >
                              {SOURCE_LABEL[r.sourceType]}
                            </span>
                            <span
                              className={`bp-chip border-0 ${LEVEL_STYLE[r.normalized?.level ?? "info"]}`}
                            >
                              {LEVEL_LABEL[r.normalized?.level ?? "info"]}
                            </span>
                          </div>
                          <span className="font-eng text-[9px] text-steel-400">
                            {new Date(r.importedAt).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </span>
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-steel-600">
                          <span className="font-eng text-steel-400 italic">
                            raw_source_name
                          </span>
                          <span className="break-all">{r.raw_source_name}</span>
                          <span className="font-eng text-steel-400 italic">
                            raw_fire_zone_a
                          </span>
                          <code className="font-eng text-fire-critical bg-fire-critical/5 px-1 border border-fire-critical/20">
                            {JSON.stringify(r.raw_fire_zone_a)}
                          </code>
                          <span className="font-eng text-steel-400 italic">
                            raw_fire_zone_b
                          </span>
                          <code className="font-eng text-fire-critical bg-fire-critical/5 px-1 border border-fire-critical/20">
                            {JSON.stringify(r.raw_fire_zone_b)}
                          </code>
                          <span className="font-eng text-steel-400 italic">
                            raw_position
                          </span>
                          <span>{r.raw_position}</span>
                          <span className="font-eng text-steel-400 italic">
                            raw_level
                          </span>
                          <span>{r.raw_level}</span>
                          {r.raw_note && (
                            <>
                              <span className="font-eng text-steel-400 italic">
                                raw_note
                              </span>
                              <span className="text-steel-700">
                                {r.raw_note}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="mt-1 pt-1 border-t border-dashed border-paper-300 flex items-center justify-between">
                          <span className="font-eng text-[9px] text-steel-400 tracking-wider">
                            对齐参考（仅展示，不修改 raw_）
                          </span>
                          <span className="font-eng text-[9px] text-blueprint-500">
                            {r.normalized?.zoneA} → {r.normalized?.zoneB}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const SOURCE_STYLE: Record<SourceType, string> = {
  cad_layer: "border-blueprint-400 text-blueprint-600 bg-blueprint-50",
  disclosure_doc: "border-paper-400 text-steel-600 bg-paper-200",
  attachment: "border-fire-fail/50 text-fire-fail bg-fire-fail/5",
};

function HistoryTab() {
  const snapshots = usePreviewStore((s) => s.snapshots);
  const [openId, setOpenId] = useState<string | null>(
    snapshots.length ? snapshots[snapshots.length - 1].id : null,
  );
  if (!snapshots.length)
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <History size={36} className="text-paper-300 mb-3" />
        <div className="font-eng text-[11px] text-steel-400 tracking-widest mb-1">
          NO SNAPSHOTS
        </div>
        <div className="text-xs text-steel-500">
          暂无结论变化记录 · 修改结论时会自动生成快照
        </div>
      </div>
    );
  return (
    <div className="space-y-3">
      {[...snapshots].reverse().map((s) => {
        const open = openId === s.id;
        const diff = buildSnapshotDiff(s);
        const changed =
          s.previousConclusion && s.previousConclusion !== s.conclusion;
        return (
          <div
            key={s.id}
            className={`border transition-all ${
              changed
                ? "border-fire-fail/30 bg-fire-fail/[0.03]"
                : "border-paper-300 bg-paper-50/80"
            }`}
          >
            <button
              onClick={() => setOpenId(open ? null : s.id)}
              className="w-full text-left p-3 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {changed ? (
                    <span className="bp-chip border-0 bg-fire-fail text-white animate-stamp-in">
                      <Sparkles size={9} />
                      改判 · {CONCLUSION_LABEL[s.previousConclusion!]} →{" "}
                      {CONCLUSION_LABEL[s.conclusion]}
                    </span>
                  ) : (
                    <span className="bp-chip border-blueprint-400 text-blueprint-600 bg-blueprint-50">
                      初判 · {CONCLUSION_LABEL[s.conclusion]}
                    </span>
                  )}
                  <span className="font-eng text-[10px] text-steel-400 ml-auto">
                    {s.id}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-steel-600">
                  <User size={10} /> {s.operatorName}
                  <span className="text-paper-300">|</span>
                  <span className="font-eng">
                    {new Date(s.createdAt).toLocaleString("zh-CN", {
                      hour12: false,
                    })}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-steel-700 line-clamp-2">
                  <StickyNote size={10} className="inline mr-1 -mt-0.5" />
                  {s.reason || "（未填写改判原因）"}
                </div>
              </div>
              {open ? (
                <ChevronUp size={14} className="text-steel-500 mt-1" />
              ) : (
                <ChevronDown size={14} className="text-steel-500 mt-1" />
              )}
            </button>
            {open && (
              <div className="border-t border-dashed border-paper-300 bg-paper-100/80 p-3 space-y-3 max-h-[70vh] overflow-y-auto scrollbar-thin">
                {changed && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-paper-300 bg-paper-50 p-2.5">
                      <div className="font-eng text-[10px] text-steel-400 tracking-widest mb-1">
                        ◀ 旧结论
                      </div>
                      <div className="font-sans text-sm text-steel-700">
                        {CONCLUSION_LABEL[s.previousConclusion!]}
                      </div>
                    </div>
                    <div className="border-2 border-fire-fail bg-fire-fail/5 p-2.5 relative overflow-hidden">
                      <div className="absolute right-2 top-1.5 bp-stamp border-fire-fail text-fire-fail">
                        CHANGED
                      </div>
                      <div className="font-eng text-[10px] text-fire-fail tracking-widest mb-1">
                        ▶ 新结论
                      </div>
                      <div className="font-sans text-sm font-semibold text-fire-fail">
                        {CONCLUSION_LABEL[s.conclusion]}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="font-eng text-[10px] text-steel-500 tracking-widest mb-1.5 flex items-center gap-1">
                    <StickyNote size={10} /> 改判原因 / 新备注
                  </div>
                  <div className="border border-paper-300 bg-paper-50 p-2.5 text-[11px] text-steel-700 leading-relaxed space-y-1.5">
                    <div>
                      <span className="font-eng text-steel-400 mr-2">reason</span>
                      {s.reason || "—"}
                    </div>
                    <div>
                      <span className="font-eng text-steel-400 mr-2">note</span>
                      {s.note || "—"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="font-eng text-[10px] text-steel-500 tracking-widest mb-1.5 flex items-center gap-1">
                      <FileText size={10} /> 旧材料快照（
                      {diff.kept.length}）
                    </div>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin">
                      {!diff.kept.length && (
                        <div className="border border-dashed border-paper-300 p-2 text-[10px] text-steel-400 text-center">
                          （初判节点，无前序材料）
                        </div>
                      )}
                      {diff.kept.map((r) => (
                        <div
                          key={r.id}
                          className="border border-paper-300 bg-paper-50 p-2 text-[10px]"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span
                              className={`bp-chip ${SOURCE_STYLE[r.sourceType]}`}
                            >
                              {SOURCE_LABEL[r.sourceType]}
                            </span>
                            <span className="font-eng text-[9px] text-steel-400">
                              {r.id}
                            </span>
                          </div>
                          <div className="text-steel-600 truncate">
                            {r.raw_source_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-eng text-[10px] text-fire-fail tracking-widest mb-1.5 flex items-center gap-1">
                      <Plus size={10} /> 本次新增（{diff.added.length}）
                    </div>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin">
                      {!diff.added.length && (
                        <div className="border border-dashed border-paper-300 p-2 text-[10px] text-steel-400 text-center">
                          （本次无新增）
                        </div>
                      )}
                      {diff.added.map((r) => (
                        <div
                          key={r.id}
                          className="border-2 border-fire-fail/30 bg-fire-fail/[0.04] p-2 text-[10px]"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span
                              className={`bp-chip ${SOURCE_STYLE[r.sourceType]}`}
                            >
                              {SOURCE_LABEL[r.sourceType]}
                            </span>
                            <span className="font-eng text-[9px] text-fire-fail">
                              NEW · {r.id}
                            </span>
                          </div>
                          <div className="text-steel-700 truncate">
                            {r.raw_source_name}
                          </div>
                          <div className="mt-0.5 text-[9px] text-steel-500 grid grid-cols-[auto_1fr] gap-x-2">
                            <span className="font-eng italic text-steel-400">
                              pos
                            </span>
                            <span>{r.raw_position}</span>
                            <span className="font-eng italic text-steel-400">
                              note
                            </span>
                            <span className="col-span-1 truncate">
                              {r.raw_note || "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AppendTab() {
  const { filteredRows, version } = usePreviewStore((s) => s.getVisibleState());
  const setTab = usePreviewStore((s) => s.setRightTab);
  const openDrawer = usePreviewStore((s) => s.openImportDrawer);

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-blueprint-300 bg-blueprint-50/60 p-4">
        <div className="font-eng text-[10px] text-blueprint-500 tracking-[0.3em] mb-1">
          LATE · ATTACHMENT · 补录
        </div>
        <div className="font-sans text-sm font-semibold text-blueprint-700 mb-1">
          补录晚到附件（当前版本：{version?.name ?? "—"}）
        </div>
        <div className="text-[11px] text-steel-600 leading-relaxed mb-3">
          补录后将生成新版本时间轴节点；所有 raw_
          字段保持原样导入，不做自动清洗。
        </div>
        <button
          onClick={() => openDrawer([makeFakeAttachmentRow(version?.id)])}
          className="bp-btn bp-btn-primary"
        >
          <Plus size={12} />
          导入一条示例晚到附件（测试周一早会）
        </button>
      </div>
      <div className="bp-section-title mt-2">
        <span className="flex items-center gap-1.5">
          <FileText size={12} /> 已加载材料 ({filteredRows.length})
        </span>
        <button
          onClick={() => setTab("collisions")}
          className="text-[10px] font-eng normal-case tracking-normal text-blueprint-500 hover:underline"
        >
          查看碰撞点 →
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto scrollbar-thin space-y-1.5">
        {filteredRows.map((r) => (
          <div
            key={r.id}
            className={`border p-2 text-[10px] ${
              r.sourceType === "attachment"
                ? "border-fire-fail/30 bg-fire-fail/[0.03]"
                : "border-paper-300 bg-paper-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className={`bp-chip ${SOURCE_STYLE[r.sourceType]}`}>
                  {SOURCE_LABEL[r.sourceType]}
                </span>
                <span className="font-eng text-steel-500">
                  {r.raw_fire_zone_a.trim() || "?"} ×{" "}
                  {r.raw_fire_zone_b.trim() || "?"}
                </span>
              </div>
              <span className="font-eng text-[9px] text-steel-400">{r.id}</span>
            </div>
            <div className="text-steel-700 truncate">{r.raw_source_name}</div>
            {(r.raw_fire_zone_b.startsWith(" ") ||
              r.raw_fire_zone_b === "" ||
              r.raw_fire_zone_a.startsWith(" ")) && (
              <div className="mt-1 text-[9px] text-fire-fail flex items-center gap-1">
                <AlertTriangle size={9} />
                检测到脏数据（空格/空值），已保留原始字段不清洗
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function makeFakeAttachmentRow(versionId?: string) {
  const ts = Date.now();
  return {
    id: `src-${ts.toString(36)}`,
    versionId: versionId?.replace(/v\d/, (m) => "v" + (Number(m.slice(1)) + 1)) ?? "ver-v3-manual",
    sourceType: "attachment" as const,
    raw_source_name: `【手动补录】设计院邮件附件-${new Date(ts).toISOString().slice(0, 10)} 防火卷帘复核.dwg`,
    raw_fire_zone_a: "F2",
    raw_fire_zone_b: "F1 ",
    raw_position: "3F-01 补录位置",
    raw_level: "严重",
    raw_note: "手动补录测试：复核3F-01处严重碰撞",
    importedAt: ts,
  };
}

export function RightPanel() {
  const tab = usePreviewStore((s) => s.ui.rightTab);
  const setTab = usePreviewStore((s) => s.setRightTab);
  const visible = usePreviewStore((s) => s.getVisibleState());
  const snapCount = usePreviewStore((s) => s.snapshots.length);

  const tabs = [
    { key: "collisions", label: "碰撞明细", icon: AlertTriangle, count: visible.filteredCollisions.length || visible.allCollisions.length },
    { key: "history", label: "历史快照", icon: History, count: snapCount },
    { key: "append", label: "补录附件", icon: Plus, count: null },
  ] as const;

  return (
    <aside className="w-[380px] h-full flex-shrink-0 flex flex-col border-l border-paper-300 bg-paper-100/60 backdrop-blur-sm">
      <div className="flex border-b border-paper-300 bg-paper-100">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-2 py-2.5 text-[11px] flex items-center justify-center gap-1.5 transition-colors border-b-2
              ${active
                ? "border-blueprint-500 bg-paper-50 text-blueprint-600 font-semibold"
                : "border-transparent text-steel-500 hover:text-steel-700 hover:bg-paper-50"
              }`}
            >
              <t.icon size={12} />
              {t.label}
              {t.count !== null && (
                <span
                  className={`font-eng text-[9px] px-1.5 py-0.5 border ${
                    active
                      ? "bg-blueprint-500 text-paper-50 border-blueprint-600"
                      : "bg-paper-50 text-steel-500 border-paper-300"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {tab === "collisions" && <CollisionTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "append" && <AppendTab />}
      </div>
    </aside>
  );
}

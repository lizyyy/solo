import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  History,
  Layers,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { usePreviewStore } from "@/store/usePreviewStore";
import {
  CONCLUSION_LABEL,
  LEVEL_LABEL,
  SOURCE_LABEL,
  type CollisionLevel,
  type SourceType,
} from "@/types";
import { FIRE_ZONES } from "@/data/zones";

const LEVEL_COLORS: Record<CollisionLevel, string> = {
  critical: "border-fire-critical text-fire-critical bg-fire-critical/5",
  warning: "border-fire-warning text-fire-warning bg-fire-warning/5",
  info: "border-fire-info text-fire-info bg-fire-info/5",
};

const SOURCE_COLORS: Record<SourceType, string> = {
  cad_layer: "border-blueprint-400 text-blueprint-600 bg-blueprint-50",
  disclosure_doc: "border-paper-400 text-steel-600 bg-paper-200",
  attachment: "border-fire-fail text-fire-fail bg-fire-fail/5",
};

function VersionTimeline() {
  const versions = usePreviewStore((s) => s.versions);
  const currentVersionId = usePreviewStore((s) => s.currentVersionId);
  const setCurrent = usePreviewStore((s) => s.setCurrentVersion);
  if (!versions.length) return null;
  return (
    <div>
      <div className="bp-section-title">
        <span className="flex items-center gap-1.5">
          <History size={12} /> 版本时间轴
        </span>
        <span className="text-[10px] normal-case tracking-normal">
          共 {versions.length} 个节点
        </span>
      </div>
      <ol className="relative border-l border-paper-300 ml-2 space-y-4">
        {versions.map((v, i) => {
          const active = v.id === currentVersionId;
          const conclusionColor =
            v.conclusion === "pass"
              ? "bg-fire-pass"
              : v.conclusion === "fail"
                ? "bg-fire-fail"
                : "bg-fire-doubt";
          return (
            <li key={v.id} className="ml-4">
              <button
                onClick={() => setCurrent(v.id)}
                className={`group w-full text-left -mt-1 p-2 border transition-all
                ${active
                  ? "border-blueprint-500 bg-blueprint-50 shadow-eng-inset"
                  : "border-transparent hover:border-paper-300 hover:bg-paper-50"
                }`}
              >
                <span
                  className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-paper-100 ${conclusionColor} ${active ? "ring-2 ring-blueprint-400" : ""}`}
                />
                <div className="flex items-center justify-between">
                  <div
                    className={`font-eng text-[11px] tracking-wider ${active ? "text-blueprint-600" : "text-steel-600"}`}
                  >
                    {v.name}
                  </div>
                  <div
                    className={`bp-chip border-0 ${conclusionColor} text-white`}
                  >
                    {CONCLUSION_LABEL[v.conclusion]}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-steel-400">
                    {v.sourceRowIds.length} 条来源
                  </span>
                  <span className="font-eng text-[10px] text-steel-500">
                    {new Date(v.createdAt).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-steel-500 truncate">
                  {v.description || `步骤 ${i + 1}：${v.name}`}
                </div>
                {active && (
                  <ChevronRight
                    size={12}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blueprint-400"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function FilterPanel() {
  const filters = usePreviewStore((s) => s.filters);
  const toggleZone = usePreviewStore((s) => s.toggleZoneFilter);
  const toggleLevel = usePreviewStore((s) => s.toggleLevelFilter);
  const toggleSource = usePreviewStore((s) => s.toggleSourceFilter);
  const setKw = usePreviewStore((s) => s.setKeyword);
  const reset = usePreviewStore((s) => s.resetFilters);
  const activeCount =
    filters.zones.length +
    filters.levels.length +
    filters.sourceTypes.length +
    (filters.keyword ? 1 : 0);

  return (
    <div>
      <div className="bp-section-title">
        <span className="flex items-center gap-1.5">
          <Layers size={12} /> 筛选器
        </span>
        {activeCount > 0 ? (
          <button
            onClick={reset}
            className="text-[10px] font-eng normal-case tracking-normal text-fire-fail hover:underline flex items-center gap-1"
          >
            <Trash2 size={10} /> 清空 {activeCount} 项
          </button>
        ) : null}
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-eng text-steel-500 tracking-wider mb-1 block">
          <Search size={10} className="inline mr-1 -mt-0.5" /> 关键词
        </label>
        <div className="relative">
          <input
            value={filters.keyword}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜来源名 / 位置 / 备注…"
            className="bp-input pr-7"
          />
          {filters.keyword && (
            <button
              onClick={() => setKw("")}
              className="absolute right-1 top-1 p-0.5 text-steel-400 hover:text-fire-fail"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-eng text-steel-500 tracking-wider mb-1.5 flex items-center gap-1">
          <Shield size={10} /> 分区
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FIRE_ZONES.map((z) => {
            const on = filters.zones.includes(z.id);
            return (
              <button
                key={z.id}
                onClick={() => toggleZone(z.id)}
                className={`bp-chip transition-colors
                ${on
                  ? "border-blueprint-500 text-blueprint-600 bg-blueprint-50"
                  : "border-paper-300 text-steel-500 bg-paper-50 hover:border-blueprint-300"
                }`}
                style={on ? { boxShadow: `inset 0 0 0 1px ${z.color}` } : {}}
              >
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{ background: z.color }}
                />
                {z.id}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-eng text-steel-500 tracking-wider mb-1.5 flex items-center gap-1">
          <AlertTriangle size={10} /> 碰撞等级
        </label>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(LEVEL_LABEL) as CollisionLevel[]).map((lvl) => {
            const on = filters.levels.includes(lvl);
            return (
              <button
                key={lvl}
                onClick={() => toggleLevel(lvl)}
                className={`text-left px-2 py-1.5 border text-[11px] flex items-center justify-between transition-colors
                ${on
                  ? LEVEL_COLORS[lvl]
                  : "border-paper-300 bg-paper-50 text-steel-500 hover:border-paper-400"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background:
                        lvl === "critical"
                          ? "#d62828"
                          : lvl === "warning"
                            ? "#f77f00"
                            : "#457b9d",
                    }}
                  />
                  {LEVEL_LABEL[lvl]}
                </span>
                <span className="font-eng text-[10px]">{lvl.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-2">
        <label className="text-[10px] font-eng text-steel-500 tracking-wider mb-1.5 flex items-center gap-1">
          <Layers size={10} /> 来源类型
        </label>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(SOURCE_LABEL) as SourceType[]).map((t) => {
            const on = filters.sourceTypes.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleSource(t)}
                className={`text-left px-2 py-1.5 border text-[11px] flex items-center justify-between transition-colors
                ${on
                  ? SOURCE_COLORS[t]
                  : "border-paper-300 bg-paper-50 text-steel-500 hover:border-paper-400"
                }`}
              >
                <span>{SOURCE_LABEL[t]}</span>
                <span className="font-eng text-[10px] tracking-wide">
                  {t.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 p-2 border border-dashed border-paper-300 bg-paper-50 flex items-start gap-2">
        <Shield size={14} className="mt-0.5 text-steel-400 flex-shrink-0" />
        <div className="text-[10px] leading-relaxed text-steel-500">
          <div className="font-eng tracking-wider text-steel-600 mb-0.5">
            RAW 原始字段保留提示
          </div>
          所有导入数据的 <span className="font-eng text-steel-700">raw_</span>{" "}
          字段保留脏数据原样，不自动清洗；筛选与 CSV
          导出口径完全一致。
        </div>
      </div>
    </div>
  );
}

export function LeftPanel() {
  const visible = usePreviewStore((s) => s.getVisibleState());
  return (
    <aside className="w-80 h-full flex-shrink-0 flex flex-col border-r border-paper-300 bg-paper-100/60 backdrop-blur-sm">
      <div className="px-4 py-3 border-b border-paper-300 bg-gradient-to-b from-paper-100 to-paper-50">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-eng text-[10px] text-steel-400 tracking-[0.3em]">
              FIRE · COLLISION · PREVIEW
            </div>
            <div className="font-sans text-sm font-semibold text-steel-700 mt-0.5">
              消防分区碰撞预审
            </div>
          </div>
          <div className="font-eng text-[10px] text-steel-500 flex items-center gap-1">
            <CalendarDays size={10} />
            周一 08:50
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <div className="border border-paper-300 bg-paper-50 py-1.5">
            <div className="font-eng text-base text-fire-critical">
              {visible.allCollisions.filter((c) => c.level === "critical").length}
            </div>
            <div className="text-[9px] text-steel-500 tracking-widest">严重</div>
          </div>
          <div className="border border-paper-300 bg-paper-50 py-1.5">
            <div className="font-eng text-base text-fire-warning">
              {visible.allCollisions.filter((c) => c.level === "warning").length}
            </div>
            <div className="text-[9px] text-steel-500 tracking-widest">警告</div>
          </div>
          <div className="border border-paper-300 bg-paper-50 py-1.5">
            <div className="font-eng text-base text-fire-info">
              {visible.allCollisions.filter((c) => c.level === "info").length}
            </div>
            <div className="text-[9px] text-steel-500 tracking-widest">提示</div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-6">
        <VersionTimeline />
        <div className="border-t border-paper-200 pt-5">
          <FilterPanel />
        </div>
      </div>
    </aside>
  );
}

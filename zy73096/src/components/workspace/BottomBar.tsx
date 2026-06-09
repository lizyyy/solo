import { useMemo } from "react";
import {
  CheckCircle2,
  Download,
  FileDown,
  FilePlus,
  FileWarning,
  Layers,
  ShieldCheck,
  Stamp,
  XCircle,
} from "lucide-react";
import { usePreviewStore } from "@/store/usePreviewStore";
import { CONCLUSION_LABEL, type Conclusion } from "@/types";
import { buildFiltersLabel, toCSV, triggerDownload } from "@/logic/csv";
import { INITIAL_SOURCE_ROWS, VERSION_V1_ID } from "@/data/sourceRows";

const CONCLUSION_STYLE: Record<
  Conclusion,
  { bg: string; border: string; text: string; Icon: typeof CheckCircle2; label: string }
> = {
  pass: {
    bg: "bg-fire-pass/10",
    border: "border-fire-pass",
    text: "text-fire-pass",
    Icon: ShieldCheck,
    label: "预审结论：通过",
  },
  doubt: {
    bg: "bg-fire-doubt/10",
    border: "border-fire-doubt",
    text: "text-fire-doubt",
    Icon: FileWarning,
    label: "预审结论：有疑点",
  },
  fail: {
    bg: "bg-fire-fail/10",
    border: "border-fire-fail",
    text: "text-fire-fail",
    Icon: XCircle,
    label: "预审结论：不通过",
  },
};

export function BottomBar() {
  const visible = usePreviewStore((s) => s.getVisibleState());
  const filters = usePreviewStore((s) => s.filters);
  const openDrawer = usePreviewStore((s) => s.openImportDrawer);
  const operator = usePreviewStore((s) => s.operatorName);
  const resetStoreMonday = usePreviewStore((s) => s.initMondayScenario);
  const sourceRows = usePreviewStore((s) => s.sourceRows);

  const filtersLabel = useMemo(() => buildFiltersLabel(filters), [filters]);

  const style = CONCLUSION_STYLE[visible.conclusion];
  const Icon = style.Icon;

  const exportCSV = () => {
    const rows = visible.filteredRows.length
      ? visible.filteredRows
      : visible.rowsAt;
    const cols = visible.filteredCollisions.length
      ? visible.filteredCollisions
      : visible.allCollisions;
    const finalCols = cols.length ? cols : visible.allCollisions;
    const { filename, content, rowCount } = toCSV(
      rows,
      finalCols,
      visible.version,
      visible.conclusion,
      filtersLabel,
    );
    if (!rowCount) {
      alert("当前筛选结果为空，未生成 CSV。");
      return;
    }
    triggerDownload(filename, content);
  };

  const hasV1 = sourceRows.some((r) => r.versionId === VERSION_V1_ID);

  return (
    <div className="h-16 flex-shrink-0 border-t border-paper-300 bg-gradient-to-b from-paper-100 to-paper-200/80 backdrop-blur-sm flex items-stretch">
      <div className="flex items-center gap-2 px-4 border-r border-paper-300 w-80">
        <button
          onClick={() => {
            if (!hasV1) resetStoreMonday();
            openDrawer(INITIAL_SOURCE_ROWS.slice(0, 5));
          }}
          className="bp-btn"
          title="导入 V1 旧材料（周一早会·步骤1）"
        >
          <FilePlus size={13} />
          导入旧材料
        </button>
        <button
          onClick={() =>
            openDrawer(INITIAL_SOURCE_ROWS.slice(5, 6))
          }
          className="bp-btn"
          title="补录 V2 晚到附件（周一早会·步骤2）"
        >
          <Layers size={13} />
          补录附件
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center gap-3 px-4 border-r border-paper-300">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 border-2 ${style.border} ${style.bg} ${style.text} relative overflow-hidden`}
        >
          <div className="absolute inset-0 opacity-10 noise-bg pointer-events-none" />
          <Icon size={16} className="animate-pulse-slow" />
          <div className="flex flex-col leading-tight">
            <div className="font-eng text-[9px] tracking-[0.25em] opacity-80">
              PRE-REVIEW · CONCLUSION
            </div>
            <div className="font-sans text-sm font-semibold">
              {style.label} · {CONCLUSION_LABEL[visible.conclusion]}
            </div>
          </div>
          <div className="ml-3 flex items-center gap-1.5">
            <Stamp size={12} className="opacity-80" />
            <span className="font-eng text-[9px] tracking-wider">
              {operator}
            </span>
          </div>
        </div>
        <div className="flex flex-col text-[10px] leading-tight">
          <div className="flex items-center gap-1 text-steel-500">
            <span className="font-eng tracking-wider text-steel-600">
              {visible.version?.name ?? "—"}
            </span>
            <span className="text-paper-300">·</span>
            <span>
              源行{" "}
              <span className="font-eng text-steel-700">
                {visible.rowsAt.length}
              </span>
            </span>
            <span className="text-paper-300">·</span>
            <span>
              碰撞点{" "}
              <span className="font-eng text-steel-700">
                {visible.allCollisions.length}
              </span>
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-steel-500">
            <Download size={9} />
            <span>
              当前筛选命中：
              <span className="font-eng text-blueprint-600">
                {visible.filteredRows.length || visible.rowsAt.length}
              </span>{" "}
              行
            </span>
            {filtersLabel && (
              <>
                <span className="text-paper-300">·</span>
                <span className="text-blueprint-600 truncate max-w-sm">
                  {filtersLabel}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 w-[380px]">
        <div className="flex-1 min-w-0 text-[10px] text-steel-500 leading-tight pr-2">
          <div className="font-eng tracking-wider text-steel-600 mb-0.5">
            CSV 明细口径
          </div>
          <div className="truncate">
            ≡ 与屏幕筛选条件 / 当前版本结论完全一致
          </div>
        </div>
        <button
          onClick={exportCSV}
          className="bp-btn bp-btn-primary"
          title="导出 CSV（周一早会·步骤3）"
        >
          <FileDown size={13} />
          导出 CSV
          <span className="font-eng text-[9px] px-1.5 py-0.5 -mr-1 ml-1 bg-blueprint-700/60 border border-blueprint-400/50">
            {(visible.filteredRows.length || visible.rowsAt.length) + "R"}
          </span>
        </button>
      </div>
    </div>
  );
}

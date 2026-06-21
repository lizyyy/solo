import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileDown,
  FilePlus,
  FileWarning,
  Layers,
  RefreshCw,
  ShieldCheck,
  Stamp,
  XCircle,
  XIcon,
} from "lucide-react";
import { usePreviewStore, V1_BATCH_ROWS, V2_BATCH_ROWS } from "@/store/usePreviewStore";
import { CONCLUSION_LABEL, type Conclusion } from "@/types";
import { buildFiltersLabel, toCSV, triggerDownload } from "@/logic/csv";
import { VERSION_V1_ID, VERSION_V2_ID } from "@/data/sourceRows";

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
  const setNotification = (n: { type: "info" | "warn" | "error"; message: string }) =>
    usePreviewStore.setState({ notification: n });
  const operator = usePreviewStore((s) => s.operatorName);
  const resetStore = usePreviewStore((s) => s.resetStore);
  const hasV1 = usePreviewStore((s) => s.hasImportedVersion(VERSION_V1_ID));
  const hasV2 = usePreviewStore((s) => s.hasImportedVersion(VERSION_V2_ID));
  const notification = usePreviewStore((s) => s.notification);
  const clearNotification = usePreviewStore((s) => s.clearNotification);

  const filtersLabel = useMemo(() => buildFiltersLabel(filters), [filters]);

  const style = visible.version
    ? CONCLUSION_STYLE[visible.conclusion]
    : null;
  const Icon = style?.Icon ?? ShieldCheck;

  const exportCSV = () => {
    const rows = visible.filteredRows;
    const cols = visible.filteredCollisions;
    const { filename, content, rowCount } = toCSV(
      rows,
      cols,
      visible.version,
      visible.conclusion,
      filtersLabel || "未筛选",
    );
    triggerDownload(filename, content);
    if (!rowCount) {
      setTimeout(() => {
        usePreviewStore.setState({
          notification: {
            type: "info",
            message: "当前筛选结果为 0 条，CSV 已导出（仅含表头）。",
          },
        });
      }, 50);
    }
  };

  const NOTIFICATION_STYLE = {
    info: "bg-blueprint-500/90 border-blueprint-400 text-paper-50",
    warn: "bg-fire-doubt/90 border-fire-doubt text-paper-50",
    error: "bg-fire-fail/90 border-fire-fail text-paper-50",
  };

  const NOTIFICATION_ICON = {
    info: CheckCircle2,
    warn: AlertTriangle,
    error: XCircle,
  };

  return (
    <div className="h-16 flex-shrink-0 border-t border-paper-300 bg-gradient-to-b from-paper-100 to-paper-200/80 backdrop-blur-sm flex flex-col items-stretch relative">
      {notification && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 -top-11 z-50 flex items-center gap-2 px-3 py-2 border rounded shadow-lg ${NOTIFICATION_STYLE[notification.type]} animate-slide-in-down`}
        >
          {(() => {
            const NotifIcon = NOTIFICATION_ICON[notification.type];
            return <NotifIcon size={14} />;
          })()}
          <span className="text-[11px] font-sans whitespace-nowrap">
            {notification.message}
          </span>
          <button
            onClick={clearNotification}
            className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            <XIcon size={12} />
          </button>
        </div>
      )}

      <div className="flex-1 flex items-stretch">
        <div className="flex items-center gap-2 px-4 border-r border-paper-300 w-80">
          <button
            onClick={() => {
              if (hasV1) {
                setNotification({ type: "warn", message: "旧材料 V1 已导入，请勿重复导入。" });
                return;
              }
              openDrawer(V1_BATCH_ROWS);
            }}
            disabled={false}
            className={`bp-btn ${hasV1 ? "opacity-60" : ""}`}
            title={
              hasV1
                ? "旧材料 V1 已导入"
                : "导入 V1 旧材料（周一早会·步骤1）"
            }
          >
            <FilePlus size={13} />
            {hasV1 ? "已导入旧材料" : "导入旧材料"}
            {hasV1 && (
              <span className="font-eng text-[9px] px-1.5 py-0.5 -mr-1 ml-1 bg-fire-pass/20 border border-fire-pass/40 text-fire-pass">
                V1
              </span>
            )}
          </button>
          <button
            onClick={() => {
              if (!hasV1) {
                setNotification({ type: "warn", message: "请先导入旧材料 V1 后再补录晚到附件。" });
                return;
              }
              if (hasV2) {
                setNotification({ type: "warn", message: "晚到附件 V2 已补录，请勿重复导入。" });
                return;
              }
              openDrawer(V2_BATCH_ROWS);
            }}
            disabled={!hasV1}
            className={`bp-btn ${!hasV1 ? "opacity-40 cursor-not-allowed" : hasV2 ? "opacity-60" : ""}`}
            title={
              !hasV1
                ? "请先导入旧材料 V1 后再补录晚到附件"
                : hasV2
                  ? "晚到附件 V2 已补录"
                  : "补录 V2 晚到附件（周一早会·步骤2）"
            }
          >
            <Layers size={13} />
            {hasV2 ? "已补录附件" : "补录附件"}
            {hasV2 && (
              <span className="font-eng text-[9px] px-1.5 py-0.5 -mr-1 ml-1 bg-fire-doubt/20 border border-fire-doubt/40 text-fire-doubt">
                V2
              </span>
            )}
          </button>
          <button
            onClick={resetStore}
            className="bp-btn !p-1.5"
            title="重置所有数据，回到空白待导入状态"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center gap-3 px-4 border-r border-paper-300">
          {style ? (
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
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 border-2 border-dashed border-paper-300 text-steel-500">
              <ShieldCheck size={16} className="opacity-50" />
              <div className="flex flex-col leading-tight">
                <div className="font-eng text-[9px] tracking-[0.25em] opacity-60">
                  AWAITING · DATA
                </div>
                <div className="font-sans text-sm">
                  请先导入数据，结论将自动计算
                </div>
              </div>
            </div>
          )}

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
                  {visible.filteredRows.length}
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
              ≡ 与屏幕筛选结果逐行对应，筛 0 条则只导表头
            </div>
          </div>
          <button
            onClick={exportCSV}
            disabled={!visible.version}
            className={`bp-btn bp-btn-primary ${!visible.version ? "opacity-40 cursor-not-allowed" : ""}`}
            title={
              !visible.version
                ? "请先导入数据后再导出 CSV"
                : "导出 CSV（与当前筛选结果完全一致）"
            }
          >
            <FileDown size={13} />
            导出 CSV
            <span className="font-eng text-[9px] px-1.5 py-0.5 -mr-1 ml-1 bg-blueprint-700/60 border border-blueprint-400/50">
              {visible.filteredRows.length + "R"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

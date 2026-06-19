import React, { useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Undo2,
  AlertCircle,
  BookmarkMinus,
  CircleCheck,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";
import { clsx } from "clsx";
import { useFittingStore } from "@/stores/fittingStore";
import type { DraftRow, FittingResultRow } from "@/types";

const columnHelper = createColumnHelper<{ row: DraftRow; result?: FittingResultRow }>();

interface ExpandedMap {
  [id: string]: boolean;
}

export default function DraftDataTable() {
  const s = useFittingStore();
  const fitting = s.fitting;
  const resultMap = useMemo(() => {
    const m = new Map<string, FittingResultRow>();
    fitting?.perRow.forEach((r) => m.set(r.rowId, r));
    return m;
  }, [fitting]);

  const data = useMemo(
    () => s.rows.map((r) => ({ row: r, result: resultMap.get(r.id) })),
    [s.rows, resultMap],
  );

  const columns = useMemo(() => [
    columnHelper.display({
      id: "expand",
      size: 36,
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => {
            const id = row.original.row.id;
            s.toggleExplain(`row_${id}`);
          }}
          className="p-1 rounded-sm2 hover:bg-ink-50 text-ink-400"
        >
          {s.explainOpen[`row_${row.original.row.id}`] ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      ),
    }),
    columnHelper.accessor((d) => d.row.seqNo, {
      id: "seq",
      header: "#",
      size: 48,
      cell: (c) => <span className="font-mono text-xs text-ink-500">{c.getValue()}</span>,
    }),
    columnHelper.accessor((d) => d.row.studentId, {
      id: "sid",
      header: "学生编号",
      size: 90,
      cell: (c) => <span className="font-mono text-sm text-ink-700">{c.getValue()}</span>,
    }),
    columnHelper.accessor((d) => d.row.x, {
      id: "x",
      header: () => <span>x <span className="text-ink-400 text-[10px]">(伸长量)</span></span>,
      size: 140,
      cell: (c) => {
        const unit = c.row.original.row.xUnit;
        return (
          <div className="flex items-center gap-1 font-mono text-sm">
            <span className="text-ink-800">{c.getValue().toFixed(4)}</span>
            {unit ? (
              <span className="text-[11px] text-ember-600 font-sans">{unit}</span>
            ) : (
              <span className="chip-fail !py-0">缺单位</span>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor((d) => d.row.y, {
      id: "y",
      header: () => <span>y <span className="text-ink-400 text-[10px]">(拉力)</span></span>,
      size: 140,
      cell: (c) => {
        const unit = c.row.original.row.yUnit;
        return (
          <div className="flex items-center gap-1 font-mono text-sm">
            <span className="text-ink-800">{c.getValue().toFixed(3)}</span>
            {unit ? (
              <span className="text-[11px] text-ember-600 font-sans">{unit}</span>
            ) : (
              <span className="chip-fail !py-0">缺单位</span>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor((d) => d.result?.fittedY, {
      id: "fitted",
      header: "拟合值 ŷ",
      size: 120,
      cell: (c) => {
        const v = c.getValue();
        if (v === undefined || Number.isNaN(v)) {
          return <span className="text-xs text-ink-300 italic">未参与</span>;
        }
        return <span className="font-mono text-sm text-ink-700">{v.toFixed(3)}</span>;
      },
    }),
    columnHelper.accessor((d) => d.result?.deviationPct, {
      id: "dev",
      header: "偏差 %",
      size: 110,
      cell: (c) => {
        const v = c.getValue();
        if (v === undefined || Number.isNaN(v)) {
          return <span className="text-xs text-ink-300 italic">—</span>;
        }
        const abs = Math.abs(v);
        const color = abs > 5 ? "text-verdict-fail" : abs > 2 ? "text-verdict-warn" : "text-verdict-pass";
        return (
          <span className={`font-mono text-sm ${color}`}>
            {v >= 0 ? "+" : ""}{v.toFixed(2)}%
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "status",
      header: "状态标记",
      size: 180,
      cell: ({ row: r }) => <StatusChip row={r.original.row} />,
    }),
    columnHelper.display({
      id: "action",
      header: "操作",
      size: 130,
      cell: ({ row: r }) => {
        const status = r.original.row.status;
        if (status === "unit_missing") {
          return (
            <button
              onClick={() => s.openUnitDialog(r.original.row.id)}
              className="btn-danger !py-1 !px-2 !text-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> 确认单位
            </button>
          );
        }
        return (
          <button
            onClick={() => {
              s.selectRow(r.original.row.id);
              s.toggleExplain(`row_${r.original.row.id}`);
            }}
            className="btn-ghost !py-1 !px-2 !text-xs"
          >
            <Info className="w-3.5 h-3.5" /> 查看详情
          </button>
        );
      },
    }),
  ], [s]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
  });

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <h2 className="card-title">学生草稿数据表</h2>
          <span className="chip-neutral">共 {s.rows.length} 行</span>
          <span className="chip-pass">参与拟合 {fitting?.perRow.filter(r => r.usedInFitting).length ?? 0}</span>
          <span className="chip-warn">边界 {s.rows.filter(r => r.status === "boundary").length}</span>
          <span className="chip-neutral">撤回 {s.rows.filter(r => r.status === "withdrawn").length}</span>
        </div>
        <div className="text-[11px] text-ink-500">
          左侧 <span className="inline-block w-1 h-3 bg-ember-500 rounded-sm align-middle" /> 为边界样本标记，灰底斜体为撤回记录
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-ink-50 text-ink-700 text-xs border-b border-ink-100">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-3 py-2 text-left font-medium whitespace-nowrap"
                    style={{ width: h.getSize() }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => {
              const expanded = !!s.explainOpen[`row_${r.original.row.id}`];
              return (
                <React.Fragment key={r.id}>
                  <tr
                    className={clsx(
                      "row-zebra border-b border-ink-50 relative transition-colors",
                      r.original.row.status === "withdrawn" && "bg-slate2-100/60 italic text-ink-500",
                      r.original.row.status === "boundary" && "",
                    )}
                  >
                    {r.original.row.status === "boundary" && (
                      <td className="absolute left-0 top-0 bottom-0 w-[3px] bg-ember-500 p-0" style={{ padding: 0 }} />
                    )}
                    {r.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-2 whitespace-nowrap"
                        style={{
                          width: cell.column.getSize(),
                          paddingLeft: cell.column.id === "expand" && r.original.row.status === "boundary" ? "10px" : undefined,
                        }}
                      >
                        {r.original.row.status === "withdrawn" && cell.column.id !== "expand" && cell.column.id !== "seq" && cell.column.id !== "sid" && cell.column.id !== "action" ? (
                          <span className="line-through opacity-70">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </span>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </td>
                    ))}
                  </tr>
                  {expanded && (
                    <tr className="bg-paper/80 border-b border-ink-100">
                      <td colSpan={table.getVisibleLeafColumns().length} className="px-6 py-3">
                        <RowDetail row={r.original.row} result={r.original.result} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusChip({ row }: { row: DraftRow }) {
  switch (row.status) {
    case "withdrawn":
      return (
        <span className="chip-neutral">
          <Undo2 className="w-3 h-3" /> 已撤回
        </span>
      );
    case "unit_missing":
      return (
        <span className="chip-fail">
          <AlertCircle className="w-3 h-3" /> 单位缺失
        </span>
      );
    case "boundary":
      return (
        <span className="chip-warn">
          <BookmarkMinus className="w-3 h-3" /> 边界样本
        </span>
      );
    default:
      return (
        <span className="chip-pass">
          <CircleCheck className="w-3 h-3" /> 正常
        </span>
      );
  }
}

function RowDetail({ row, result }: { row: DraftRow; result?: FittingResultRow }) {
  const boundaryD = useFittingStore.getState().boundaryDetails[row.id];
  return (
    <div className="text-xs text-ink-700 grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Detail k="行级状态" v={<StatusChip row={row} />} />
        {row.status === "withdrawn" && row.withdrawReason && (
          <Detail k="撤回理由" v={<span className="text-ink-600">{row.withdrawReason}</span>} />
        )}
        {row.unitConfirmReason && (
          <>
            <Detail k="单位确认理由" v={<span className="text-ink-600">{row.unitConfirmReason}</span>} />
            {row.unitConfirmScope && (
              <Detail k="影响范围" v={<span className="text-ink-600">{row.unitConfirmScope}</span>} />
            )}
          </>
        )}
        {row.status === "boundary" && boundaryD && (
          <Detail k="边界命中说明" v={<span className="text-ember-700">{boundaryD}</span>} />
        )}
      </div>
      <div className="space-y-1.5">
        {result?.usedInFitting ? (
          <>
            <Detail k="拟合值 ŷ" v={<span className="font-mono">{result.fittedY.toFixed(4)}</span>} />
            <Detail k="残差 e = ŷ − y" v={<span className="font-mono">{result.residual.toFixed(5)}</span>} />
            <Detail k="相对偏差" v={
              <span className={`font-mono ${Math.abs(result.deviationPct) > 5 ? "text-verdict-fail" : Math.abs(result.deviationPct) > 2 ? "text-verdict-warn" : "text-verdict-pass"}`}>
                {result.deviationPct >= 0 ? "+" : ""}{result.deviationPct.toFixed(3)}%
              </span>
            } />
            {result.boundaryDetail && (
              <Detail k="边界判定" v={<span className="text-ember-700">{result.boundaryDetail}</span>} />
            )}
          </>
        ) : (
          <div className="p-2 bg-ink-50 rounded-sm2 text-ink-500">
            该行 <b>未参与</b> 曲线拟合计算（{row.status === "withdrawn" ? "已撤回" : "单位缺失待处理"}）。
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 text-ink-500 w-28">{k}：</span>
      <span className="flex-1">{v}</span>
    </div>
  );
}

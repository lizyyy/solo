import { useMemo } from "react";
import { X } from "lucide-react";
import { useTermWallStore } from "@/store/useTermWallStore";
import { getMonthSlice } from "@/utils/aggregate";

function cellColor(direction: "long" | "short" | "missing", intensity: number): string {
  if (direction === "missing") {
    const v = Math.round(107 + (1 - intensity) * 80);
    return `rgb(${v}, ${v}, ${v})`;
  }
  if (direction === "long") {
    const r = 255;
    const g = Math.round(107 + (1 - intensity) * 100);
    const b = Math.round(53 + (1 - intensity) * 150);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const r = Math.round((1 - intensity) * 100);
  const g = Math.round(212 + (1 - intensity) * 30);
  const b = Math.round(170 + (1 - intensity) * 60);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function MonthSliceView() {
  const { sliceViewOpen, sliceMonth, closeSliceView, aggregatedBlocks } = useTermWallStore();

  const { matrix, clients, varieties, totalMargin } = useMemo(() => {
    if (!sliceMonth) return { matrix: [], clients: [], varieties: [], totalMargin: 0 };

    const slice = getMonthSlice(aggregatedBlocks, sliceMonth);
    const clientMap = new Map<string, { name: string; total: number }>();
    for (const b of slice) {
      const cur = clientMap.get(b.clientId);
      if (cur) {
        cur.total += b.totalMargin;
      } else {
        clientMap.set(b.clientId, { name: b.clientName, total: b.totalMargin });
      }
    }

    const topClients = Array.from(clientMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([id, v]) => ({ id, name: v.name }));

    const varietySet = new Set(slice.map((b) => b.varietyCode));
    const varieties = Array.from(varietySet).sort();

    const maxMargin = Math.max(...slice.map((b) => b.totalMargin), 1);

    const matrix: {
      variety: string;
      cells: { margin: number; direction: "long" | "short" | "missing"; intensity: number }[];
    }[] = [];

    for (const v of varieties) {
      const cells = topClients.map((c) => {
        const block = slice.find(
          (b) => b.varietyCode === v && b.clientId === c.id
        );
        if (!block) {
          return { margin: 0, direction: "long" as const, intensity: 0 };
        }
        return {
          margin: block.totalMargin,
          direction: block.direction,
          intensity: Math.max(0.2, block.totalMargin / maxMargin),
        };
      });
      matrix.push({ variety: v, cells });
    }

    const totalMargin = slice.reduce((s, b) => s + b.totalMargin, 0);
    return { matrix, clients: topClients, varieties, totalMargin };
  }, [sliceMonth, aggregatedBlocks]);

  if (!sliceViewOpen || !sliceMonth) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={closeSliceView}
    >
      <div
        className="bg-[#1a1f2e] rounded-xl border border-[#2d3548] shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2d3548]">
          <span className="text-sm font-medium text-slate-200">
            {sliceMonth} 月份切片
          </span>
          <button onClick={closeSliceView} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr>
                <th className="text-left text-slate-500 p-1.5 border-b border-[#2d3548]">
                  品种
                </th>
                {clients.map((c) => (
                  <th
                    key={c.id}
                    className="text-center text-slate-500 p-1.5 border-b border-[#2d3548] font-normal"
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.variety}>
                  <td className="p-1.5 text-slate-300 border-b border-[#2d3548]/50 font-medium">
                    {row.variety}
                  </td>
                  {row.cells.map((cell, i) => (
                    <td
                      key={i}
                      className="p-1.5 text-center border-b border-[#2d3548]/50"
                      style={{
                        backgroundColor:
                          cell.margin > 0
                            ? cellColor(cell.direction, cell.intensity)
                            : "transparent",
                        color: cell.margin > 0 ? "#fff" : "#475569",
                      }}
                    >
                      {cell.margin > 0 ? cell.margin.toLocaleString() : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-[#2d3548] flex items-center justify-between">
          <span className="text-xs text-slate-400">
            保证金合计: <span className="text-white font-medium">{totalMargin.toLocaleString()}</span>
          </span>
          <button
            onClick={closeSliceView}
            className="px-4 py-1.5 rounded bg-[#2d3548] text-xs text-slate-300 hover:bg-[#3a4258]"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

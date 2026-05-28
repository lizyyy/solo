import { AlertTriangle, Check, Filter } from "lucide-react";
import { useWorkbenchStore } from "@/store/useWorkbenchStore";

const COL_BG = "#3E2723";
const COL_ACCENT = "#FFA000";
const COL_DANGER = "#EF5350";
const COL_SAFE = "#66BB6A";

const UNITS: ("g/m" | "kg/m" | "lb/in")[] = ["g/m", "kg/m", "lb/in"];

export default function StringInputPanel() {
  const strings = useWorkbenchStore((s) => s.strings);
  const results = useWorkbenchStore((s) => s.results);
  const filter = useWorkbenchStore((s) => s.filter);
  const setStringRawInput = useWorkbenchStore((s) => s.setStringRawInput);
  const setStringParam = useWorkbenchStore((s) => s.setStringParam);
  const setFilter = useWorkbenchStore((s) => s.setFilter);

  const totalTension = results.reduce((sum, r) => sum + r.tension, 0);

  const visible = strings.filter((s) => {
    if (!filter.stringIds.includes(s.id)) return false;
    const r = results.find((x) => x.stringId === s.id);
    if (filter.anomalyOnly && r && !r.isAnomalous) return false;
    if (filter.tensionRange && r) {
      const [lo, hi] = filter.tensionRange;
      if (r.tension < lo || r.tension > hi) return false;
    }
    return true;
  });

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: COL_BG }}>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-amber-900">
        <Filter size={16} style={{ color: COL_ACCENT }} />
        {strings.map((s) => (
          <label key={s.id} className="flex items-center gap-1 text-xs text-amber-200">
            <input
              type="checkbox"
              checked={filter.stringIds.includes(s.id)}
              onChange={() => {
                const ids = filter.stringIds.includes(s.id)
                  ? filter.stringIds.filter((i) => i !== s.id)
                  : [...filter.stringIds, s.id];
                setFilter({ stringIds: ids });
              }}
              className="accent-amber-600"
            />
            {s.id}
          </label>
        ))}
        <label className="flex items-center gap-1 text-xs text-amber-200 ml-4">
          <input
            type="checkbox"
            checked={filter.anomalyOnly}
            onChange={() => setFilter({ anomalyOnly: !filter.anomalyOnly })}
            className="accent-amber-600"
          />
          仅显示异常
        </label>
        <div className="flex items-center gap-1 ml-4 text-xs text-amber-200">
          张力范围:
          <input
            type="number"
            className="w-14 bg-amber-950 text-amber-100 font-mono px-1 py-0.5 rounded text-xs"
            value={filter.tensionRange?.[0] ?? ""}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setFilter({ tensionRange: [isNaN(v) ? 0 : v, filter.tensionRange?.[1] ?? 999] });
            }}
          />
          -
          <input
            type="number"
            className="w-14 bg-amber-950 text-amber-100 font-mono px-1 py-0.5 rounded text-xs"
            value={filter.tensionRange?.[1] ?? ""}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setFilter({ tensionRange: [filter.tensionRange?.[0] ?? 0, isNaN(v) ? 999 : v] });
            }}
          />
          N
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-amber-300 text-xs border-b border-amber-900">
            <th className="px-2 py-1.5 text-center">#</th>
            <th className="px-2 py-1.5 text-left">弦名</th>
            <th className="px-2 py-1.5 text-right font-mono">弦长(mm)</th>
            <th className="px-2 py-1.5 text-center">音高</th>
            <th className="px-2 py-1.5 text-right font-mono">频率(Hz)</th>
            <th className="px-2 py-1.5 text-right font-mono">线密度</th>
            <th className="px-2 py-1.5 text-center">单位</th>
            <th className="px-2 py-1.5 text-right font-mono">弦径(mm)</th>
            <th className="px-2 py-1.5 text-right font-mono">张力(N)</th>
            <th className="px-2 py-1.5 text-right font-mono">张力占比</th>
            <th className="px-2 py-1.5 text-center">状态</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((s) => {
            const r = results.find((x) => x.stringId === s.id);
            const pct = totalTension > 0 && r ? (r.tension / totalTension * 100) : 0;
            return (
              <tr
                key={s.id}
                className="border-b border-amber-950 text-amber-100"
                style={r?.isAnomalous ? { borderLeft: `3px solid ${COL_DANGER}` } : {}}
              >
                <td className="px-2 py-1 text-center font-mono">{s.id}</td>
                <td className="px-2 py-1 text-left">{s.name}</td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    className="w-full bg-amber-950 text-right font-mono px-1 py-0.5 rounded text-amber-100"
                    value={s.rawInputs.scaleLength}
                    onChange={(e) => setStringRawInput(s.id, "scaleLength", e.target.value)}
                  />
                </td>
                <td className="px-2 py-1 text-center">{s.targetNote}</td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    className="w-full bg-amber-950 text-right font-mono px-1 py-0.5 rounded text-amber-100"
                    value={s.rawInputs.frequency}
                    onChange={(e) => setStringRawInput(s.id, "frequency", e.target.value)}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    className="w-full bg-amber-950 text-right font-mono px-1 py-0.5 rounded text-amber-100"
                    value={s.rawInputs.linearDensity}
                    onChange={(e) => setStringRawInput(s.id, "linearDensity", e.target.value)}
                  />
                </td>
                <td className="px-2 py-1 text-center">
                  <select
                    className="bg-amber-950 text-amber-100 px-1 py-0.5 rounded text-xs"
                    value={s.linearDensityUnit}
                    onChange={(e) => setStringParam(s.id, "linearDensityUnit", e.target.value as "g/m" | "kg/m" | "lb/in")}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    className="w-full bg-amber-950 text-right font-mono px-1 py-0.5 rounded text-amber-100"
                    value={s.rawInputs.gauge}
                    onChange={(e) => setStringRawInput(s.id, "gauge", e.target.value)}
                  />
                </td>
                <td className="px-2 py-1 text-right font-mono">
                  {r ? r.tension.toFixed(2) : "—"}
                </td>
                <td className="px-2 py-1 text-right font-mono">
                  {pct > 0 ? `${pct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-2 py-1 text-center">
                  {r?.isAnomalous ? (
                    <AlertTriangle size={16} style={{ color: COL_DANGER }} />
                  ) : r ? (
                    <Check size={16} style={{ color: COL_SAFE }} />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

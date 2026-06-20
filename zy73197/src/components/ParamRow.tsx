import { cn } from "@/lib/utils";
import { unitOptions } from "@/engine/units";
import type { GroupId, Param } from "@/engine/types";
import { useStore } from "@/store/useStore";
import { StatusBadge } from "./StatusBadge";

interface Props {
  group: GroupId;
  param: Param;
}

export function ParamRow({ group, param }: Props) {
  const setParamValue = useStore((s) => s.setParamValue);
  const setParamUnit = useStore((s) => s.setParamUnit);
  const setRawFieldName = useStore((s) => s.setRawFieldName);
  const opts = unitOptions(param.key);

  return (
    <div className="grid grid-cols-[1.1fr_110px_92px_104px] items-center gap-2 py-2">
      <div className="min-w-0">
        <div className="truncate text-[13px] text-bone">{param.canonicalName}</div>
        <input
          value={param.rawFieldName}
          onChange={(e) => setRawFieldName(group, param.key, e.target.value)}
          className="mt-0.5 w-full bg-transparent font-mono text-[10px] text-ash outline-none focus:text-amber"
          placeholder="来源字段名"
        />
      </div>

      <input
        value={param.value}
        onChange={(e) => setParamValue(group, param.key, e.target.value)}
        inputMode="decimal"
        className={cn(
          "w-full border border-line bg-carbon-950/60 px-2 py-1.5 font-mono text-[13px] text-bone tnum outline-none focus:border-amber/60",
          param.status === "blocked" && "border-block/50",
        )}
      />

      <select
        value={param.unit}
        onChange={(e) => setParamUnit(group, param.key, e.target.value)}
        className={cn(
          "w-full border bg-carbon-950/60 px-1.5 py-1.5 font-mono text-[11px] outline-none focus:border-amber/60",
          param.unit ? "border-line text-bone" : "border-block/50 text-block",
        )}
      >
        <option value="">（未填）</option>
        {opts.map((o) => (
          <option key={o} value={o} className="text-bone">
            {o}
          </option>
        ))}
      </select>

      <StatusBadge kind="param" status={param.status} />
    </div>
  );
}

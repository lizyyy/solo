import type { DiffChunk } from "@/types";
import { friendlyKey, formatValue, STATUS_LABEL } from "@/utils/diff";

interface Props {
  chunks: DiffChunk[];
  compact?: boolean;
}

export default function DiffViewer({ chunks, compact }: Props) {
  const visible = compact ? chunks.filter((c) => c.changed) : chunks;
  if (visible.length === 0) {
    return (
      <div className="text-xs text-warm-500 py-3 text-center">
        未检测到字段变动
      </div>
    );
  }
  return (
    <div
      className={`grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-2 text-xs ${
        compact ? "" : "w-full"
      }`}
    >
      {visible.map((c, i) => {
        const k = friendlyKey(c.key);
        const before = formatLabelValue(c.key, c.before);
        const after = formatLabelValue(c.key, c.after);
        return (
          <div
            key={c.key + i}
            className={`contents ${c.changed ? "" : "opacity-60"}`}
          >
            <div className="pt-1 text-warm-500 whitespace-nowrap">{k}</div>
            <div
              className={`rounded-md px-2 py-1 ${
                c.changed
                  ? "bg-danger-50 text-danger-700 line-through decoration-danger-400"
                  : "bg-warm-50 text-warm-700"
              } break-all`}
            >
              {before}
            </div>
            <div
              className={`rounded-md px-2 py-1 ${
                c.changed
                  ? "bg-success-50 text-success-700 ring-1 ring-inset ring-success-200"
                  : "bg-warm-50 text-warm-700"
              } break-all`}
            >
              {after}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatLabelValue(key: string, v: unknown): string {
  if (key === "status" && typeof v === "string") {
    return STATUS_LABEL[v] ?? v;
  }
  return formatValue(v);
}

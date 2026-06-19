import { SOURCE_META, type NoteSourceType } from "@/types";
import { cn } from "@/lib/utils";

interface SourceTagProps {
  type: NoteSourceType;
  size?: "sm" | "md";
  className?: string;
}

export function SourceTag({ type, size = "sm", className }: SourceTagProps) {
  const meta = SOURCE_META[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-atlas border font-mono-data uppercase tracking-wider",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        className,
      )}
      style={{
        color: meta.colorVar,
        borderColor: meta.colorVar,
        backgroundColor: meta.softVar,
      }}
      title={meta.desc}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.colorVar }}
      />
      {meta.label}
    </span>
  );
}

import {
  ClipboardList,
  FileText,
  MessageCircle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  SOURCE_META,
  STATUS_META,
  type SourceType,
  type ConfirmStatus,
} from "@/types";
import { cn } from "@/lib/utils";

type BadgeChipSourceProps = {
  type: "source";
  value: SourceType;
  className?: string;
};

type BadgeChipStatusProps = {
  type: "status";
  value: ConfirmStatus;
  className?: string;
};

export type BadgeChipProps = BadgeChipSourceProps | BadgeChipStatusProps;

const SourceIconMap: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  normal: ClipboardList,
  old_visa: FileText,
  verbal: MessageCircle,
  anomaly: AlertOctagon,
};

const StatusIconMap: Record<ConfirmStatus, React.ComponentType<{ className?: string }>> = {
  confirmed: CheckCircle2,
  pending_evidence: Clock,
  rejected: XCircle,
  processing: Loader2,
};

export default function BadgeChip(props: BadgeChipProps) {
  if (props.type === "source") {
    const meta = SOURCE_META[props.value];
    const Icon = SourceIconMap[props.value];
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
          meta.bgColor,
          meta.color,
          meta.borderColor,
          props.className
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {meta.label}
      </span>
    );
  }

  const meta = STATUS_META[props.value];
  const Icon = StatusIconMap[props.value];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
        meta.bgColor,
        meta.color,
        meta.borderColor,
        props.className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", meta.dotColor)} />
      <Icon className={cn("w-3.5 h-3.5", props.value === "processing" && "animate-spin")} />
      {meta.label}
    </span>
  );
}

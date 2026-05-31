import { getStatusStyle, getStatusLabel } from "@/utils/statusHelpers";
import type { EventStatus } from "@/types";

interface StatusTagProps {
  status: EventStatus;
  compact?: boolean;
}

export default function StatusTag({ status, compact }: StatusTagProps) {
  const style = getStatusStyle(status);
  const label = getStatusLabel(status);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text} ${style.border} border`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${style.bg} ${style.text} ${style.border} border`}
    >
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
}

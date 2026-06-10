import { Link } from "react-router-dom";
import { AlertTriangle, User, Clock } from "lucide-react";
import type { Checklist } from "shared/types";
import StatusBadge from "@/components/StatusBadge";
import VersionChip from "@/components/VersionChip";
import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";

interface ChecklistCardProps {
  checklist: Checklist;
}

export default function ChecklistCard({ checklist }: ChecklistCardProps) {
  const { id, code, projectName, layerName, isLayerNameValid, status, versions, assignee, updatedAt } = checklist;

  const latestVersions = versions.filter((v) => v.isLatest);

  return (
    <Link
      to={`/checklist/${id}`}
      className={cn(
        "card relative p-4 block transition-all duration-150",
        "hover:shadow-md hover:-translate-y-0.5",
        "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0 before:bg-brand-600 before:rounded-l-sm2 before:transition-all",
        "hover:before:w-1"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="font-mono text-sm text-ink-500">{code}</span>
        <StatusBadge status={status} />
      </div>

      <h3 className="font-serif text-lg font-bold text-ink-800 mb-3 leading-snug">
        {projectName}
      </h3>

      <div
        className={cn(
          "flex items-center gap-1.5 mb-4 text-sm",
          isLayerNameValid ? "text-ink-600" : "text-accent-suspended"
        )}
      >
        <span className="font-mono">{layerName}</span>
        {!isLayerNameValid && (
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        )}
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {latestVersions.map((v) => (
          <VersionChip key={v.version} version={v} />
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-ink-500 pt-3 border-t border-ink-100">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          <span>{assignee || "未分配"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDate(updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

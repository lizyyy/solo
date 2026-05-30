import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useStore } from "@/store/useStore";
import { STATUS_LABELS } from "@/types";
import type { EventStatus } from "@/types";

interface StateMachineProps {
  eventId: string;
}

const MAIN_FLOW: EventStatus[] = [
  "pending_announcement",
  "announcement_matched",
  "voting_in_progress",
  "voting_completed",
  "payout_calculating",
  "under_review",
  "review_passed",
];

const BRANCH_STATE: EventStatus = "review_failed";

export default function StateMachine({ eventId }: StateMachineProps) {
  const allTransitions = useStore((s) => s.statusTransitions);
  const transitions = useMemo(
    () => allTransitions.filter((t) => t.eventId === eventId).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [allTransitions, eventId]
  );

  const visitedStatuses = new Set<EventStatus>();
  let currentStatus: EventStatus | null = null;

  for (const t of transitions) {
    visitedStatuses.add(t.toStatus);
    if (t.fromStatus) visitedStatuses.add(t.fromStatus);
  }

  if (transitions.length > 0) {
    currentStatus = transitions[transitions.length - 1].toStatus;
  }

  const mainFlowIndex = currentStatus ? MAIN_FLOW.indexOf(currentStatus) : -1;
  const branchActive = currentStatus === BRANCH_STATE;

  return (
    <div className="bg-[#1a1f36] border border-[#2a3050] rounded-lg p-4">
      <h3 className="text-[#f0ece4] font-medium text-sm mb-4">状态流转</h3>

      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {MAIN_FLOW.map((status, index) => {
          const isCurrent = status === currentStatus;
          const isPast =
            mainFlowIndex >= 0 && index < mainFlowIndex;
          const isFuture =
            mainFlowIndex >= 0 && index > mainFlowIndex;

          const isBranchPoint = status === "under_review";

          return (
            <div key={status} className="flex items-center shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`
                    px-2 py-1.5 rounded text-xs whitespace-nowrap
                    ${
                      isCurrent
                        ? "bg-[#e8a838]/20 text-[#e8a838] border border-[#e8a838]/50 shadow-[0_0_12px_rgba(232,168,56,0.3)]"
                        : isPast
                        ? "bg-[#2dd4a8]/10 text-[#2dd4a8] border border-[#2dd4a8]/30"
                        : "bg-[#0f1225] text-[#6b7894] border border-[#2a3050]"
                    }
                  `}
                >
                  {STATUS_LABELS[status]}
                </div>

                {isBranchPoint && (
                  <div className="flex flex-col items-center mt-1">
                    <div
                      className="w-px h-3"
                      style={{
                        borderLeft: "2px dashed",
                        borderColor: branchActive
                          ? "#ef4444"
                          : "#2a3050",
                      }}
                    />
                    <div
                      className={`
                        px-1.5 py-0.5 rounded text-xs whitespace-nowrap
                        ${
                          branchActive
                            ? "bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/50"
                            : "bg-[#0f1225] text-[#6b7894] border border-[#2a3050]"
                        }
                      `}
                      style={{
                        borderLeft: branchActive
                          ? undefined
                          : "2px dashed #2a3050",
                      }}
                    >
                      {STATUS_LABELS[BRANCH_STATE]}
                    </div>
                  </div>
                )}
              </div>

              {index < MAIN_FLOW.length - 1 && (
                <ChevronRight
                  className={`w-3 h-3 mx-0.5 shrink-0 ${
                    isPast
                      ? "text-[#2dd4a8]"
                      : isCurrent
                      ? "text-[#e8a838]"
                      : "text-[#2a3050]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {transitions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#2a3050] space-y-1">
          {transitions.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <span className="text-[#6b7894] font-mono shrink-0">
                {new Date(t.timestamp).toLocaleString("zh-CN")}
              </span>
              <span className="text-[#f0ece4]">
                {t.fromStatus ? STATUS_LABELS[t.fromStatus] : "初始"}
              </span>
              <ChevronRight className="w-3 h-3 text-[#6b7894] shrink-0" />
              <span className="text-[#e8a838]">
                {STATUS_LABELS[t.toStatus]}
              </span>
              <span className="text-[#6b7894]">
                ({t.operator}: {t.reason})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

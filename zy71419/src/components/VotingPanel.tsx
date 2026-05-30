import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Vote } from "lucide-react";
import { useStore } from "@/store/useStore";

interface VotingPanelProps {
  eventId: string;
}

const VOTE_RESULT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  approve: { bg: "bg-[#2dd4a8]/20", text: "text-[#2dd4a8]", label: "赞成" },
  reject: { bg: "bg-[#ef4444]/20", text: "text-[#ef4444]", label: "反对" },
  abstain: { bg: "bg-[#6b7894]/20", text: "text-[#6b7894]", label: "弃权" },
};

export default function VotingPanel({ eventId }: VotingPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const allVotes = useStore((s) => s.votes);
  const votes = useMemo(
    () => allVotes.filter((v) => v.eventId === eventId).sort((a, b) => a.votedAt.localeCompare(b.votedAt)),
    [allVotes, eventId]
  );

  const approveCount = votes.filter((v) => v.voteResult === "approve").length;
  const rejectCount = votes.filter((v) => v.voteResult === "reject").length;
  const abstainCount = votes.filter((v) => v.voteResult === "abstain").length;

  return (
    <div className="bg-[#1a1f36] border border-[#2a3050] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#222845] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Vote className="w-4 h-4 text-[#e8a838]" />
          <span className="text-[#f0ece4] font-medium text-sm">委员会投票</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#6b7894]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#6b7894]" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {votes.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[#2dd4a8] font-mono">{approveCount}赞成</span>
              <span className="text-[#6b7894]">/</span>
              <span className="text-[#ef4444] font-mono">{rejectCount}反对</span>
              <span className="text-[#6b7894]">/</span>
              <span className="text-[#6b7894] font-mono">{abstainCount}弃权</span>
            </div>
          )}

          {votes.length === 0 && (
            <p className="text-[#6b7894] text-xs">暂无投票记录</p>
          )}

          <div className="space-y-2">
            {votes.map((vote) => {
              const style = VOTE_RESULT_STYLES[vote.voteResult];
              return (
                <div
                  key={vote.id}
                  className="bg-[#0f1225] border border-[#2a3050] rounded p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[#f0ece4] text-xs font-medium">
                        {vote.voterName}
                      </span>
                      <span className="text-[#6b7894] text-xs">{vote.voterRole}</span>
                    </div>
                    <span
                      className={`${style.bg} ${style.text} text-xs px-2 py-0.5 rounded font-medium`}
                    >
                      {style.label}
                    </span>
                  </div>
                  <p className="text-[#6b7894] text-xs">{vote.voteBasis}</p>
                  <p className="text-[#6b7894] text-xs font-mono">
                    {new Date(vote.votedAt).toLocaleString("zh-CN")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { useStore } from "@/store/useStore";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { EventStatus } from "@/types";
import ContractTermsPanel from "@/components/ContractTermsPanel";
import AnnouncementPanel from "@/components/AnnouncementPanel";
import VotingPanel from "@/components/VotingPanel";
import EvidenceTimeline from "@/components/EvidenceTimeline";
import StateMachine from "@/components/StateMachine";
import PayoutCalculation from "@/components/PayoutCalculation";
import ManualSupplementList from "@/components/ManualSupplementList";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const event = useStore((s) => s.events.find((e) => e.id === id));
  const exportReviewResult = useStore((s) => s.exportReviewResult);

  if (!event) {
    return (
      <div className="min-h-screen bg-[#0f1225] flex items-center justify-center">
        <p className="text-[#6b7894]">事件不存在</p>
      </div>
    );
  }

  const handleExport = () => {
    const result = exportReviewResult(event.id);
    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `复核报告_${event.id}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0f1225] text-[#f0ece4]">
      <header className="border-b border-[#2a3050] px-6 py-4 sticky top-0 bg-[#0f1225] z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1 text-[#6b7894] hover:text-[#f0ece4] transition-colors text-sm"
            >
              <ArrowLeft size={16} />
              返回列表
            </button>
            <div className="h-4 w-px bg-[#2a3050]" />
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-[#6b7894]">{event.id}</span>
              <h1 className="text-lg font-semibold">{event.eventName}</h1>
              <span
                className="rounded px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${STATUS_COLORS[event.status]}20`,
                  color: STATUS_COLORS[event.status as EventStatus],
                }}
              >
                {STATUS_LABELS[event.status as EventStatus]}
              </span>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-[#e8a838] hover:bg-[#d4962f] text-[#0f1225] px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            <Download size={14} />
            导出复核结果
          </button>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto p-6 space-y-6">
        <StateMachine eventId={event.id} />

        <div className="grid grid-cols-3 gap-6">
          <ContractTermsPanel eventId={event.id} />
          <AnnouncementPanel eventId={event.id} />
          <VotingPanel eventId={event.id} />
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-7">
            <EvidenceTimeline eventId={event.id} />
          </div>
          <div className="col-span-5 space-y-6">
            <PayoutCalculation eventId={event.id} />
            <ManualSupplementList eventId={event.id} />
          </div>
        </div>
      </main>
    </div>
  );
}

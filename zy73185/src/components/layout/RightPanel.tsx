import NoteTimeline from "@/components/review/NoteTimeline";
import DeliveryPanel from "@/components/export/DeliveryPanel";
import { BookMarked, Share2 } from "lucide-react";

export default function RightPanel() {
  return (
    <aside
      className="w-[340px] shrink-0 h-full flex flex-col gap-4 p-4 animate-fade-in-up"
      style={{ animationDelay: "240ms" }}
    >
      <section className="card flex-1 min-h-0 flex flex-col p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookMarked size={18} className="text-ink-500" />
          <h2 className="section-title">历史备注</h2>
        </div>
        <p className="text-xs text-ink-400 mb-3">
          每次运行的备注均保留，新备注追加不覆盖
        </p>
        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin pr-1">
          <NoteTimeline />
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Share2 size={18} className="text-ink-500" />
          <h2 className="section-title">交付导出</h2>
        </div>
        <p className="text-xs text-ink-400 mb-4">
          学生草稿 · 处理记录 · 页面摘要 三合一
        </p>
        <DeliveryPanel />
      </section>
    </aside>
  );
}

import DraftImport from "@/components/drafts/DraftImport";
import DraftList from "@/components/drafts/DraftList";
import { ScrollText } from "lucide-react";

export default function LeftPanel() {
  return (
    <aside
      className="w-[360px] shrink-0 h-full flex flex-col gap-4 p-4 animate-fade-in-up"
      style={{ animationDelay: "0ms" }}
    >
      <section className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ScrollText size={18} className="text-ink-500" />
          <h2 className="section-title">学生草稿</h2>
        </div>
        <DraftImport />
      </section>

      <section className="card flex-1 min-h-0 flex flex-col p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="label">草稿列表</h3>
          <span className="text-xs text-ink-400 font-mono">
            支持不齐整材料
          </span>
        </div>
        <DraftList />
      </section>
    </aside>
  );
}

import { Download, Clock, ClipboardCheck, Table2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { AppState } from "@/data/types";

type ViewKey = AppState["view"];

const NAV_ITEMS: { label: string; view: ViewKey; icon: React.ElementType }[] = [
  { label: "工作台", view: "workbench", icon: Table2 },
  { label: "历史时间线", view: "timeline", icon: Clock },
  { label: "复核看板", view: "review", icon: ClipboardCheck },
];

export default function Header() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const exportCurrent = useAppStore((s) => s.exportCurrent);

  return (
    <header
      className="flex items-center justify-between px-6 py-3"
      style={{ background: "linear-gradient(135deg, #0A2540, #1D3A6B)" }}
    >
      <h1 className="font-display text-xl font-bold text-white tracking-wide">
        🪸 珊瑚白化异常预警
      </h1>

      <nav className="flex items-center gap-2">
        {NAV_ITEMS.map(({ label, view: targetView, icon: Icon }) => {
          const active = view === targetView;
          return (
            <button
              key={targetView}
              onClick={() => setView(targetView)}
              className={`
                inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition
                ${
                  active
                    ? "bg-white/20 text-white shadow-sm"
                    : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                }
              `}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}

        <button
          onClick={exportCurrent}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition"
        >
          <Download size={15} />
          导出
        </button>
      </nav>
    </header>
  );
}

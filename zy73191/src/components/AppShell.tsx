import { NavLink, Outlet } from "react-router-dom";
import { Inbox, FileText, History } from "lucide-react";

const tabs = [
  { to: "/", label: "材料台", icon: Inbox },
  { to: "/report", label: "复核报告", icon: FileText },
  { to: "/audit", label: "判断历史", icon: History },
];

export default function AppShell() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-2xl font-bold text-vermilion">§</span>
            <div>
              <h1 className="font-serif text-lg font-bold leading-none text-ink">
                数列递推边界复核
              </h1>
              <p className="mt-1.5 text-[11px] tracking-[0.18em] text-inkMute">
                REVIEW DOSSIER · 边界复核档案
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === "/"}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition ${
                    isActive
                      ? "bg-ink text-paper"
                      : "text-inkSoft hover:bg-paperDeep"
                  }`
                }
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-6 pb-10 pt-6 text-center text-[11px] text-inkMute">
        纯前端复核档案 · 数据本地保存 · 打开即跑，无需问材料放哪
      </footer>
    </div>
  );
}

import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard },
  { to: "/trace", icon: FileText },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-[#1a1f2e] font-['DM_Sans'] text-[#f0ece4]">
      <aside className="flex w-16 flex-col items-center gap-2 bg-[#151926] py-6">
        {navItems.map(({ to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-[#22c55e]/10 text-[#22c55e] before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-[#22c55e]"
                  : "text-[#f0ece4]/50 hover:bg-[#242938] hover:text-[#f0ece4]"
              )
            }
          >
            <Icon size={20} />
          </NavLink>
        ))}
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-[#2a3042] px-6">
          <h1 className="text-base font-semibold tracking-wide">
            保理应收账款转让分析
          </h1>
          <span className="ml-3 text-xs text-[#f0ece4]/40">
            Factoring Receivable Transfer Analysis
          </span>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { NavLink, useLocation } from "react-router-dom";
import { Package, Route, AlertTriangle, RotateCcw } from "lucide-react";
import { useWarehouseStore } from "@/store/useWarehouseStore";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { to: "/", label: "路线管理", icon: Package },
  { to: "/optimize", label: "路径计算", icon: Route },
  { to: "/exceptions", label: "异常报告", icon: AlertTriangle },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "路线管理",
  "/optimize": "路径计算",
  "/exceptions": "异常报告",
};

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const orders = useWarehouseStore((s) => s.orders);
  const locations = useWarehouseStore((s) => s.locations);
  const exceptions = useWarehouseStore((s) => s.exceptions);
  const resetToSeed = useWarehouseStore((s) => s.resetToSeed);

  const pageTitle = PAGE_TITLES[location.pathname] ?? "仓储拣货路径重排工具";

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-60 flex-shrink-0 flex-col bg-gradient-to-b from-navy-800 to-navy-900 border-r border-navy-700/50">
        <div className="flex flex-col gap-1 px-5 pt-6 pb-4">
          <h1 className="text-xl font-bold tracking-tight text-gray-50">
            拣货路径
          </h1>
          <p className="text-sm text-gray-400 font-medium">重排工具</p>
          <div className="mt-2 h-1 w-8 rounded-full bg-industrial-orange" />
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-l-2 border-industrial-orange bg-navy-700/60 text-industrial-orange"
                    : "text-gray-400 hover:bg-navy-700/30 hover:text-gray-200"
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-navy-700/50 px-5 py-4">
          <button
            onClick={resetToSeed}
            className="flex items-center gap-2 text-xs text-gray-500 transition-colors hover:text-industrial-orange"
          >
            <RotateCcw size={14} />
            <span>重置数据</span>
          </button>
        </div>

        <div className="h-1 bg-industrial-orange" />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-navy-700/50 bg-navy-800/50 px-6 backdrop-blur-sm">
          <h2 className="text-base font-semibold text-gray-100">{pageTitle}</h2>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">订单数</span>
              <span className="font-mono text-sm font-semibold text-industrial-blue">
                {orders.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">库位数</span>
              <span className="font-mono text-sm font-semibold text-industrial-green">
                {locations.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">异常数</span>
              <span className="font-mono text-sm font-semibold text-industrial-red">
                {exceptions.length}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-navy-900 p-6">{children}</main>
      </div>
    </div>
  );
}

import { Link, useLocation } from "react-router-dom";
import { FileText, Shield, LayoutGrid, Settings, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "修复记录", icon: FileText, to: "/" },
  { label: "保险单管理", icon: Shield, to: "/insurance" },
  { label: "布展清单", icon: LayoutGrid, to: "/exhibition" },
  { label: "操作中心", icon: Settings, to: "/operations" },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 flex flex-col bg-[var(--color-charcoal)] text-white">
      <div className="px-6 py-6 border-b border-white/10">
        <h1 className="text-xl font-serif font-semibold tracking-wide text-[var(--color-amber)]">
          藏品修复记录
        </h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/" || location.pathname.startsWith("/record")
              : location.pathname.startsWith(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--color-amber)]/15 text-[var(--color-amber)]"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-white/10">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Database className="w-3.5 h-3.5" />
          <span>数据已本地保存</span>
        </div>
      </div>
    </aside>
  );
}

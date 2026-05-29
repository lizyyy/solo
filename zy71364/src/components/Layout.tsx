import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderOpen, FileText, Palette } from "lucide-react";

const navItems = [
  { to: "/", label: "首页仪表盘", icon: LayoutDashboard },
  { to: "/artworks", label: "作品档案", icon: FolderOpen },
  { to: "/reports", label: "报告导出", icon: FileText },
];

const breadcrumbMap: Record<string, string> = {
  "/": "首页仪表盘",
  "/artworks": "作品档案",
  "/reports": "报告导出",
};

export default function Layout() {
  const location = useLocation();
  const pathParts = location.pathname.split("/").filter(Boolean);

  const breadcrumbs = pathParts.length === 0
    ? [{ label: "首页仪表盘", path: "/" }]
    : pathParts.reduce<Array<{ label: string; path: string }>>((acc, part, i) => {
        const path = "/" + pathParts.slice(0, i + 1).join("/");
        const label = breadcrumbMap[path] || (part.match(/^[0-9a-f-]+$/) ? "详情" : part);
        acc.push({ label, path });
        return acc;
      }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 flex-shrink-0 flex flex-col" style={{ backgroundColor: "#3D2B0A" }}>
        <div className="px-6 py-5 border-b border-primary-700/30">
          <div className="flex items-center gap-3">
            <Palette className="text-amber" size={28} />
            <h1 className="font-serif text-xl font-bold text-ivory-100">修复档案</h1>
          </div>
          <p className="text-primary-200 text-xs mt-1">艺术品修复记录管理系统</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-600/40 text-amber"
                    : "text-primary-100 hover:bg-primary-600/20 hover:text-ivory-100"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-primary-700/30">
          <p className="text-primary-300 text-xs">© 修复档案系统 v1.0</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden bg-ivory">
        <header className="h-12 flex items-center px-6 border-b border-primary-100 bg-white/60 backdrop-blur-sm">
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-2">
                {i > 0 && <span className="text-primary-200">/</span>}
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-primary-800 font-medium">{crumb.label}</span>
                ) : (
                  <NavLink to={crumb.path} className="text-primary-400 hover:text-primary-600 transition-colors">
                    {crumb.label}
                  </NavLink>
                )}
              </span>
            ))}
          </nav>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

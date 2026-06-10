import { Link } from "react-router-dom";
import { ChevronLeft, Home, Droplets, CalendarCheck, Plus } from "lucide-react";
import RoleSwitcher from "./RoleSwitcher";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface AppHeaderProps {
  breadcrumb?: BreadcrumbItem[];
  showBack?: boolean;
  backTo?: string;
  className?: string;
}

export default function AppHeader({
  breadcrumb,
  showBack = false,
  backTo = "/",
  className,
}: AppHeaderProps) {
  const isHome = !breadcrumb && !showBack;

  return (
    <header className={cn("bg-white border-b border-ink-200 sticky top-0 z-30", className)}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-sm2 bg-brand-600 flex items-center justify-center shadow-inset">
              <Droplets className="w-4 h-4 text-white" />
            </div>
            <span className="font-serif font-bold text-ink-800 text-sm tracking-wide">
              屋面排水交底
            </span>
          </Link>

          <div className="h-4 w-px bg-ink-200 shrink-0" />

          {isHome ? (
            <nav className="flex items-center gap-1">
              <Link
                to="/review"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-ink-600 hover:text-brand-600 hover:bg-brand-50 border border-transparent hover:border-brand-200 rounded-sm2 transition-colors"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>月底复核</span>
              </Link>

              <Link
                to="/checklist/new"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-sm2 transition-colors shadow-inset border border-brand-700"
              >
                <Plus className="w-4 h-4" />
                <span>新建</span>
              </Link>
            </nav>
          ) : (
            <>
              {showBack && (
                <Link
                  to={backTo}
                  className="inline-flex items-center gap-1 text-xs text-ink-600 hover:text-brand-600 font-medium shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  返回列表
                </Link>
              )}

              {breadcrumb && breadcrumb.length > 0 && (
                <nav className="flex items-center gap-1.5 text-xs text-ink-500 min-w-0">
                  <Link to="/" className="hover:text-brand-600 shrink-0">
                    <Home className="w-3.5 h-3.5" />
                  </Link>
                  {breadcrumb.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 min-w-0">
                      <span className="text-ink-300">/</span>
                      {item.to ? (
                        <Link
                          to={item.to}
                          className="hover:text-brand-600 text-ink-700 font-medium truncate"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <span className="text-ink-700 font-medium truncate">
                          {item.label}
                        </span>
                      )}
                    </div>
                  ))}
                </nav>
              )}
            </>
          )}
        </div>

        <div className="shrink-0">
          <RoleSwitcher />
        </div>
      </div>
    </header>
  );
}

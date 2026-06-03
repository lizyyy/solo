import { NavLink, Outlet } from "react-router-dom"
import { Upload, ClipboardCheck, MapPin, BarChart3, RotateCcw } from "lucide-react"
import { useStore } from "@/store/useStore"

const NAV_ITEMS = [
  { to: "/import", icon: Upload, label: "导入" },
  { to: "/review", icon: ClipboardCheck, label: "复核" },
  { to: "/obstructions", icon: MapPin, label: "遮挡点" },
  { to: "/grading", icon: BarChart3, label: "分级" },
]

const STEP_LABELS: Record<string, string> = {
  import: "导入",
  review_remark: "补看备注",
  update_list: "更新清单",
}

const STEP_ORDER: Array<"import" | "review_remark" | "update_list"> = [
  "import",
  "review_remark",
  "update_list",
]

export default function Layout() {
  const workflowStep = useStore((s) => s.workflowStep)
  const resetAll = useStore((s) => s.resetAll)

  return (
    <div className="flex h-screen bg-frost-50">
      <aside className="flex w-16 flex-col items-center bg-frost-800 py-4">
        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-frost-500">
          <span className="text-sm font-bold text-white">雪</span>
        </div>

        <nav className="flex flex-1 flex-col items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `group relative flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? "text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-frost-500" />
                  )}
                  <item.icon size={20} />
                  <span className="pointer-events-none absolute left-14 whitespace-nowrap rounded bg-frost-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={resetAll}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-frost-700 hover:text-white"
        >
          <RotateCcw size={16} />
        </button>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h1 className="font-display text-lg font-semibold text-frost-800">
            滑雪场雪道坡度分级管理系统
          </h1>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">三步审核:</span>
            {STEP_ORDER.map((step, idx) => (
              <span key={step} className="flex items-center gap-2">
                {idx > 0 && <span className="text-slate-300">→</span>}
                <span
                  className={
                    workflowStep === step
                      ? "font-semibold text-frost-500"
                      : STEP_ORDER.indexOf(workflowStep) > idx
                      ? "text-emerald-500"
                      : "text-slate-300"
                  }
                >
                  {STEP_LABELS[step]}
                </span>
              </span>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

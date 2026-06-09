import { ONBOARDING_STEPS } from "@/config/onboarding";
import { Link, useLocation } from "react-router-dom";

export default function OnboardingSidebar() {
  const loc = useLocation();
  return (
    <aside className="card p-5 space-y-4">
      <div>
        <div className="text-sm font-serif font-semibold text-warm-800">
          接班人操作顺序
        </div>
        <div className="text-[11px] text-warm-500 mt-0.5">
          按 1 → {ONBOARDING_STEPS.length} 的顺序走完，就能上手整套对账
        </div>
      </div>
      <ol className="space-y-3">
        {ONBOARDING_STEPS.map((s) => {
          const active =
            s.to === loc.pathname || (s.to === "/" && loc.pathname === "/");
          return (
            <li key={s.id} className="flex gap-3">
              <div
                className={`step-num ${
                  active ? "bg-warm-800 text-brand-300" : ""
                }`}
              >
                {s.order}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  to={s.to}
                  className={`block ${
                    active ? "text-brand-700" : "text-warm-800 hover:text-brand-700"
                  } font-medium text-sm`}
                >
                  {s.title}
                </Link>
                <p className="text-[11px] text-warm-500 mt-0.5 leading-relaxed">
                  {s.description}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Link
                    to={s.to}
                    className="text-[11px] text-brand-700 hover:text-brand-800 font-medium"
                  >
                    {s.actionLabel} →
                  </Link>
                  <span className="text-[10px] text-warm-400">💡 {s.tip}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

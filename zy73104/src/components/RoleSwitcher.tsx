import { useState, useRef, useEffect } from "react";
import { PenTool, ClipboardList, ChevronDown } from "lucide-react";
import type { Role } from "shared/types";
import { ROLE_LABEL } from "shared/types";
import { useChecklistStore } from "@/store/useChecklistStore";
import { cn } from "@/lib/utils";

const roleIcons: Record<Role, typeof PenTool> = {
  architect: PenTool,
  operations: ClipboardList,
};

export default function RoleSwitcher() {
  const { currentRole, setRole } = useChecklistStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const CurrentIcon = roleIcons[currentRole];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5",
          "bg-white/10 hover:bg-white/20 text-white",
          "border border-white/20 rounded-sm2 text-sm",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
        )}
      >
        <CurrentIcon className="w-4 h-4" />
        <span>{ROLE_LABEL[currentRole]}</span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white border border-ink-200 rounded-sm2 shadow-card z-50">
          {(Object.keys(roleIcons) as Role[]).map((role) => {
            const Icon = roleIcons[role];
            const active = role === currentRole;
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setRole(role);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                  "hover:bg-ink-50 transition-colors",
                  active ? "text-brand-600 bg-brand-50/60" : "text-ink-700"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{ROLE_LABEL[role]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

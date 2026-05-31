import { useState } from "react"
import { useGradingStore } from "@/store/gradingStore"
import type { UserRole } from "@/types"
import { ROLE_LABELS } from "@/types"
import { User, ChevronDown } from "lucide-react"

const USERS: { name: string; role: UserRole }[] = [
  { name: "王老师", role: "teacher" },
  { name: "李助教", role: "assistant" },
  { name: "赵组长", role: "lead" },
]

export function UserSelector() {
  const currentUser = useGradingStore((s) => s.currentUser)
  const setCurrentUser = useGradingStore((s) => s.setCurrentUser)
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-300"
      >
        <User size={14} className="text-navy-500" />
        <span>{currentUser.name}</span>
        <span className="text-xs text-slate-400">
          {ROLE_LABELS[currentUser.role]}
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {USERS.map((u) => (
              <button
                key={u.name}
                onClick={() => {
                  setCurrentUser(u)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${
                  currentUser.name === u.name
                    ? "text-amber-600 font-medium"
                    : "text-slate-700"
                }`}
              >
                <span>{u.name}</span>
                <span className="text-xs text-slate-400">
                  {ROLE_LABELS[u.role]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

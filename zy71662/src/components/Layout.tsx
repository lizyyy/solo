import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, GitCompare, FileText, Plus } from 'lucide-react'
import { useStore } from '@/store/useStore'

const navItems = [
  { to: '/', label: '工作台', icon: LayoutDashboard },
  { to: '/compare', label: '方案对比', icon: GitCompare },
  { to: '/history', label: '报告与历史', icon: FileText },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const schemes = useStore((s) => s.schemes)
  const currentSchemeId = useStore((s) => s.currentSchemeId)
  const fetchSchemes = useStore((s) => s.fetchSchemes)
  const selectScheme = useStore((s) => s.selectScheme)
  const createScheme = useStore((s) => s.createScheme)

  useEffect(() => {
    fetchSchemes()
  }, [fetchSchemes])

  const handleNewScheme = () => {
    createScheme({
      name: `方案 ${schemes.length + 1}`,
      description: '',
      safetyFactor: 2.0,
    })
  }

  return (
    <div className="flex h-screen bg-brand-dark text-zinc-100">
      <aside className="w-64 bg-brand-mid flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-white/10">
          <h1 className="text-lg font-bold tracking-wide">
            <span className="text-brand-accent">舞台</span>吊点载荷预估
          </h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'text-brand-accent bg-white/5'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 space-y-3">
          <select
            value={currentSchemeId ?? ''}
            onChange={(e) => {
              if (e.target.value) selectScheme(e.target.value)
            }}
            className="w-full bg-brand-dark border border-white/10 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-brand-accent"
          >
            <option value="" disabled>
              选择方案
            </option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleNewScheme}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-brand-accent text-brand-dark hover:bg-brand-accent/90 transition-colors"
          >
            <Plus size={16} />
            新建方案
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}

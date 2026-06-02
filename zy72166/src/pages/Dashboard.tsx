import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Upload, GitMerge, ClipboardCheck, FileOutput, AlertTriangle } from 'lucide-react'
import { useProjectStore } from '@/store'
import { fetchProjects, fetchProject, fetchPrecheck, createProject, seedData } from '@/api'

const quickEntries = [
  { to: '/import', label: '数据导入', icon: Upload, color: 'bg-teal-700' },
  { to: '/merge', label: '归并去重', icon: GitMerge, color: 'bg-teal-600' },
  { to: '/review', label: '人工复核', icon: ClipboardCheck, color: 'bg-amber-600' },
  { to: '/export', label: '公示清单', icon: FileOutput, color: 'bg-emerald-600' },
]

export default function Dashboard() {
  const { currentProjectId, setCurrentProjectId } = useProjectStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<any>(null)
  const [warnings, setWarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [noProject, setNoProject] = useState(false)

  useEffect(() => {
    loadProject()
  }, [])

  async function loadProject() {
    try {
      const projects = await fetchProjects()
      if (!projects || projects.length === 0) {
        setNoProject(true)
        setLoading(false)
        return
      }
      setCurrentProjectId(projects[0].id)
      await loadStats(projects[0].id)
    } catch {
      setNoProject(true)
      setLoading(false)
    }
  }

  async function loadStats(pid: string) {
    try {
      const project = await fetchProject(pid)
      setStats(project.stats)
      const w = await fetchPrecheck(pid)
      setWarnings(w.slice(0, 5))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateDemo() {
    try {
      const project = await createProject('口袋公园日照复核示范项目')
      setCurrentProjectId(project.id)
      await seedData(project.id)
      await loadStats(project.id)
      setNoProject(false)
    } catch {
      // ignore
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">加载中...</div>
  }

  if (noProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-slate-500">暂无项目</p>
        <button
          onClick={handleCreateDemo}
          className="px-6 py-2.5 bg-teal-700 text-white rounded-lg font-medium hover:bg-teal-800 transition-colors"
        >
          创建示范项目
        </button>
      </div>
    )
  }

  const reviewStats = stats?.reviewStats || {}
  const pending = reviewStats.pending || 0
  const conflict = reviewStats.conflict || 0
  const passed = reviewStats.passed || 0
  const needsVisit = reviewStats.needs_field_visit || 0

  return (
    <div className="p-8 max-w-5xl">
      <h2
        className="text-2xl font-bold text-slate-800 mb-6"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        工作台
      </h2>

      <div className="grid grid-cols-3 gap-5 mb-8">
        <StatCard label="待处理" value={pending + conflict} color="amber" />
        <StatCard label="已处理" value={passed} color="emerald" />
        <StatCard label="需复看" value={needsVisit} color="rose" />
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-slate-500 mb-3">快捷入口</h3>
        <div className="grid grid-cols-4 gap-4">
          {quickEntries.map((entry) => (
            <button
              key={entry.to}
              onClick={() => navigate(entry.to)}
              className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-shadow"
            >
              <div className={`w-9 h-9 ${entry.color} rounded-lg flex items-center justify-center`}>
                <entry.icon className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-sm font-medium text-slate-700">{entry.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-500 mb-3">近期预警</h3>
        {warnings.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-slate-400">
            暂无预警信息
          </div>
        ) : (
          <div className="space-y-2">
            {warnings.map((w) => (
              <div
                key={w.id}
                className="flex items-start gap-3 bg-white rounded-lg border border-slate-200 p-4"
              >
                <AlertTriangle
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    w.severity === 'error'
                      ? 'text-rose-500'
                      : w.severity === 'warning'
                        ? 'text-amber-500'
                        : 'text-blue-500'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{w.description}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    w.severity === 'error'
                      ? 'bg-rose-100 text-rose-600'
                      : w.severity === 'warning'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {w.severity === 'error' ? '严重' : w.severity === 'warning' ? '警告' : '信息'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    amber: 'text-amber-600 bg-amber-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    rose: 'text-rose-600 bg-rose-50',
  }
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold ${colorMap[color]?.split(' ')[0] || ''}`}>
          {value}
        </span>
        <span className="text-xs text-slate-400 mb-1">条</span>
      </div>
    </div>
  )
}

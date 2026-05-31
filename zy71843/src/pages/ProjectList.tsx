import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  FileWarning,
  Clock,
  Plus,
  CheckCircle2,
  Inbox,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { Project } from '@/types'

function formatTime(iso: string) {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

function barColor(project: Project) {
  if (project.anomalyCount > 0) return 'bg-accent-red'
  if (project.pendingCount > 0) return 'bg-accent-amber'
  return 'bg-accent-green'
}

export default function ProjectList() {
  const navigate = useNavigate()
  const projects = useStore((s) => s.projects)
  const positions = useStore((s) => s.positions)
  const anomalyNotes = useStore((s) => s.anomalyNotes)
  const addProject = useStore((s) => s.addProject)
  const [newName, setNewName] = useState('')
  const [showInput, setShowInput] = useState(false)

  const globalStats = useMemo(() => {
    const unresolvedAnomalies = anomalyNotes.filter((n) => !n.resolved).length
    const pendingCount = positions.filter(
      (p) => p.status === 'pending_material',
    ).length
    const today = new Date().toISOString().slice(0, 10)
    const todayChanges = positions.filter(
      (p) => p.lastModified.slice(0, 10) === today,
    ).length
    return { unresolvedAnomalies, pendingCount, todayChanges }
  }, [anomalyNotes, positions])

  const handleCreate = () => {
    if (newName.trim()) {
      addProject(newName.trim())
      setNewName('')
      setShowInput(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 font-sans text-gray-200">
      <div className="sticky top-0 z-10 border-b border-gray-700/50 bg-surface-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <div className="flex items-center gap-2 rounded-md bg-accent-red/15 px-3 py-1.5 text-sm">
            <AlertTriangle size={16} className="text-accent-red" />
            <span className="font-mono text-accent-red">
              {globalStats.unresolvedAnomalies}
            </span>
            <span className="text-gray-400">待处理异常</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-accent-amber/15 px-3 py-1.5 text-sm">
            <FileWarning size={16} className="text-accent-amber" />
            <span className="font-mono text-accent-amber">
              {globalStats.pendingCount}
            </span>
            <span className="text-gray-400">未补材料</span>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-surface-600/60 px-3 py-1.5 text-sm">
            <Clock size={16} className="text-gray-400" />
            <span className="font-mono text-gray-300">
              {globalStats.todayChanges}
            </span>
            <span className="text-gray-400">今日改动</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">灯位校准</h1>
            <p className="mt-1 text-sm text-gray-500">展厅项目管理</p>
          </div>
          <div className="flex items-center gap-2">
            {showInput && (
              <>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="项目名称"
                  autoFocus
                  className="rounded border border-gray-600 bg-surface-700 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-accent-amber"
                />
                <button
                  onClick={handleCreate}
                  className="rounded bg-accent-amber px-3 py-1.5 text-sm font-medium text-surface-900 hover:bg-accent-amber/80"
                >
                  确定
                </button>
                <button
                  onClick={() => {
                    setShowInput(false)
                    setNewName('')
                  }}
                  className="rounded bg-surface-600 px-3 py-1.5 text-sm text-gray-400 hover:bg-surface-700"
                >
                  取消
                </button>
              </>
            )}
            {!showInput && (
              <button
                onClick={() => setShowInput(true)}
                className="flex items-center gap-1.5 rounded bg-accent-amber px-4 py-2 text-sm font-medium text-surface-900 hover:bg-accent-amber/80"
              >
                <Plus size={16} />
                新建项目
              </button>
            )}
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <Inbox size={48} strokeWidth={1} />
            <p className="mt-4 text-sm">暂无项目，点击上方按钮新建</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative flex overflow-hidden rounded-lg bg-surface-800 transition-colors hover:bg-surface-700"
              >
                <div className={`w-1 shrink-0 ${barColor(project)}`} />
                <div className="flex flex-1 flex-col p-4">
                  <button
                    onClick={() => navigate(`/project/${project.id}`)}
                    className="mb-3 text-left font-medium text-gray-100 transition-colors hover:text-accent-amber"
                  >
                    {project.name}
                  </button>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-accent-green" />
                      <span className="font-mono text-accent-green">
                        {project.calibratedCount}
                      </span>
                      <span className="text-gray-500">已校准</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <FileWarning size={13} className="text-accent-amber" />
                      <span className="font-mono text-accent-amber">
                        {project.pendingCount}
                      </span>
                      <span className="text-gray-500">待补</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle size={13} className="text-accent-red" />
                      <span className="font-mono text-accent-red">
                        {project.anomalyCount}
                      </span>
                      <span className="text-gray-500">异常</span>
                    </span>
                  </div>
                  <span className="mt-3 font-mono text-xs text-gray-600">
                    {formatTime(project.lastModified)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

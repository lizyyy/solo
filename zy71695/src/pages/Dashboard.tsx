import { useEffect, useState } from 'react'
import { useAppStore } from '@/hooks/useAppStore'
import { api } from '@/utils/api'
import { Sun, AlertTriangle, Clock, FolderOpen, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Project { id: string; name: string; description: string }
interface Estimation { id: string; status: string; warnings: any[]; estimated_time_s: number; created_at: string }

export default function Dashboard() {
  const { currentProjectId, setCurrentProjectId, showToast } = useAppStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [estimations, setEstimations] = useState<Estimation[]>([])
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (currentProjectId) loadEstimations()
  }, [currentProjectId])

  async function loadProjects() {
    try {
      const res = await api.projects.list()
      setProjects(res.data || [])
      if (!currentProjectId && res.data?.length > 0) {
        setCurrentProjectId(res.data[0].id)
      }
    } catch { showToast('加载项目失败', 'error') }
  }

  async function loadEstimations() {
    try {
      const res = await api.estimations.list(currentProjectId!)
      setEstimations(res.data || [])
    } catch { setEstimations([]) }
  }

  async function createProject() {
    if (!newName.trim()) return
    try {
      await api.projects.create({ name: newName, description: newDesc })
      setNewName('')
      setNewDesc('')
      await loadProjects()
      showToast('项目已创建')
    } catch { showToast('创建失败', 'error') }
  }

  const pendingCount = estimations.filter(e => e.status === 'pending').length
  const allWarnings = estimations.flatMap(e => e.warnings || [])
  const currentProject = projects.find(p => p.id === currentProjectId)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
          <p className="text-sm text-slate-400 mt-1">项目概览与业务影响预警</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{projects.length}</p>
              <p className="text-xs text-slate-400">项目总数</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-slate-400">待确认估算</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Clock className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{estimations.length}</p>
              <p className="text-xs text-slate-400">估算报告</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">选择项目</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => setCurrentProjectId(p.id)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                currentProjectId === p.id
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-slate-700/50 hover:border-slate-600'
              }`}
            >
              <p className="font-medium text-sm">{p.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="新项目名称"
            className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
          />
          <input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="描述(可选)"
            className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
          />
          <button onClick={createProject} className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors">
            创建
          </button>
        </div>
      </div>

      {currentProject && allWarnings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">业务影响预警</h2>
          {allWarnings.map((w, i) => {
            const borderColor = w.type === 'light_gap' ? 'border-red-500/50' : w.type === 'power_insufficient' ? 'border-red-500/50' : w.type === 'slope_direction_reversed' ? 'border-orange-500/50' : 'border-yellow-500/50'
            const bgColor = w.type === 'light_gap' ? 'bg-red-500/10' : w.type === 'power_insufficient' ? 'bg-red-500/10' : w.type === 'slope_direction_reversed' ? 'bg-orange-500/10' : 'bg-yellow-500/10'
            return (
              <div key={i} className={`${bgColor} border-l-4 ${borderColor} rounded-r-xl p-4`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{w.message}</p>
                    <p className="text-xs text-slate-300 mt-1">💰 {w.business_impact}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {estimations.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-3">最近估算</h2>
          <div className="space-y-2">
            {estimations.slice(0, 5).map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                <div>
                  <span className="text-sm">
                    预估时间: {e.estimated_time_s === -1 ? '无法完赛' : `${e.estimated_time_s.toFixed(2)}s`}
                  </span>
                  {e.warnings?.length > 0 && (
                    <span className="ml-2 text-xs text-amber-400">{e.warnings.length}个预警</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {e.status === 'confirmed' ? '已确认' : '待确认'}
                  </span>
                  <Link to="/estimation" className="text-amber-400 hover:text-amber-300">
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

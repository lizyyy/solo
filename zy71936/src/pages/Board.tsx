import { useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import PhotoCard from "@/components/PhotoCard"
import MarkDetailDrawer from "@/components/MarkDetailDrawer"
import { useStore } from "@/store/index"
import type { MarkStatus, SourceType, AuthStatus } from "@/lib/types"
import {
  Upload,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  Search,
  Filter,
  FolderOpen,
} from "lucide-react"

const MARK_STATUS_OPTIONS: (MarkStatus | "全部")[] = [
  "全部",
  "待判断",
  "已确认",
  "待复核",
  "授权过期",
]

const SOURCE_TYPE_OPTIONS: (SourceType | "全部")[] = [
  "全部",
  "版式稿",
  "色卡",
  "其他",
]

const AUTH_STATUS_OPTIONS: (AuthStatus | "全部")[] = [
  "全部",
  "有效",
  "过期",
  "未知",
]

export default function Board() {
  const {
    currentProject,
    projects,
    photoRecords,
    selectedRecordId,
    filterStatus,
    filterSourceType,
    filterAuthStatus,
    searchQuery,
    loading,
    setCurrentProject,
    loadProjects,
    loadPhotoRecords,
    setSelectedRecordId,
    setFilterStatus,
    setFilterSourceType,
    setFilterAuthStatus,
    setSearchQuery,
  } = useStore()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    if (currentProject) {
      loadPhotoRecords(currentProject.id)
    }
  }, [currentProject, loadPhotoRecords])

  const filteredRecords = useMemo(() => {
    return photoRecords.filter((r) => {
      if (filterStatus !== "全部" && r.markStatus !== filterStatus) return false
      if (filterSourceType !== "全部" && r.sourceType !== filterSourceType)
        return false
      if (filterAuthStatus !== "全部" && r.authorizationStatus !== filterAuthStatus)
        return false
      if (
        searchQuery &&
        !r.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false
      return true
    })
  }, [photoRecords, filterStatus, filterSourceType, filterAuthStatus, searchQuery])

  const stats = useMemo(() => {
    const source = currentProject ? photoRecords : photoRecords
    return {
      total: source.length,
      confirmed: source.filter((r) => r.markStatus === "已确认").length,
      review: source.filter((r) => r.markStatus === "待复核").length,
      expired: source.filter((r) => r.markStatus === "授权过期").length,
    }
  }, [photoRecords, currentProject])

  const selectedRecord = useMemo(() => {
    if (!selectedRecordId) return null
    return photoRecords.find((r) => r.id === selectedRecordId) ?? null
  }, [selectedRecordId, photoRecords])

  const handleProjectChange = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId) ?? null
    setCurrentProject(project)
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">标记看板</h1>
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-zinc-400" />
          <select
            value={currentProject?.id ?? ""}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-[#1e1e38] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
          >
            <option value="">选择项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-[#1e1e38] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
          <Filter className="h-4 w-4" />
          <span>筛选条件</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as MarkStatus | "全部")}
            className="rounded-lg border border-zinc-700 bg-gray-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
          >
            {MARK_STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "全部" ? "标记状态: 全部" : opt}
              </option>
            ))}
          </select>

          <select
            value={filterSourceType}
            onChange={(e) => setFilterSourceType(e.target.value as SourceType | "全部")}
            className="rounded-lg border border-zinc-700 bg-gray-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
          >
            {SOURCE_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "全部" ? "来源类型: 全部" : opt}
              </option>
            ))}
          </select>

          <select
            value={filterAuthStatus}
            onChange={(e) => setFilterAuthStatus(e.target.value as AuthStatus | "全部")}
            className="rounded-lg border border-zinc-700 bg-gray-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
          >
            {AUTH_STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "全部" ? "授权状态: 全部" : opt}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="搜索文件名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-gray-900 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-[#1e1e38] p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-500/20 p-2">
              <FolderOpen className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.total}</p>
              <p className="text-xs text-zinc-500">总记录</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-[#1e1e38] p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/20 p-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.confirmed}</p>
              <p className="text-xs text-zinc-500">已确认</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-[#1e1e38] p-4 border-l-4 border-l-sky-500">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-sky-500/20 p-2">
              <AlertCircle className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.review}</p>
              <p className="text-xs text-zinc-500">待复核</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-[#1e1e38] p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/20 p-2">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.expired}</p>
              <p className="text-xs text-zinc-500">授权过期</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Upload className="mb-4 h-12 w-12 text-zinc-600" />
          <p className="mb-2 text-lg text-zinc-400">暂无选片记录，请先导入数据</p>
          <Link
            to="/import"
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            前往导入 →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredRecords.map((record) => (
            <PhotoCard
              key={record.id}
              record={record}
              onClick={() => setSelectedRecordId(record.id)}
            />
          ))}
        </div>
      )}

      <MarkDetailDrawer
        record={selectedRecord}
        open={selectedRecordId !== null}
        onClose={() => setSelectedRecordId(null)}
      />
    </div>
  )
}

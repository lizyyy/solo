import { useEffect, useState, useCallback } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { useEnsureProject } from '@/hooks/useEnsureProject'
import { fetchReviews } from '@/api'
import ReviewDetail from '@/components/ReviewDetail'

export default function ReviewPage() {
  const { currentProjectId, ready, noProject } = useEnsureProject()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReviews = useCallback(async () => {
    if (!currentProjectId) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchReviews(currentProjectId)
      setReviews(data)
    } catch (e: any) {
      setError(e?.message || '加载失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }, [currentProjectId])

  useEffect(() => {
    if (currentProjectId) loadReviews()
  }, [currentProjectId, loadReviews])

  if (!ready || loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">加载中...</div>
  }

  if (noProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <ClipboardCheck className="w-10 h-10 text-slate-300" />
        <p className="text-slate-400">暂无项目，请先到工作台创建或导入项目</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-rose-500 text-sm">{error}</p>
        <button
          onClick={loadReviews}
          className="text-sm px-4 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-900"
        >
          重新加载
        </button>
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <ClipboardCheck className="w-10 h-10 text-slate-300" />
        <p className="text-slate-400">暂无复核项目，请先导入数据</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl">
      <h2
        className="text-2xl font-bold text-slate-800 mb-6"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        人工复核
      </h2>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">点位名称</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">地址</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">日照时长</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">来源</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">时段</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">状态</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">备注</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => (
              <ReviewDetail
                key={review.id}
                review={review}
                projectId={currentProjectId!}
                onUpdate={loadReviews}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

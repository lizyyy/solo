import { useEffect, useState } from 'react'
import { dashboardApi, DashboardStats } from '../api'
import { Link } from 'react-router-dom'

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await dashboardApi.getStats()
      setStats(response.data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  if (!stats) {
    return <div className="text-center py-8">加载失败</div>
  }

  const StatCard = ({ title, value, color, link }: { title: string; value: number; color: string; link?: string }) => {
    const Card = ({ children }: { children: React.ReactNode }) =>
      link ? <Link to={link} className="block">{children}</Link> : <>{children}</>

    return (
      <Card>
        <div className={`card border-l-4 ${color} hover:shadow-lg transition-shadow cursor-pointer`}>
          <div className="text-lg font-medium text-gray-600">{title}</div>
          <div className="text-3xl font-bold mt-2">{value}</div>
        </div>
      </Card>
    )
  }

  const getStatusClass = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
      blocked: 'status-blocked',
      open: 'status-open',
      resolved: 'status-resolved',
    }
    return statusMap[status] || 'status-pending'
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">仪表盘</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard title="Schema 总数" value={stats.total_schemas} color="border-blue-500" link="/schemas" />
        <StatCard title="消费者总数" value={stats.total_consumers} color="border-green-500" link="/consumers" />
        <StatCard title="变更申请总数" value={stats.total_change_requests} color="border-purple-500" link="/change-requests" />
        <StatCard title="待处理申请" value={stats.pending_requests} color="border-yellow-500" link="/change-requests?status=pending" />
        <StatCard title="待解决异常" value={stats.open_intercepts} color="border-red-500" link="/intercept-records?status=open" />
        <StatCard title="已解决异常" value={stats.resolved_intercepts} color="border-teal-500" />
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">最近变更</h2>
        {stats.recent_changes.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>申请ID</th>
                  <th>标题</th>
                  <th>状态</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_changes.map((change) => (
                  <tr key={change.id}>
                    <td className="font-mono text-blue-600">{change.request_id}</td>
                    <td>{change.title}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(change.status)}`}>
                        {change.status}
                      </span>
                    </td>
                    <td>{new Date(change.created_at).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">暂无变更记录</p>
        )}
      </div>
    </div>
  )
}

export default Dashboard

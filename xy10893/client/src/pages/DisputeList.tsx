import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dispute } from '../types'

const statusMap: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  ready: '已就绪',
  expired: '已过期',
  completed: '已完成'
}

const statusBadgeClass: Record<string, string> = {
  pending: 'badge-pending',
  processing: 'badge-processing',
  ready: 'badge-ready',
  expired: 'badge-expired',
  completed: 'badge-ready'
}

export default function DisputeList() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/disputes')
      .then(res => res.json())
      .then(data => {
        setDisputes(data)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div className="card">
      <h2 className="card-title">争议单列表</h2>
      <table className="table">
        <thead>
          <tr>
            <th>订单编号</th>
            <th>客户名称</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {disputes.map(dispute => (
            <tr key={dispute.id}>
              <td><strong>{dispute.orderId}</strong></td>
              <td>{dispute.customerName}</td>
              <td>
                <span className={`badge ${statusBadgeClass[dispute.status]}`}>
                  {statusMap[dispute.status]}
                </span>
              </td>
              <td>{new Date(dispute.createdAt).toLocaleString('zh-CN')}</td>
              <td>
                <Link to={`/disputes/${dispute.id}`} className="link">
                  查看详情
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

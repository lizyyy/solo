import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ticketApi, technicianApi } from '../lib/api'
import type { Ticket, Technician, TicketStatus } from '../types'
import { statusLabelMap, statusColorMap, TicketStatus as TS } from '../types'

export default function TicketList() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [filters, setFilters] = useState({
    status: '' as TicketStatus | '',
    assignedToId: '',
    startDate: '',
    endDate: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ticketsData, techsData] = await Promise.all([
        ticketApi.list({
          status: filters.status || undefined,
          assignedToId: filters.assignedToId || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        }),
        technicianApi.list(),
      ])
      setTickets(ticketsData)
      setTechnicians(techsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getTechName = (id: string | null) => {
    if (!id) return '-'
    const tech = technicians.find(t => t.id === id)
    return tech?.name || '-'
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个工单吗？')) return
    try {
      await ticketApi.delete(id)
      setTickets(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    }
  }

  const handleTransition = async (ticketId: string, currentStatus: TicketStatus) => {
    const availableTransitions: Record<TicketStatus, { status: TicketStatus; label: string }[]> = {
      [TS.PENDING_ASSIGNMENT]: [
        { status: TS.IN_PROGRESS, label: '派单处理' },
      ],
      [TS.IN_PROGRESS]: [
        { status: TS.PENDING_INSPECTION, label: '申请验收' },
        { status: TS.OVERDUE, label: '标记逾期' },
      ],
      [TS.PENDING_INSPECTION]: [
        { status: TS.COMPLETED, label: '验收完成' },
        { status: TS.IN_PROGRESS, label: '返工处理' },
      ],
      [TS.COMPLETED]: [],
      [TS.OVERDUE]: [
        { status: TS.IN_PROGRESS, label: '重新处理' },
        { status: TS.COMPLETED, label: '完成验收' },
      ],
    }

    const options = availableTransitions[currentStatus]
    if (options.length === 0) {
      alert('当前状态没有可流转的操作')
      return
    }

    const optionMap = new Map(options.map((o, i) => [String(i + 1), o]))
    const promptText = options.map((o, i) => `${i + 1}. ${o.label}`).join('\n')
    const choice = prompt(`选择操作：\n${promptText}`)
    
    if (!choice) return
    
    const selected = optionMap.get(choice)
    if (!selected) {
      alert('无效的选择')
      return
    }

    try {
      const updated = await ticketApi.transition(ticketId, selected.status)
      setTickets(prev => prev.map(t => t.id === ticketId ? updated : t))
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  const clearFilters = () => {
    setFilters({ status: '', assignedToId: '', startDate: '', endDate: '' })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">工单列表</h1>
        <div className="text-sm text-gray-500">
          共 {tickets.length} 条记录
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col min-w-32">
            <label className="text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={filters.status}
              onChange={e => setFilters(prev => ({ ...prev, status: e.target.value as TicketStatus | '' }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部状态</option>
              {Object.entries(statusLabelMap).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col min-w-40">
            <label className="text-sm font-medium text-gray-700 mb-1">维修师傅</label>
            <select
              value={filters.assignedToId}
              onChange={e => setFilters(prev => ({ ...prev, assignedToId: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部师傅</option>
              {technicians.map(tech => (
                <option key={tech.id} value={tech.id}>{tech.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col min-w-36">
            <label className="text-sm font-medium text-gray-700 mb-1">开始日期</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col min-w-36">
            <label className="text-sm font-medium text-gray-700 mb-1">结束日期</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            清除筛选
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
          <button onClick={fetchData} className="ml-4 underline">重试</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">
          加载中...
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <p className="text-gray-500 mb-4">暂无工单</p>
          <Link
            to="/tickets/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            创建第一个工单
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    工单编号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    报修人
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    地点
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    师傅
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    创建时间
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickets.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        to={`/tickets/${ticket.id}/edit`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        {ticket.ticketNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {ticket.callerName}
                      <span className="text-gray-400 ml-2">{ticket.callerPhone}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-32 truncate" title={ticket.location}>
                      {ticket.location}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {getTechName(ticket.assignedToId)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColorMap[ticket.status]}`}>
                        {statusLabelMap[ticket.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ticket.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleTransition(ticket.id, ticket.status)}
                          className="text-green-600 hover:text-green-900"
                        >
                          流转
                        </button>
                        <Link
                          to={`/tickets/${ticket.id}/edit`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          编辑
                        </Link>
                        <button
                          onClick={() => handleDelete(ticket.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

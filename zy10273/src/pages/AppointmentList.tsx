import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Eye } from 'lucide-react'
import { useAppStore } from '../store'
import { AppointmentStatus, ApplianceType } from '../types'
import { formatDate, getStatusBadgeClass, getStatusText, getApplianceTypeText } from '../utils'
import CreateAppointmentModal from '../components/CreateAppointmentModal'

export default function AppointmentList() {
  const { appointments } = useAppStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const filteredAppointments = appointments.filter(a => {
    const matchesSearch = a.customerName.includes(searchTerm) ||
      a.customerPhone.includes(searchTerm) ||
      a.appointmentNo.includes(searchTerm)
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">预约管理</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          新建预约
        </button>
      </div>

      <div className="card p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="搜索预约单号、客户姓名、电话..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input w-40"
          >
            <option value="all">全部状态</option>
            <option value={AppointmentStatus.PENDING}>待上门</option>
            <option value={AppointmentStatus.IN_PROGRESS}>检测中</option>
            <option value={AppointmentStatus.INSPECTED}>已检测</option>
            <option value={AppointmentStatus.REJECTED}>已拒收</option>
            <option value={AppointmentStatus.SETTLED}>已结算</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">预约单号</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户信息</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">家电信息</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">预约时间</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">预估价格</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredAppointments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  暂无预约数据
                </td>
              </tr>
            ) : (
              filteredAppointments.map(appointment => (
                <tr key={appointment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-medium text-blue-600">{appointment.appointmentNo}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{appointment.customerName}</div>
                      <div className="text-sm text-gray-500">{appointment.customerPhone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-gray-900">{getApplianceTypeText(applianceType)}</div>
                      <div className="text-sm text-gray-500">{appointment.applianceBrand} {appointment.applianceModel}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {formatDate(appointment.scheduledDate)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">¥{appointment.estimatedPrice}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${getStatusBadgeClass(appointment.status)}`}>
                      {getStatusText(appointment.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/appointments/${appointment.id}`}
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Eye size={16} />
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateAppointmentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  )
}

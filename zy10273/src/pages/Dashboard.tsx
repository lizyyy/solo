import { Link } from 'react-router-dom'
import { 
  ClipboardList, Clock, CheckCircle, DollarSign, 
  AlertTriangle, TrendingUp
} from 'lucide-react'
import { useAppStore } from '../store'
import { formatDate } from '../utils'

export default function Dashboard() {
  const stats = useAppStore(state => state.getStatistics())
  const abnormalRecords = useAppStore(state => state.abnormalRecords)
  const appointments = useAppStore(state => state.appointments)
  const resolveAbnormality = useAppStore(state => state.resolveAbnormality)

  const recentAppointments = appointments
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const pendingApprovals = appointments.filter(
    a => a.priceChanges.some(pc => pc.status === 'pending')
  ).length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">工作台</h1>

      <div className="grid grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">总预约</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalAppointments}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <ClipboardList size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">待审批</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{pendingApprovals}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock size={24} className="text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">已结算</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.settledAppointments}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">总收入</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">¥{stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <DollarSign size={24} className="text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {abnormalRecords.filter(r => !r.resolved).length > 0 && (
            <div className="card p-6 border-l-4 border-l-red-500">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={20} className="text-red-600" />
                <h3 className="font-semibold text-gray-900">异常提醒</h3>
              </div>
              <div className="space-y-3">
                {abnormalRecords.filter(r => !r.resolved).map(record => (
                  <div key={record.id} className="flex items-start justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{record.appointmentNo}</div>
                      <div className="text-sm text-gray-600">{record.description}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatDate(record.detectedAt)}
                      </div>
                    </div>
                    <button
                      onClick={() => resolveAbnormality(record.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      已处理
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">最近预约</h3>
              <Link to="/appointments" className="text-sm text-blue-600 hover:text-blue-800">
                查看全部
              </Link>
            </div>
            <div className="space-y-3">
              {recentAppointments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无预约</p>
              ) : (
                recentAppointments.map(appointment => (
                  <Link
                    key={appointment.id}
                    to={`/appointments/${appointment.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{appointment.appointmentNo}</div>
                      <div className="text-sm text-gray-600">
                        {appointment.customerName} - {appointment.applianceBrand} {appointment.applianceModel}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`badge ${
                        appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        appointment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        appointment.status === 'inspected' ? 'bg-green-100 text-green-800' :
                        appointment.status === 'settled' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {appointment.status === 'pending' ? '待上门' :
                         appointment.status === 'in_progress' ? '检测中' :
                         appointment.status === 'inspected' ? '已检测' :
                         appointment.status === 'settled' ? '已结算' : '已拒收'}
                      </span>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatDate(appointment.scheduledDate)}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">状态分布</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <span className="text-gray-600">待上门</span>
                </div>
                <span className="font-medium">{stats.pendingAppointments}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span className="text-gray-600">检测中</span>
                </div>
                <span className="font-medium">{stats.inProgressAppointments}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-gray-600">已检测</span>
                </div>
                <span className="font-medium">{stats.inspectedAppointments}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="text-gray-600">已拒收</span>
                </div>
                <span className="font-medium">{stats.rejectedAppointments}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-500 rounded-full" />
                  <span className="text-gray-600">已结算</span>
                </div>
                <span className="font-medium">{stats.settledAppointments}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">快捷操作</h3>
            <div className="space-y-2">
              <Link to="/appointments" className="btn btn-secondary w-full text-center flex items-center justify-center gap-2">
                <ClipboardList size={18} />
                预约管理
              </Link>
              <Link to="/approvals" className="btn btn-secondary w-full text-center flex items-center justify-center gap-2">
                <TrendingUp size={18} />
                改价审批
              </Link>
              <Link to="/settlement" className="btn btn-secondary w-full text-center flex items-center justify-center gap-2">
                <DollarSign size={18} />
                结算管理
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

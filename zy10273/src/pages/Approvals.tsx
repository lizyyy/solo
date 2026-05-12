import { useState } from 'react'
import { Check, X, Clock } from 'lucide-react'
import { useAppStore } from '../store'
import { formatDate } from '../utils'

interface PriceChangeWithAppointment {
  change: any
  appointment: any
}

export default function Approvals() {
  const { appointments, approvePriceChange } = useAppStore()
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({})

  const pendingPriceChanges: PriceChangeWithAppointment[] = []
  appointments.forEach(appointment => {
    appointment.priceChanges.forEach(change => {
      if (change.status === 'pending') {
        pendingPriceChanges.push({ change, appointment })
      }
    })
  })

  const handledPriceChanges: PriceChangeWithAppointment[] = []
  appointments.forEach(appointment => {
    appointment.priceChanges.forEach(change => {
      if (change.status !== 'pending') {
        handledPriceChanges.push({ change, appointment })
      }
    })
  })

  const handleApprove = (changeId: string) => {
    approvePriceChange(changeId, true, approvalNotes[changeId] || '')
    setApprovalNotes(prev => ({ ...prev, [changeId]: '' }))
  }

  const handleReject = (changeId: string) => {
    approvePriceChange(changeId, false, approvalNotes[changeId] || '')
    setApprovalNotes(prev => ({ ...prev, [changeId]: '' }))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">改价审批</h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">待审批</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingPriceChanges.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Check size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">已通过</p>
              <p className="text-2xl font-bold text-green-600">
                {handledPriceChanges.filter(pc => pc.change.status === 'approved').length}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <X size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">已驳回</p>
              <p className="text-2xl font-bold text-red-600">
                {handledPriceChanges.filter(pc => pc.change.status === 'rejected').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">待审批改价申请</h2>
        {pendingPriceChanges.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无待审批的改价申请</p>
        ) : (
          <div className="space-y-4">
            {pendingPriceChanges.map(({ change, appointment }) => (
              <div key={change.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-900">{appointment.appointmentNo}</span>
                      <span className="text-gray-600">{appointment.customerName}</span>
                      <span className="text-gray-500">{appointment.applianceBrand} {appointment.applianceModel}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-gray-600 line-through">¥{change.originalPrice}</span>
                      <span className="text-xl font-bold text-blue-600">→ ¥{change.newPrice}</span>
                      <span className="text-sm text-gray-500">
                        差价: ¥{change.newPrice - change.originalPrice}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      <span className="font-medium">改价原因:</span> {change.reason}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      申请人: {change.requestedBy} | 申请时间: {formatDate(change.requestedAt)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-4">
                  <input
                    type="text"
                    placeholder="审批意见（可选）"
                    value={approvalNotes[change.id] || ''}
                    onChange={e => setApprovalNotes(prev => ({ ...prev, [change.id]: e.target.value }))}
                    className="input flex-1"
                  />
                  <button
                    onClick={() => handleReject(change.id)}
                    className="btn btn-danger flex items-center gap-2"
                  >
                    <X size={18} />
                    驳回
                  </button>
                  <button
                    onClick={() => handleApprove(change.id)}
                    className="btn btn-success flex items-center gap-2"
                  >
                    <Check size={18} />
                    通过
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {handledPriceChanges.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">已处理改价申请</h2>
          <div className="space-y-3">
            {handledPriceChanges.map(({ change, appointment }) => (
              <div key={change.id} className="p-4 bg-gray-50 rounded-lg flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-gray-900">{appointment.appointmentNo}</span>
                    <span className={`badge ${
                      change.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {change.status === 'approved' ? '已通过' : '已驳回'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-gray-600 line-through">¥{change.originalPrice}</span>
                    <span className="text-lg font-bold text-blue-600">→ ¥{change.newPrice}</span>
                  </div>
                  {change.approvalNotes && (
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">审批意见:</span> {change.approvalNotes}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    审批人: {change.approvedBy} | 审批时间: {formatDate(change.approvedAt || '')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

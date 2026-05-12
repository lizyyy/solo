import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useAppStore } from '../store'
import { AppointmentStatus, InspectionItem } from '../types'
import { formatDate, getStatusBadgeClass, getStatusText, getApplianceTypeText } from '../utils'

export default function AppointmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const appointment = useAppStore(state => state.getAppointmentById(id || ''))
  const { startInspection, completeInspection, requestPriceChange, rejectAppointment, settleAppointment } = useAppStore()
  
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>(
    appointment?.inspectionItems || []
  )
  const [actualPrice, setActualPrice] = useState(appointment?.actualPrice || 0)
  const [priceChangeReason, setPriceChangeReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [settlementNotes, setSettlementNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'inspection' | 'history'>('info')

  if (!appointment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">预约不存在</p>
        <button onClick={() => navigate('/appointments')} className="btn btn-primary mt-4">
          返回列表
        </button>
      </div>
    )
  }

  const handleStartInspection = () => {
    startInspection(appointment.id)
    setInspectionItems(appointment.inspectionItems)
  }

  const handleUpdateInspectionItem = (itemId: string, updates: Partial<InspectionItem>) => {
    setInspectionItems(items =>
      items.map(item => (item.id === itemId ? { ...item, ...updates } : item))
    )
  }

  const handleCompleteInspection = () => {
    try {
      completeInspection(appointment.id, inspectionItems, actualPrice)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleRequestPriceChange = () => {
    if (!priceChangeReason.trim()) {
      setError('请填写改价原因')
      return
    }
    requestPriceChange(appointment.id, actualPrice, priceChangeReason)
    setPriceChangeReason('')
  }

  const handleReject = () => {
    if (!rejectReason.trim()) {
      setError('请填写拒收原因')
      return
    }
    rejectAppointment(appointment.id, rejectReason)
    setRejectReason('')
  }

  const handleSettle = () => {
    const result = settleAppointment(appointment.id, paymentMethod, settlementNotes)
    if (!result.success) {
      setError(result.error || '')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/appointments')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">预约详情</h1>
          <p className="text-gray-500">{appointment.appointmentNo}</p>
        </div>
        <span className={`badge ${getStatusBadgeClass(appointment.status)} ml-auto`}>
          {getStatusText(appointment.status)}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'info' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          基本信息
        </button>
        <button
          onClick={() => setActiveTab('inspection')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'inspection' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          检测记录
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'
          }`}
        >
          操作日志
        </button>
      </div>

      {activeTab === 'info' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">客户信息</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">姓名</span>
                <span className="font-medium">{appointment.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">电话</span>
                <span className="font-medium">{appointment.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">地址</span>
                <span className="font-medium">{appointment.customerAddress}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">家电信息</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">类型</span>
                <span className="font-medium">{getApplianceTypeText(appointment.applianceType)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">品牌</span>
                <span className="font-medium">{appointment.applianceBrand}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">型号</span>
                <span className="font-medium">{appointment.applianceModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">使用年限</span>
                <span className="font-medium">{appointment.applianceAge} 年</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">预约信息</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">上门师傅</span>
                <span className="font-medium">{appointment.technician}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">预约时间</span>
                <span className="font-medium">{formatDate(appointment.scheduledDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">预估价格</span>
                <span className="font-medium text-blue-600">¥{appointment.estimatedPrice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">实际价格</span>
                <span className="font-medium text-green-600">¥{appointment.actualPrice || '-'}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">操作</h3>
            <div className="space-y-4">
              {appointment.status === AppointmentStatus.PENDING && (
                <button onClick={handleStartInspection} className="btn btn-primary w-full">
                  <CheckCircle size={18} className="mr-2" />
                  开始检测
                </button>
              )}

              {appointment.status === AppointmentStatus.IN_PROGRESS && (
                <button onClick={handleCompleteInspection} className="btn btn-success w-full">
                  <CheckCircle size={18} className="mr-2" />
                  完成检测
                </button>
              )}

              {appointment.status === AppointmentStatus.INSPECTED && (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">申请改价</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={actualPrice}
                        onChange={e => setActualPrice(parseInt(e.target.value) || 0)}
                        className="input flex-1"
                        placeholder="新价格"
                      />
                    </div>
                    <textarea
                      value={priceChangeReason}
                      onChange={e => setPriceChangeReason(e.target.value)}
                      className="input"
                      placeholder="改价原因"
                      rows={2}
                    />
                    <button onClick={handleRequestPriceChange} className="btn btn-secondary w-full">
                      提交改价申请
                    </button>
                  </div>

                  <hr className="my-4" />

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">拒收</label>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="input"
                      placeholder="拒收原因"
                      rows={2}
                    />
                    <button onClick={handleReject} className="btn btn-danger w-full">
                      <XCircle size={18} className="mr-2" />
                      拒收家电
                    </button>
                  </div>

                  <hr className="my-4" />

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">结算</label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="input"
                    >
                      <option value="cash">现金</option>
                      <option value="wechat">微信</option>
                      <option value="alipay">支付宝</option>
                      <option value="bank">银行转账</option>
                    </select>
                    <textarea
                      value={settlementNotes}
                      onChange={e => setSettlementNotes(e.target.value)}
                      className="input"
                      placeholder="备注"
                      rows={2}
                    />
                    <button onClick={handleSettle} className="btn btn-success w-full">
                      完成结算
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inspection' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">检测项目</h3>
            <div className="space-y-4">
              {inspectionItems.map(item => (
                <div key={item.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-gray-500">{item.category}</span>
                  </div>
                  {appointment.status === AppointmentStatus.IN_PROGRESS ? (
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.result === 'pass'}
                          onChange={() => handleUpdateInspectionItem(item.id, { result: 'pass', checked: true })}
                          className="rounded"
                        />
                        <span className="text-green-600">通过</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.result === 'fail'}
                          onChange={() => handleUpdateInspectionItem(item.id, { result: 'fail', checked: true })}
                          className="rounded"
                        />
                        <span className="text-red-600">不通过</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.result === 'na'}
                          onChange={() => handleUpdateInspectionItem(item.id, { result: 'na', checked: true })}
                          className="rounded"
                        />
                        <span className="text-gray-600">不适用</span>
                      </label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={e => handleUpdateInspectionItem(item.id, { notes: e.target.value })}
                        placeholder="备注"
                        className="input flex-1"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-2">
                      {item.result === 'pass' && <span className="text-green-600">✓ 通过</span>}
                      {item.result === 'fail' && <span className="text-red-600">✗ 不通过</span>}
                      {item.result === 'na' && <span className="text-gray-600">- 不适用</span>}
                      {item.notes && <span className="text-gray-500 ml-4">备注: {item.notes}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">照片记录</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 cursor-pointer hover:border-blue-400 hover:text-blue-400">
                <Camera size={32} />
              </div>
              {appointment.photos.map(photo => (
                <div key={photo.id} className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                  <img src={photo.url} alt={photo.type} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>

          {appointment.priceChanges.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">改价记录</h3>
              <div className="space-y-4">
                {appointment.priceChanges.map(change => (
                  <div key={change.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">
                          ¥{change.originalPrice} → ¥{change.newPrice}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">原因: {change.reason}</div>
                        {change.approvalNotes && (
                          <div className="text-sm text-gray-500 mt-1">审批意见: {change.approvalNotes}</div>
                        )}
                      </div>
                      <span className={`badge ${
                        change.status === 'approved' ? 'bg-green-100 text-green-800' :
                        change.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {change.status === 'approved' ? '已通过' :
                         change.status === 'rejected' ? '已驳回' : '待审批'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      申请人: {change.requestedBy} | 申请时间: {formatDate(change.requestedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">操作日志</h3>
          <div className="space-y-4">
            {appointment.inspectionLogs.map(log => (
              <div key={log.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock size={16} className="text-blue-600" />
                  </div>
                  <div className="w-px h-full bg-gray-200 mt-2" />
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-sm text-gray-500">{log.operator}</span>
                  </div>
                  <p className="text-gray-600 mt-1">{log.description}</p>
                  <p className="text-sm text-gray-400 mt-1">{formatDate(log.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

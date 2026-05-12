import { useState } from 'react'
import { usePalletStore } from '../store'
import { CheckCircle, User, Package } from 'lucide-react'

export default function Signature() {
  const { signForDelivery, outboundRecords } = usePalletStore()
  const [selectedOutbound, setSelectedOutbound] = useState('')
  const [signatureDate, setSignatureDate] = useState(new Date().toISOString().split('T')[0])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const pendingOutbounds = outboundRecords.filter(o => o.status === 'pending_signature' || o.status === 'signed')
  const selectedOutboundData = outboundRecords.find(o => o.id === selectedOutbound)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOutbound) {
      setMessage({ type: 'error', text: '请选择出库单' })
      return
    }

    const result = signForDelivery(selectedOutbound, signatureDate)
    if (result.success) {
      setMessage({ type: 'success', text: '签收成功！托盘状态已更新为客户持有' })
      setSelectedOutbound('')
      setTimeout(() => setMessage(null), 3000)
    } else {
      setMessage({ type: 'error', text: result.message || '签收失败' })
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">客户签收</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">签收确认</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择出库单</label>
              <select
                value={selectedOutbound}
                onChange={(e) => setSelectedOutbound(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">请选择出库单</option>
                {pendingOutbounds.filter(o => o.status === 'pending_signature').map(o => (
                  <option key={o.id} value={o.id}>
                    {o.customerName} - {o.outboundDate} - {o.palletIds.length}个托盘
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">签收日期</label>
              <input
                type="date"
                value={signatureDate}
                onChange={(e) => setSignatureDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {selectedOutboundData && (
              <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">{selectedOutboundData.customerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-500" />
                  <span>{selectedOutboundData.palletIds.length}个托盘</span>
                </div>
                <p className="text-sm text-gray-600">司机: {selectedOutboundData.driverName} · {selectedOutboundData.plateNumber}</p>
                <p className="text-sm text-gray-600">出库日期: {selectedOutboundData.outboundDate}</p>
                <p className="text-sm text-gray-600">预计归还: {selectedOutboundData.expectedReturnDate}</p>
              </div>
            )}
            {message && (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : null}
                {message.text}
              </div>
            )}
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              确认签收
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">出库单列表</h2>
          <div className="space-y-3">
            {pendingOutbounds.slice(0, 10).map((outbound) => (
              <div
                key={outbound.id}
                className={`p-4 rounded-lg border ${
                  outbound.status === 'pending_signature'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">{outbound.customerName}</p>
                    <p className="text-sm text-gray-500">{outbound.palletIds.length}个托盘 · {outbound.driverName}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      出库: {outbound.outboundDate} · 预计归还: {outbound.expectedReturnDate}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    outbound.status === 'pending_signature'
                      ? 'bg-yellow-200 text-yellow-700'
                      : 'bg-green-200 text-green-700'
                  }`}>
                    {outbound.status === 'pending_signature' ? '待签收' : '已签收'}
                  </span>
                </div>
                {outbound.signedDate && (
                  <p className="text-xs text-green-600 mt-2">✓ 已签收: {outbound.signedDate}</p>
                )}
              </div>
            ))}
            {pendingOutbounds.length === 0 && (
              <p className="text-gray-400 text-center py-8">暂无出库单</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

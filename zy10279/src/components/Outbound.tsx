import { useState } from 'react'
import { usePalletStore } from '../store'
import { Truck, CheckCircle, AlertCircle } from 'lucide-react'

export default function Outbound() {
  const { addOutbound, pallets, customers, outboundRecords } = usePalletStore()
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [selectedPallets, setSelectedPallets] = useState<string[]>([])
  const [driverName, setDriverName] = useState('')
  const [plateNumber, setPlateNumber] = useState('')
  const [outboundDate, setOutboundDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)

  const inStockPallets = pallets.filter(p => p.status === 'in_stock')
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer)

  const handlePalletToggle = (palletId: string) => {
    setSelectedPallets(prev =>
      prev.includes(palletId)
        ? prev.filter(id => id !== palletId)
        : [...prev, palletId]
    )
  }

  const handleSelectAll = () => {
    if (selectedPallets.length === inStockPallets.length) {
      setSelectedPallets([])
    } else {
      setSelectedPallets(inStockPallets.map(p => p.id))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer || selectedPallets.length === 0) {
      setMessage({ type: 'error', text: '请选择客户和托盘' })
      return
    }

    const customer = customers.find(c => c.id === selectedCustomer)
    if (!customer) return

    const result = addOutbound({
      palletIds: selectedPallets,
      customerId: selectedCustomer,
      customerName: customer.name,
      driverName,
      plateNumber,
      outboundDate,
      expectedReturnDate,
    })

    if (result.success) {
      setMessage({ type: 'success', text: '出库成功！托盘已在途' })
      setSelectedPallets([])
      setDriverName('')
      setPlateNumber('')
      setExpectedReturnDate('')
      setTimeout(() => setMessage(null), 3000)
    } else if (result.blocked) {
      setMessage({ type: 'warning', text: result.message || '出库被拦截' })
    } else {
      setMessage({ type: 'error', text: result.message || '出库失败' })
    }
  }

  const recentOutbounds = outboundRecords.filter(o => o.status === 'pending_signature').slice(-5)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">装车出库</h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">出库信息</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择客户</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">请选择客户</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (可用押金: {c.totalDeposit - c.usedDeposit}元)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">司机姓名</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">车牌号</label>
              <input
                type="text"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">出库日期</label>
              <input
                type="date"
                value={outboundDate}
                onChange={(e) => setOutboundDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">预计归还日期</label>
              <input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {message && (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                message.type === 'success' ? 'bg-green-100 text-green-700' :
                message.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
                 message.type === 'warning' ? <AlertCircle className="w-4 h-4" /> : null}
                {message.text}
              </div>
            )}
            {selectedCustomerData && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <p>已选托盘: {selectedPallets.length}个</p>
                <p>所需押金: {selectedPallets.length * 50}元</p>
                <p>可用押金: {selectedCustomerData.totalDeposit - selectedCustomerData.usedDeposit}元</p>
              </div>
            )}
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Truck className="w-4 h-4" />
              确认出库
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">在库托盘 ({inStockPallets.length}个)</h2>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {selectedPallets.length === inStockPallets.length ? '取消全选' : '全选'}
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {inStockPallets.map((pallet) => (
              <div
                key={pallet.id}
                onClick={() => handlePalletToggle(pallet.id)}
                className={`p-3 rounded-lg cursor-pointer flex items-center justify-between border-2 transition-all ${
                  selectedPallets.includes(pallet.id)
                    ? 'bg-blue-50 border-blue-500'
                    : 'bg-gray-50 border-transparent hover:border-gray-200'
                }`}
              >
                <div>
                  <p className="font-medium text-gray-800">{pallet.code}</p>
                  <p className="text-sm text-gray-500">{pallet.type}</p>
                </div>
                {selectedPallets.includes(pallet.id) && (
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                )}
              </div>
            ))}
            {inStockPallets.length === 0 && (
              <p className="text-gray-400 text-center py-8">暂无在库托盘</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">待签收出库单</h2>
          <div className="space-y-3">
            {recentOutbounds.map((outbound) => (
              <div key={outbound.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-medium text-gray-800">{outbound.customerName}</p>
                <p className="text-sm text-gray-500">{outbound.palletIds.length}个托盘 · {outbound.driverName} · {outbound.plateNumber}</p>
                <p className="text-xs text-gray-400 mt-1">出库日期: {outbound.outboundDate}</p>
              </div>
            ))}
            {recentOutbounds.length === 0 && (
              <p className="text-gray-400 text-center py-8">暂无待签收出库单</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

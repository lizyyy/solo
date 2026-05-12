import { useState } from 'react'
import { usePalletStore } from '../store'
import { DollarSign, CreditCard, ArrowLeftRight, CheckCircle } from 'lucide-react'

export default function Settlement() {
  const { addSettlement, customers, settlementRecords } = usePalletStore()
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [type, setType] = useState<'deposit_payment' | 'deduction' | 'refund'>('deposit_payment')
  const [amount, setAmount] = useState(0)
  const [remark, setRemark] = useState('')
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split('T')[0])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const selectedCustomerData = customers.find(c => c.id === selectedCustomer)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer || amount <= 0) {
      setMessage({ type: 'error', text: '请选择客户并输入金额' })
      return
    }

    if (!selectedCustomerData) return

    const result = addSettlement({
      customerId: selectedCustomer,
      customerName: selectedCustomerData.name,
      type,
      amount,
      remark,
      settlementDate,
    })

    if (result.success) {
      setMessage({ type: 'success', text: '结算成功！' })
      setAmount(0)
      setRemark('')
      setTimeout(() => setMessage(null), 3000)
    } else {
      setMessage({ type: 'error', text: result.message || '结算失败' })
    }
  }

  const recentSettlements = settlementRecords.slice(-10).reverse()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">押金结算</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">新建结算</h2>
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
                    {c.name} (总押金: {c.totalDeposit}元, 可用: {c.totalDeposit - c.usedDeposit}元)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结算类型</label>
              <div className="flex gap-2">
                {[
                  { value: 'deposit_payment', label: '押金充值', icon: CreditCard },
                  { value: 'deduction', label: '扣款', icon: DollarSign },
                  { value: 'refund', label: '退款', icon: ArrowLeftRight },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value as typeof type)}
                    className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1 text-sm ${
                      type === t.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">金额 (元)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="备注说明..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结算日期</label>
              <input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {selectedCustomerData && (
              <div className="p-3 bg-blue-50 rounded-lg text-sm">
                <p>客户: {selectedCustomerData.name}</p>
                <p>总押金: {selectedCustomerData.totalDeposit}元</p>
                <p>已用押金: {selectedCustomerData.usedDeposit}元</p>
                <p>可用押金: <span className="font-bold">{selectedCustomerData.totalDeposit - selectedCustomerData.usedDeposit}元</span></p>
                {type === 'deposit_payment' && (
                  <p className="text-green-600 mt-1">充值后可用: <span className="font-bold">{selectedCustomerData.totalDeposit - selectedCustomerData.usedDeposit + amount}元</span></p>
                )}
                {type === 'refund' && (
                  <p className="text-orange-600 mt-1">退款后可用: <span className="font-bold">{selectedCustomerData.totalDeposit - selectedCustomerData.usedDeposit - amount}元</span></p>
                )}
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
              <DollarSign className="w-4 h-4" />
              确认结算
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">结算记录</h2>
          <div className="space-y-3">
            {recentSettlements.map((settlement) => (
              <div
                key={settlement.id}
                className={`p-3 rounded-lg border ${
                  settlement.type === 'deposit_payment' ? 'bg-green-50 border-green-200' :
                  settlement.type === 'deduction' ? 'bg-red-50 border-red-200' :
                  'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">{settlement.customerName}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {settlement.type === 'deposit_payment' ? '押金充值' :
                       settlement.type === 'deduction' ? '扣款' : '退款'}
                    </p>
                    {settlement.remark && <p className="text-sm text-gray-400 mt-1">{settlement.remark}</p>}
                  </div>
                  <span className={`text-lg font-bold ${
                    settlement.type === 'deposit_payment' ? 'text-green-600' :
                    settlement.type === 'deduction' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {settlement.type === 'deposit_payment' ? '+' : '-'}{settlement.amount}元
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {settlement.settlementDate}
                </p>
              </div>
            ))}
            {recentSettlements.length === 0 && (
              <p className="text-gray-400 text-center py-8">暂无结算记录</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

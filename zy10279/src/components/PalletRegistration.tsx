import { useState } from 'react'
import { usePalletStore } from '../store'
import { Plus, Package, CheckCircle } from 'lucide-react'

export default function PalletRegistration() {
  const { addPallet, pallets } = usePalletStore()
  const [code, setCode] = useState('')
  const [type, setType] = useState('标准木托盘')
  const [deposit, setDeposit] = useState(50)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const result = addPallet({ code, type, deposit, status: 'in_stock' })
    if (result.success) {
      setMessage({ type: 'success', text: '托盘建档成功！' })
      setCode('')
      setTimeout(() => setMessage(null), 3000)
    } else {
      setMessage({ type: 'error', text: result.message || '建档失败' })
    }
  }

  const recentPallets = pallets.slice(-5).reverse()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">托盘建档</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">新建托盘</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">托盘编号</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例如: PLT-0001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">托盘类型</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="标准木托盘">标准木托盘</option>
                <option value="塑料托盘">塑料托盘</option>
                <option value="钢制托盘">钢制托盘</option>
                <option value="免熏蒸托盘">免熏蒸托盘</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">押金金额 (元)</label>
              <input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={0}
              />
            </div>
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
              <Plus className="w-4 h-4" />
              建档
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">最近建档 ({pallets.length}个托盘)</h2>
          <div className="space-y-3">
            {recentPallets.map((pallet) => (
              <div key={pallet.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-800">{pallet.code}</p>
                    <p className="text-sm text-gray-500">{pallet.type} · 押金{pallet.deposit}元</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  pallet.status === 'in_stock' ? 'bg-green-100 text-green-700' :
                  pallet.status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                  pallet.status === 'with_customer' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {pallet.status === 'in_stock' ? '在库' :
                   pallet.status === 'in_transit' ? '在途' :
                   pallet.status === 'with_customer' ? '客户持有' : '待赔付'}
                </span>
              </div>
            ))}
            {recentPallets.length === 0 && (
              <p className="text-gray-400 text-center py-8">暂无托盘记录</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

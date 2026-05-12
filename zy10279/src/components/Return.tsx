import { useState } from 'react'
import { usePalletStore } from '../store'
import { ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'

export default function Return() {
  const { returnPallet, outboundRecords, pallets } = usePalletStore()
  const [selectedOutbound, setSelectedOutbound] = useState('')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [damageChecks, setDamageChecks] = useState<{ palletId: string; damaged: boolean; level: string; description: string }[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)

  const signedOutbounds = outboundRecords.filter(o => o.status === 'signed' || o.status === 'overdue' || o.status === 'returned')
  const selectedOutboundData = outboundRecords.find(o => o.id === selectedOutbound)

  const handleOutboundChange = (outboundId: string) => {
    setSelectedOutbound(outboundId)
    const outbound = outboundRecords.find(o => o.id === outboundId)
    if (outbound) {
      setDamageChecks(outbound.palletIds.map(id => ({
        palletId: id,
        damaged: false,
        level: 'minor',
        description: '',
      })))
    }
  }

  const handleDamageToggle = (palletId: string, damaged: boolean) => {
    setDamageChecks(prev =>
      prev.map(dc =>
        dc.palletId === palletId ? { ...dc, damaged } : dc
      )
    )
  }

  const handleDamageLevelChange = (palletId: string, level: string) => {
    setDamageChecks(prev =>
      prev.map(dc =>
        dc.palletId === palletId ? { ...dc, level } : dc
      )
    )
  }

  const handleDamageDescriptionChange = (palletId: string, description: string) => {
    setDamageChecks(prev =>
      prev.map(dc =>
        dc.palletId === palletId ? { ...dc, description } : dc
      )
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOutbound) {
      setMessage({ type: 'error', text: '请选择出库单' })
      return
    }

    const incompleteDamage = damageChecks.find(d => d.damaged && !d.description.trim())
    if (incompleteDamage) {
      setMessage({ type: 'error', text: '请填写所有破损托盘的破损描述' })
      return
    }

    const result = returnPallet(selectedOutbound, returnDate, damageChecks)
    if (result.success) {
      const damagedCount = damageChecks.filter(d => d.damaged).length
      setMessage({
        type: 'success',
        text: `回收成功！${damagedCount > 0 ? `发现${damagedCount}个破损托盘，已记录待处理` : '所有托盘完好'}`
      })
      setSelectedOutbound('')
      setDamageChecks([])
      setTimeout(() => setMessage(null), 4000)
    } else {
      setMessage({ type: 'error', text: result.message || '回收失败' })
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">回收验收</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">回收确认</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择出库单</label>
              <select
                value={selectedOutbound}
                onChange={(e) => handleOutboundChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">请选择出库单</option>
                {signedOutbounds.filter(o => o.status !== 'returned').map(o => (
                  <option key={o.id} value={o.id}>
                    {o.customerName} - {o.outboundDate} - {o.palletIds.length}个托盘
                    {o.status === 'overdue' ? ' (逾期)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">回收日期</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
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
                 message.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : null}
                {message.text}
              </div>
            )}
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              确认回收
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">托盘验收</h2>
          {selectedOutboundData ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-800">{selectedOutboundData.customerName}</p>
                <p className="text-sm text-gray-500">{selectedOutboundData.palletIds.length}个托盘</p>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {damageChecks.map((dc) => {
                  const pallet = pallets.find(p => p.id === dc.palletId)
                  return (
                    <div key={dc.palletId} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">{pallet?.code || dc.palletId}</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dc.damaged}
                            onChange={(e) => handleDamageToggle(dc.palletId, e.target.checked)}
                            className="w-4 h-4 text-red-600"
                          />
                          <span className="text-sm text-red-600">破损</span>
                        </label>
                      </div>
                      {dc.damaged && (
                        <div className="space-y-2 bg-red-50 p-3 rounded-lg">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">破损等级</label>
                            <select
                              value={dc.level}
                              onChange={(e) => handleDamageLevelChange(dc.palletId, e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="minor">轻微 (扣款20元)</option>
                              <option value="medium">中等 (扣款50元)</option>
                              <option value="severe">严重 (扣款100元)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">破损描述</label>
                            <input
                              type="text"
                              value={dc.description}
                              onChange={(e) => handleDamageDescriptionChange(dc.palletId, e.target.value)}
                              placeholder="描述破损情况..."
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">请先选择出库单</p>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { usePalletStore } from '../store'
import { AlertTriangle, CheckCircle, DollarSign, X } from 'lucide-react'

export default function DamageProcessing() {
  const { processDamage, damageRecords, pallets, customers } = usePalletStore()
  const [selectedDamage, setSelectedDamage] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const pendingDamages = damageRecords.filter(d => !d.deducted)
  const selectedDamageData = damageRecords.find(d => d.id === selectedDamage)
  const selectedDamagePallet = pallets.find(p => p.id === selectedDamageData?.palletId)
  const selectedCustomer = customers.find(c => c.id === selectedDamageData?.customerId)

  const handleProcess = (deduct: boolean) => {
    if (!selectedDamage) return
    const result = processDamage(selectedDamage, deduct)
    if (result.success) {
      setMessage({ type: 'success', text: deduct ? '扣款成功！托盘已返回在库状态' : '已处理，豁免扣款，托盘已返回在库状态' })
      setSelectedDamage(null)
      setTimeout(() => setMessage(null), 3000)
    } else {
      setMessage({ type: 'error', text: result.message || '处理失败' })
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">破损扣款</h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">待处理破损 ({pendingDamages.length})</h2>
          <div className="space-y-3">
            {pendingDamages.map((damage) => {
              const pallet = pallets.find(p => p.id === damage.palletId)
              return (
                <div
                  key={damage.id}
                  onClick={() => setSelectedDamage(damage.id)}
                  className={`p-4 rounded-lg cursor-pointer border-2 transition-all ${
                    selectedDamage === damage.id
                      ? 'bg-red-50 border-red-500'
                      : 'bg-gray-50 border-transparent hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="font-medium text-gray-800">{pallet?.code || damage.palletId}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{damage.customerName}</p>
                      <p className="text-sm text-gray-600 mt-1">{damage.damageDescription}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      damage.damageLevel === 'minor' ? 'bg-yellow-100 text-yellow-700' :
                      damage.damageLevel === 'medium' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {damage.damageLevel === 'minor' ? '轻微' :
                       damage.damageLevel === 'medium' ? '中等' : '严重'}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-sm text-gray-500">检测日期: {damage.detectedDate}</span>
                    <span className="font-bold text-red-600">扣款 {damage.deductionAmount} 元</span>
                  </div>
                </div>
              )
            })}
            {pendingDamages.length === 0 && (
              <p className="text-gray-400 text-center py-8">暂无待处理破损</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">处理破损</h2>
          {selectedDamageData ? (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="font-bold text-lg text-red-700">
                    {selectedDamagePallet?.code || selectedDamageData.palletId}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-500">客户:</span> <span className="font-medium">{selectedDamageData.customerName}</span></p>
                  <p><span className="text-gray-500">破损等级:</span> <span className="font-medium">
                    {selectedDamageData.damageLevel === 'minor' ? '轻微' :
                     selectedDamageData.damageLevel === 'medium' ? '中等' : '严重'}
                  </span></p>
                  <p><span className="text-gray-500">破损描述:</span> <span>{selectedDamageData.damageDescription}</span></p>
                  <p><span className="text-gray-500">检测日期:</span> <span>{selectedDamageData.detectedDate}</span></p>
                  <p className="text-lg font-bold text-red-600 mt-2">
                    扣款金额: {selectedDamageData.deductionAmount} 元
                  </p>
                </div>
              </div>

              {selectedCustomer && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    客户 <span className="font-medium">{selectedCustomer.name}</span> 当前押金情况:
                  </p>
                  <p className="text-sm mt-1">
                    可用押金: <span className="font-bold text-green-600">{selectedCustomer.totalDeposit - selectedCustomer.usedDeposit} 元</span>
                  </p>
                  {selectedCustomer.totalDeposit - selectedCustomer.usedDeposit < selectedDamageData.deductionAmount && (
                    <p className="text-sm text-red-600 mt-1">
                      ⚠️ 押金不足以支付本次扣款，请先通知客户充值
                    </p>
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

              <div className="flex gap-3">
                <button
                  onClick={() => handleProcess(true)}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-4 h-4" />
                  确认扣款
                </button>
                <button
                  onClick={() => handleProcess(false)}
                  className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  豁免扣款
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">请选择待处理的破损记录</p>
          )}
        </div>
      </div>
    </div>
  )
}

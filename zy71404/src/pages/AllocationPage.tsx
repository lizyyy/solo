import { useState } from 'react'
import { Calculator, RefreshCw, Check, Info } from 'lucide-react'
import { useAppStore } from '@/store'
import { calculateFeeAllocations, checkShortPayment } from '@/utils/feeCalculator'
import type { FeeType } from '@/types'

const feeTypeLabels: Record<FeeType, string> = {
  bank_fee: '银行手续费',
  agent_fee: '代理行费用',
  short_payment: '客户短付',
  other: '其他费用'
}

export default function AllocationPage() {
  const {
    receipts,
    invoices,
    feeAllocations,
    addFeeAllocation,
    clearAllocationsForReceipt,
    updateReceipt,
    addAuditLog,
    currentOperator
  } = useAppStore()

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null)

  const selectedReceipt = receipts.find((r) => r.id === selectedReceiptId)
  const receiptInvoices = invoices.filter((i) => i.receiptId === selectedReceiptId)
  const receiptAllocations = feeAllocations.filter((a) => a.receiptId === selectedReceiptId)

  const handleAutoAllocate = () => {
    if (!selectedReceipt || receiptInvoices.length === 0) return

    clearAllocationsForReceipt(selectedReceipt.id)

    if (selectedReceipt.bankFee && selectedReceipt.bankFee > 0) {
      const bankAllocations = calculateFeeAllocations(
        selectedReceipt,
        receiptInvoices,
        'bank_fee',
        selectedReceipt.bankFee,
        selectedReceipt.currency
      )
      bankAllocations.forEach((a) => addFeeAllocation(a))
    }

    if (selectedReceipt.agentFee && selectedReceipt.agentFee > 0) {
      const agentAllocations = calculateFeeAllocations(
        selectedReceipt,
        receiptInvoices,
        'agent_fee',
        selectedReceipt.agentFee,
        selectedReceipt.currency
      )
      agentAllocations.forEach((a) => addFeeAllocation(a))
    }

    const shortPaymentCheck = checkShortPayment(selectedReceipt, receiptInvoices)
    if (shortPaymentCheck.isShort && shortPaymentCheck.diffAmount < 0) {
      const shortAllocations = calculateFeeAllocations(
        selectedReceipt,
        receiptInvoices,
        'short_payment',
        Math.abs(shortPaymentCheck.diffAmount),
        selectedReceipt.currency
      )
      shortAllocations.forEach((a) => addFeeAllocation(a))
    }

    updateReceipt(selectedReceipt.id, { status: 'allocated' })
    addAuditLog({
      receiptId: selectedReceipt.id,
      action: 'allocate',
      operator: currentOperator,
      remark: '自动分摊费用'
    })
  }

  const handleSaveAllocations = () => {
    if (!selectedReceipt) return
    updateReceipt(selectedReceipt.id, { status: 'allocated' })
  }

  const getInvoiceAllocations = (invoiceId: string) => {
    return receiptAllocations.filter((a) => a.invoiceId === invoiceId)
  }

  const getTotalAllocated = () => {
    return receiptAllocations.reduce((sum, a) => sum + a.amount, 0)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">费用分摊</h1>
        <p className="text-gray-500">自动或手动分摊银行费用、代理行费用和客户短付</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-medium text-gray-700 mb-4">选择收款流水</h3>
            <div className="space-y-2">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  onClick={() => setSelectedReceiptId(receipt.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedReceiptId === receipt.id
                    ? 'bg-primary-50 border-2 border-primary-500'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'}
                  `}
                >
                  <div className="font-mono text-sm">{receipt.receiptNo}</div>
                  <div className="text-sm text-gray-600">
                    {receipt.currency} {receipt.amount.toLocaleString()}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">{receipt.receiptDate}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${receipt.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      receipt.status === 'allocated' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'}
                    `}>
                      {receipt.status === 'pending' ? '待分摊' :
                       receipt.status === 'allocated' ? '已分摊' : '已复核'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          {selectedReceipt ? (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-700">收款信息</h3>
                  <button
                    onClick={handleAutoAllocate}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    <Calculator size={16} />
                    自动分摊
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">流水号</label>
                    <p className="font-mono">{selectedReceipt.receiptNo}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">收款金额</label>
                    <p className="font-mono font-medium">
                      {selectedReceipt.currency} {selectedReceipt.amount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">银行手续费</label>
                    <p className="font-mono">{selectedReceipt.bankFee || 0}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">代理行费用</label>
                    <p className="font-mono">{selectedReceipt.agentFee || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-medium text-gray-700">分摊明细</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">发票号</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">客户</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">发票金额</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">费用类型</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">分摊金额</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">分摊理由</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiptInvoices.map((invoice) => {
                        const allocations = getInvoiceAllocations(invoice.id)
                        return allocations.length > 0 ? allocations.map((alloc, idx) => (
                          <tr key={alloc.id} className="border-b border-gray-50">
                            {idx === 0 && (
                              <>
                                <td rowSpan={allocations.length} className="px-4 py-3 font-mono text-sm">
                                  {invoice.invoiceNo}
                                </td>
                                <td rowSpan={allocations.length} className="px-4 py-3 text-sm">
                                  {invoice.customer}
                                </td>
                                <td rowSpan={allocations.length} className="px-4 py-3 font-mono text-sm">
                                  {invoice.currency} {invoice.amount.toLocaleString()}
                                </td>
                              </>
                            )}
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 rounded text-xs ${
                                alloc.feeType === 'bank_fee' ? 'bg-blue-100 text-blue-700' :
                                alloc.feeType === 'agent_fee' ? 'bg-purple-100 text-purple-700' :
                                'bg-orange-100 text-orange-700'}
                              `}>
                                {feeTypeLabels[alloc.feeType]}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-sm">
                              {alloc.amount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                              <div className="flex items-start gap-1">
                                <Info size={12} className="mt-0.5 flex-shrink-0 text-primary-500" />
                                <span>{alloc.reason}</span>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr key={invoice.id} className="border-b border-gray-50">
                            <td className="px-4 py-3 font-mono text-sm">{invoice.invoiceNo}</td>
                            <td className="px-4 py-3 text-sm">{invoice.customer}</td>
                            <td className="px-4 py-3 font-mono text-sm">
                              {invoice.currency} {invoice.amount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400">-</td>
                            <td className="px-4 py-3 text-sm text-gray-400">-</td>
                            <td className="px-4 py-3 text-sm text-gray-400">未分摊</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {receiptAllocations.length > 0 && (
                  <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      已分摊 <span className="font-medium">{receiptAllocations.length}</span> 笔费用
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        分摊合计: <span className="font-mono font-medium">{selectedReceipt.currency} {getTotalAllocated().toFixed(2)}</span>
                      </span>
                      <button
                        onClick={handleSaveAllocations}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <Check size={16} />
                        确认分摊
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {receiptAllocations.length === 0 && (
                <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
                  <Calculator size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-4">点击"自动分摊"按钮生成分摊明细</p>
                  <p className="text-sm text-gray-400">系统将按发票金额占比自动计算各发票的费用分摊</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
              <RefreshCw size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">请从左侧选择一个收款流水</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

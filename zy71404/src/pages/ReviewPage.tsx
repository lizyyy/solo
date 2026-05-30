import { useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, FileText, Clock, User } from 'lucide-react'
import { useAppStore } from '@/store'
import type { Receipt, Anomaly } from '@/types'

export default function ReviewPage() {
  const {
    receipts,
    invoices,
    feeAllocations,
    anomalies,
    auditLogs,
    updateReceipt,
    resolveAnomaly,
    addAuditLog,
    currentOperator
  } = useAppStore()

  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null)
  const [showEvidence, setShowEvidence] = useState<string | null>(null)

  const pendingReceipts = receipts.filter((r) => r.status === 'allocated' || r.status === 'pending')
  const reviewedReceipts = receipts.filter((r) => r.status === 'reviewed')

  const getReceiptAnomalies = (receiptId: string) => {
    return anomalies.filter((a) => a.receiptId === receiptId && !a.resolved)
  }

  const getReceiptInvoices = (receiptId: string) => {
    return invoices.filter((i) => i.receiptId === receiptId)
  }

  const getReceiptAllocations = (receiptId: string) => {
    return feeAllocations.filter((a) => a.receiptId === receiptId)
  }

  const getReceiptAuditLogs = (receiptId: string) => {
    return auditLogs.filter((l) => l.receiptId === receiptId)
  }

  const handleApprove = (receipt: Receipt) => {
    updateReceipt(receipt.id, { status: 'reviewed' })
    addAuditLog({
      receiptId: receipt.id,
      action: 'review',
      operator: currentOperator,
      remark: '复核通过'
    })
  }

  const handleReject = (receipt: Receipt) => {
    updateReceipt(receipt.id, { status: 'pending' })
    addAuditLog({
      receiptId: receipt.id,
      action: 'reject',
      operator: currentOperator,
      remark: '复核驳回，待调整'
    })
  }

  const handleResolveAnomaly = (anomaly: Anomaly) => {
    resolveAnomaly(anomaly.id, currentOperator)
  }

  const ReceiptCard = ({ receipt, showActions = false }: { receipt: Receipt; showActions?: boolean }) => {
    const receiptAnomalies = getReceiptAnomalies(receipt.id)
    const receiptInvoices = getReceiptInvoices(receipt.id)
    const isExpanded = expandedReceipt === receipt.id

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <div
          className="p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setExpandedReceipt(isExpanded ? null : receipt.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {receiptAnomalies.length > 0 && (
                <div className="relative">
                  <AlertTriangle className="text-warning-500" size={20} />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {receiptAnomalies.length}
                  </span>
                </div>
              )}
              <div>
                <div className="font-mono font-medium">{receipt.receiptNo}</div>
                <div className="text-sm text-gray-500">{receipt.payer}</div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="font-mono font-medium">
                  {receipt.currency} {receipt.amount.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">{receipt.receiptDate}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${receipt.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  receipt.status === 'allocated' ? 'bg-blue-100 text-blue-700' :
                  receipt.status === 'reviewed' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'}
                `}>
                  {receipt.status === 'pending' ? '待分摊' :
                   receipt.status === 'allocated' ? '待复核' :
                   receipt.status === 'reviewed' ? '已复核' : '已驳回'}
                </span>
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>
          </div>

          {receiptAnomalies.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {receiptAnomalies.map((anomaly) => (
                <span
                  key={anomaly.id}
                  className={`px-2 py-1 rounded text-xs ${anomaly.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}
                `}>
                  {anomaly.severity === 'error' ? '⚠️ ' : '⚡ '}
                  {anomaly.description.substring(0, 30)}...
                </span>
              ))}
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="border-t border-gray-100">
            <div className="bg-primary-50 p-4 evidence-chain">
              <h4 className="text-sm font-medium text-primary-700 mb-3 flex items-center gap-2">
                <FileText size={16} />
                证据链 - 点击可追溯明细
              </h4>

              <div className="grid grid-cols-3 gap-4">
                <div
                  className="bg-white rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setShowEvidence(showEvidence === `invoices-${receipt.id}` ? null : `invoices-${receipt.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">关联发票</span>
                    <Eye size={14} className="text-primary-500" />
                  </div>
                  <div className="text-2xl font-bold">{receiptInvoices.length}</div>
                  {showEvidence === `invoices-${receipt.id}` && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {receiptInvoices.map((inv) => (
                        <div key={inv.id} className="text-xs">
                          <span className="font-mono">{inv.invoiceNo}</span>
                          <span className="text-gray-500 mx-2">|</span>
                          <span className="font-mono">{inv.currency} {inv.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="bg-white rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setShowEvidence(showEvidence === `allocations-${receipt.id}` ? null : `allocations-${receipt.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">分摊记录</span>
                    <Eye size={14} className="text-primary-500" />
                  </div>
                  <div className="text-2xl font-bold">{getReceiptAllocations(receipt.id).length}</div>
                  {showEvidence === `allocations-${receipt.id}` && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {getReceiptAllocations(receipt.id).map((alloc) => (
                        <div key={alloc.id} className="text-xs">
                          <span className="font-mono">{alloc.feeType === 'bank_fee' ? '手续费' : alloc.feeType === 'agent_fee' ? '代理费' : '短付'}</span>
                          <span className="text-gray-500 mx-2">|</span>
                          <span className="font-mono">{alloc.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="bg-white rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setShowEvidence(showEvidence === `logs-${receipt.id}` ? null : `logs-${receipt.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">操作日志</span>
                    <Eye size={14} className="text-primary-500" />
                  </div>
                  <div className="text-2xl font-bold">{getReceiptAuditLogs(receipt.id).length}</div>
                  {showEvidence === `logs-${receipt.id}` && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {getReceiptAuditLogs(receipt.id).map((log) => (
                        <div key={log.id} className="text-xs">
                          <div className="flex items-center gap-1">
                            <Clock size={10} />
                            <span className="text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          <div>
                            <User size={10} className="inline mr-1" />
                            {log.operator} - {log.remark}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {receiptAnomalies.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">异常检测</h5>
                  <div className="space-y-2">
                    {receiptAnomalies.map((anomaly) => (
                      <div
                        key={anomaly.id}
                        className={`p-3 rounded-lg ${anomaly.severity === 'error' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}
                      `}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <AlertTriangle size={16} className={anomaly.severity === 'error' ? 'text-red-500' : 'text-yellow-500'} />
                              <span className="font-medium text-sm">{anomaly.description}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 ml-6">证据: {anomaly.evidence}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleResolveAnomaly(anomaly)
                            }}
                            className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                          >
                            标记已解决
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {showActions && (
              <div className="p-4 bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => handleReject(receipt)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white"
                >
                  <XCircle size={16} />
                  驳回
                </button>
                <button
                  onClick={() => handleApprove(receipt)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle size={16} />
                  复核通过
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">复核工作台</h1>
        <p className="text-gray-500">审核异常项，追溯完整证据链，确保分摊准确</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <h2 className="font-medium text-gray-700">待复核 ({pendingReceipts.length})</h2>
          </div>
          {pendingReceipts.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
              <CheckCircle size={48} className="mx-auto text-green-300 mb-3" />
              <p className="text-gray-500">暂无待复核项</p>
            </div>
          ) : (
            pendingReceipts.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} showActions />
            ))
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <h2 className="font-medium text-gray-700">已复核 ({reviewedReceipts.length})</h2>
          </div>
          {reviewedReceipts.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
              <Clock size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">暂无已复核记录</p>
            </div>
          ) : (
            reviewedReceipts.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Plus, Edit2, Trash2, Search, Filter, FileText } from 'lucide-react'
import { useAppStore } from '@/store'
import type { Currency, ReceiptStatus } from '@/types'

const statusLabels: Record<ReceiptStatus, { label: string; color: string }> = {
  pending: { label: '待分摊', color: 'bg-yellow-100 text-yellow-800' },
  allocated: { label: '已分摊', color: 'bg-blue-100 text-blue-800' },
  reviewed: { label: '已复核', color: 'bg-green-100 text-green-800' },
  rejected: { label: '已驳回', color: 'bg-red-100 text-red-800' },
}

const currencyOptions: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'CNY']

export default function ReceiptPage() {
  const { receipts, addReceipt, updateReceipt, deleteReceipt, invoices, linkInvoiceToReceipt } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<ReceiptStatus | 'all'>('all')
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    receiptNo: '',
    receiptDate: new Date().toISOString().split('T')[0],
    currency: 'USD' as Currency,
    amount: 0,
    bankName: '',
    payer: '',
    remark: '',
    status: 'pending' as ReceiptStatus,
    exchangeRate: 0,
    exchangeRateDate: '',
    bankFee: 0,
    agentFee: 0,
  })

  const filteredReceipts = receipts.filter((r) => {
    const matchSearch = r.receiptNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.payer.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    return matchSearch && matchStatus
  })

  const handleSubmit = () => {
    if (editingId) {
      updateReceipt(editingId, formData)
    } else {
      addReceipt(formData)
    }
    resetForm()
  }

  const handleEdit = (receipt: typeof formData & { id: string }) => {
    setEditingId(receipt.id)
    setFormData({
      receiptNo: receipt.receiptNo,
      receiptDate: receipt.receiptDate,
      currency: receipt.currency,
      amount: receipt.amount,
      bankName: receipt.bankName,
      payer: receipt.payer,
      remark: receipt.remark,
      status: receipt.status,
      exchangeRate: receipt.exchangeRate || 0,
      exchangeRateDate: receipt.exchangeRateDate || '',
      bankFee: receipt.bankFee || 0,
      agentFee: receipt.agentFee || 0,
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      receiptNo: '',
      receiptDate: new Date().toISOString().split('T')[0],
      currency: 'USD',
      amount: 0,
      bankName: '',
      payer: '',
      remark: '',
      status: 'pending',
      exchangeRate: 0,
      exchangeRateDate: '',
      bankFee: 0,
      agentFee: 0,
    })
  }

  const getReceiptInvoices = (receiptId: string) => {
    return invoices.filter((i) => i.receiptId === receiptId)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">收款登记</h1>
          <p className="text-gray-500">录入银行到账流水，关联对应发票</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={18} />
          新增收款
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="搜索流水号或付款方..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ReceiptStatus | 'all')}
            className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white"
          >
            <option value="all">全部状态</option>
            <option value="pending">待分摊</option>
            <option value="allocated">已分摊</option>
            <option value="reviewed">已复核</option>
          </select>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">
              {editingId ? '编辑收款流水' : '新增收款流水'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">流水号</label>
                <input
                  type="text"
                  value={formData.receiptNo}
                  onChange={(e) => setFormData({ ...formData, receiptNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">收款日期</label>
                <input
                  type="date"
                  value={formData.receiptDate}
                  onChange={(e) => setFormData({ ...formData, receiptDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">币种</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value as Currency })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {currencyOptions.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">收款金额</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">银行名称</label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">付款方</label>
                <input
                  type="text"
                  value={formData.payer}
                  onChange={(e) => setFormData({ ...formData, payer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">汇率</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.exchangeRate}
                  onChange={(e) => setFormData({ ...formData, exchangeRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">汇率日期</label>
                <input
                  type="date"
                  value={formData.exchangeRateDate}
                  onChange={(e) => setFormData({ ...formData, exchangeRateDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">银行手续费</label>
                <input
                  type="number"
                  value={formData.bankFee}
                  onChange={(e) => setFormData({ ...formData, bankFee: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">代理行费用</label>
                <input
                  type="number"
                  value={formData.agentFee}
                  onChange={(e) => setFormData({ ...formData, agentFee: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {editingId ? '保存修改' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">流水号</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">日期</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">币种/金额</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">银行/付款方</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">费用</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">关联发票</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">状态</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceipts.map((receipt) => (
              <tr
                key={receipt.id}
                className="border-b border-gray-50 table-row-hover cursor-pointer"
                onClick={() => setSelectedReceipt(selectedReceipt === receipt.id ? null : receipt.id)}
              >
                <td className="px-6 py-4">
                  <span className="font-mono text-sm">{receipt.receiptNo}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{receipt.receiptDate}</td>
                <td className="px-6 py-4">
                  <span className="font-mono font-medium">
                    {receipt.currency} {receipt.amount.toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <div className="font-medium">{receipt.bankName}</div>
                    <div className="text-gray-500 text-xs">{receipt.payer}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="text-gray-600">
                    <span className="text-gray-500">手续费:</span> {receipt.bankFee || 0}
                  </div>
                  <div className="text-gray-600">
                    <span className="text-gray-500">代理费:</span> {receipt.agentFee || 0}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-sm text-primary-600">
                    <FileText size={14} />
                    {getReceiptInvoices(receipt.id).length} 张
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusLabels[receipt.status].color}`}>
                    {statusLabels[receipt.status].label}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(receipt as typeof formData & { id: string })
                      }}
                      className="p-1 text-gray-400 hover:text-primary-600"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('确定删除此收款流水？')) {
                          deleteReceipt(receipt.id)
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedReceipt && (
        <div className="mt-6 bg-white rounded-xl p-6 border border-primary-200">
          <h3 className="font-bold text-lg mb-4">关联发票</h3>
          <InvoiceLinker
            receiptId={selectedReceipt}
            onLink={(invoiceId) => linkInvoiceToReceipt(invoiceId, selectedReceipt)}
          />
        </div>
      )}
    </div>
  )
}

function InvoiceLinker({ receiptId, onLink }: { receiptId: string; onLink: (invoiceId: string) => void }) {
  const { invoices } = useAppStore()
  const linkedInvoices = invoices.filter((i) => i.receiptId === receiptId)
  const availableInvoices = invoices.filter((i) => !i.receiptId)

  return (
    <div>
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">已关联发票</h4>
        {linkedInvoices.length === 0 ? (
          <p className="text-gray-400 text-sm">暂无关联发票</p>
        ) : (
          <div className="space-y-2">
            {linkedInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-mono text-sm">{inv.invoiceNo}</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span className="text-sm text-gray-600">{inv.customer}</span>
                </div>
                <span className="font-mono text-sm">
                  {inv.currency} {inv.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">可关联发票</h4>
        {availableInvoices.length === 0 ? (
          <p className="text-gray-400 text-sm">暂无可关联发票</p>
        ) : (
          <div className="space-y-2">
            {availableInvoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => onLink(inv.id)}
                className="flex items-center justify-between p-3 border border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 cursor-pointer"
              >
                <div>
                  <span className="font-mono text-sm">{inv.invoiceNo}</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span className="text-sm text-gray-600">{inv.customer}</span>
                </div>
                <span className="font-mono text-sm">
                  {inv.currency} {inv.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

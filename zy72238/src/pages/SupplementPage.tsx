import { useState } from 'react'
import { MailPlus, Trash2, ArrowRight, Check, X, AlertCircle, FileText } from 'lucide-react'
import { useStore } from '@/store/useStore'

const conflictBadge: Record<string, string> = {
  none: 'bg-emerald-500/20 text-emerald-400',
  conflict: 'bg-red-500/20 text-red-400',
  resolved: 'bg-blue-500/20 text-blue-400',
}
const conflictLabel: Record<string, string> = { none: '无冲突', conflict: '有冲突', resolved: '已解决' }
const decisionBadge: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400',
  confirmed: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
}
const decisionLabel: Record<string, string> = { pending: '待处理', confirmed: '已确认', rejected: '已驳回' }

export default function SupplementPage() {
  const { transactions, supplementEmails, addSupplementEmail, resolveConflict } = useStore()
  const [selectedBusinessNo, setSelectedBusinessNo] = useState('')
  const [amount, setAmount] = useState('')
  const [counterTailNo, setCounterTailNo] = useState('')
  const [emailContent, setEmailContent] = useState('')

  const usedBusinessNos = supplementEmails.map((e) => e.businessNo)
  const availableTransactions = transactions.filter((t) => !usedBusinessNos.includes(t.businessNo))
  const conflicts = supplementEmails.filter((e) => e.conflictStatus === 'conflict')

  const handleSubmit = () => {
    if (!selectedBusinessNo || !amount || !counterTailNo || !emailContent) return
    const tx = transactions.find((t) => t.businessNo === selectedBusinessNo)
    if (!tx) return
    addSupplementEmail(selectedBusinessNo, emailContent, Number(amount), counterTailNo)
    handleClear()
  }

  const handleClear = () => {
    setSelectedBusinessNo('')
    setAmount('')
    setCounterTailNo('')
    setEmailContent('')
  }

  const handleResolve = (emailId: string, decision: 'confirmed' | 'rejected') => {
    resolveConflict(emailId, decision)
  }

  const inputCls =
    'w-full rounded-lg bg-slate-700/50 border border-slate-600/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30'

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">客户经理补充邮件补录</h1>
          <p className="mt-1 text-sm text-slate-400">补录客户经理补充邮件数据，处理与柜台流水的冲突判定</p>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow-lg">
          <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-200">
            <MailPlus className="h-5 w-5 text-amber-400" />
            邮件补录
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-400">关联业务号</label>
              <select
                value={selectedBusinessNo}
                onChange={(e) => setSelectedBusinessNo(e.target.value)}
                className={inputCls}
              >
                <option value="">请选择业务号</option>
                {availableTransactions.map((t) => (
                  <option key={t.id} value={t.businessNo}>
                    {t.businessNo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">补充金额</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="请输入补充金额"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">柜台流水尾号</label>
              <input
                type="text"
                value={counterTailNo}
                onChange={(e) => setCounterTailNo(e.target.value)}
                placeholder="请输入流水尾号"
                className={inputCls}
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-slate-400">邮件内容</label>
              <textarea
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                placeholder="请粘贴客户经理补充邮件内容"
                rows={4}
                className={inputCls + ' resize-none'}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
              disabled={!selectedBusinessNo || !amount || !counterTailNo || !emailContent}
            >
              <MailPlus className="h-4 w-4" />
              提交补录
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-500"
            >
              <Trash2 className="h-4 w-4" />
              清空
            </button>
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow-lg">
            <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-200">
              <AlertCircle className="h-5 w-5 text-red-400" />
              冲突证据
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
                {conflicts.length}
              </span>
            </div>
            <div className="space-y-4">
              {conflicts.map((email) => {
                const tx = transactions.find((t) => t.id === email.relatedTransactionId)
                if (!tx) return null
                const amountConflict = email.emailAmount !== tx.amount
                const tailConflict = email.emailCounterTailNo !== tx.counterTailNo
                return (
                  <div
                    key={email.id}
                    className="rounded-lg border border-slate-600/50 bg-slate-700/30 p-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg bg-slate-800/60 p-4">
                        <div className="mb-2 text-xs font-semibold text-slate-400">柜台流水数据</div>
                        <div className="space-y-1.5 text-sm">
                          <div className="text-slate-300">
                            业务号：<span className="font-mono text-slate-100">{tx.businessNo}</span>
                          </div>
                          <div className={amountConflict ? 'text-red-400' : 'text-slate-300'}>
                            金额：<span className="font-mono">{tx.amount.toLocaleString()}</span>
                            {amountConflict && (
                              <AlertCircle className="ml-1 inline h-3.5 w-3.5 text-amber-400" />
                            )}
                          </div>
                          <div className={tailConflict ? 'text-red-400' : 'text-slate-300'}>
                            流水尾号：<span className="font-mono">{tx.counterTailNo}</span>
                            {tailConflict && (
                              <AlertCircle className="ml-1 inline h-3.5 w-3.5 text-amber-400" />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-800/60 p-4">
                        <div className="mb-2 text-xs font-semibold text-slate-400">
                          客户经理补充邮件
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="text-slate-300">
                            业务号：<span className="font-mono text-slate-100">{email.businessNo}</span>
                          </div>
                          <div className={amountConflict ? 'text-amber-400' : 'text-slate-300'}>
                            金额：<span className="font-mono">{email.emailAmount?.toLocaleString()}</span>
                            {amountConflict && (
                              <AlertCircle className="ml-1 inline h-3.5 w-3.5 text-amber-400" />
                            )}
                          </div>
                          <div className={tailConflict ? 'text-amber-400' : 'text-slate-300'}>
                            流水尾号：<span className="font-mono">{email.emailCounterTailNo}</span>
                            {tailConflict && (
                              <AlertCircle className="ml-1 inline h-3.5 w-3.5 text-amber-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-center text-slate-500">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    {email.operatorDecision !== 'pending' ? (
                      <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                        <span className="text-slate-400">已决定：</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${decisionBadge[email.operatorDecision]}`}
                        >
                          {decisionLabel[email.operatorDecision]}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3 flex justify-center gap-3">
                        <button
                          onClick={() => handleResolve(email.id, 'confirmed')}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
                        >
                          <Check className="h-4 w-4" />
                          确认邮件数据
                        </button>
                        <button
                          onClick={() => handleResolve(email.id, 'rejected')}
                          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                        >
                          <X className="h-4 w-4" />
                          驳回邮件数据
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow-lg">
          <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-200">
            <FileText className="h-5 w-5 text-amber-400" />
            补录历史
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-left text-xs text-slate-400">
                  <th className="pb-3 pr-4 font-medium">业务号</th>
                  <th className="pb-3 pr-4 font-medium">邮件摘要</th>
                  <th className="pb-3 pr-4 font-medium">冲突状态</th>
                  <th className="pb-3 pr-4 font-medium">操作决定</th>
                  <th className="pb-3 font-medium">补录时间</th>
                </tr>
              </thead>
              <tbody>
                {supplementEmails.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      暂无补录记录
                    </td>
                  </tr>
                ) : (
                  supplementEmails.map((email) => (
                    <tr key={email.id} className="border-b border-slate-700/30">
                      <td className="py-3 pr-4 font-mono text-slate-200">{email.businessNo}</td>
                      <td className="max-w-[200px] truncate py-3 pr-4 text-slate-300">
                        {email.content}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${conflictBadge[email.conflictStatus]}`}
                        >
                          {conflictLabel[email.conflictStatus]}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${decisionBadge[email.operatorDecision]}`}
                        >
                          {decisionLabel[email.operatorDecision]}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">{email.createdAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

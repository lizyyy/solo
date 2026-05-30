import { useState, useEffect, useRef } from 'react'
import { FileInput, Upload, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import type { RiskCheckResult } from '../../shared/types'

type TabMode = 'single' | 'batch'

const judgmentIcons = {
  pass: <CheckCircle size={20} className="text-emerald-500" />,
  review: <AlertTriangle size={20} className="text-amber-500" />,
  reject: <XCircle size={20} className="text-red-500" />,
}

const judgmentLabels = {
  pass: '通过',
  review: '需人工复核',
  reject: '拒绝',
}

const judgmentBg = {
  pass: 'bg-emerald-50 border-emerald-200',
  review: 'bg-amber-50 border-amber-200',
  reject: 'bg-red-50 border-red-200',
}

export default function Entry() {
  const { employees, budgets, fetchEmployees, fetchBudgets, createTransaction, batchImport } = useAppStore()
  const [tab, setTab] = useState<TabMode>('single')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<RiskCheckResult | null>(null)
  const [error, setError] = useState('')
  const [csvText, setCsvText] = useState('')
  const [batchResult, setBatchResult] = useState<{ success: number; fail: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    cardNo: '',
    amount: '',
    merchantName: '',
    mcc: '',
    transactionTime: '',
    employeeId: '',
    budgetId: '',
    reimbursementNo: '',
  })

  useEffect(() => {
    fetchEmployees()
    fetchBudgets()
  }, [fetchEmployees, fetchBudgets])

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    setError('')
    try {
      const data = await createTransaction({
        cardNo: form.cardNo,
        amount: Number(form.amount),
        merchantName: form.merchantName,
        mcc: form.mcc,
        transactionTime: form.transactionTime,
        employeeId: form.employeeId,
        budgetId: form.budgetId,
        reimbursementNo: form.reimbursementNo || undefined,
      })
      setResult(data)
      setForm({ cardNo: '', amount: '', merchantName: '', mcc: '', transactionTime: '', employeeId: '', budgetId: '', reimbursementNo: '' })
    } catch (err: any) {
      setError(err.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const parseCsvLine = (line: string) => {
    const parts = line.split(',').map((s) => s.trim())
    if (parts.length < 7) return null
    return {
      cardNo: parts[0],
      amount: Number(parts[1]),
      merchantName: parts[2],
      mcc: parts[3],
      transactionTime: parts[4],
      employeeId: parts[5],
      budgetId: parts[6],
      reimbursementNo: parts[7] || '',
    }
  }

  const handleBatchSubmit = async () => {
    const lines = csvText.split('\n').filter((l) => l.trim())
    const transactions = lines.map(parseCsvLine).filter(Boolean) as any[]
    if (transactions.length === 0) {
      setError('请输入有效的CSV数据')
      return
    }
    setSubmitting(true)
    setError('')
    setBatchResult(null)
    try {
      const results = await batchImport(transactions)
      let success = 0
      let fail = 0
      for (const r of results) {
        if (r.success) success++
        else fail++
      }
      setBatchResult({ success, fail })
      setCsvText('')
    } catch (err: any) {
      setError(err.message || '批量导入失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string || '')
    }
    reader.readAsText(file)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setTab('single')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'single' ? 'bg-navy-500 text-white' : 'bg-white text-slate-600 border border-slate-300'
          }`}
        >
          单笔录入
        </button>
        <button
          onClick={() => setTab('batch')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'batch' ? 'bg-navy-500 text-white' : 'bg-white text-slate-600 border border-slate-300'
          }`}
        >
          批量导入
        </button>
      </div>

      {tab === 'single' ? (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <FileInput size={18} /> 交易信息录入
          </h2>
          <form onSubmit={handleSingleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">卡号 *</label>
              <input className="input-field" value={form.cardNo} onChange={(e) => updateForm('cardNo', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">金额 *</label>
              <input type="number" step="0.01" className="input-field font-mono" value={form.amount} onChange={(e) => updateForm('amount', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">商户名称 *</label>
              <input className="input-field" value={form.merchantName} onChange={(e) => updateForm('merchantName', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">MCC *</label>
              <input className="input-field font-mono" value={form.mcc} onChange={(e) => updateForm('mcc', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">交易时间 *</label>
              <input type="datetime-local" className="input-field" value={form.transactionTime} onChange={(e) => updateForm('transactionTime', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">员工 *</label>
              <select className="select-field" value={form.employeeId} onChange={(e) => updateForm('employeeId', e.target.value)} required>
                <option value="">选择员工</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">预算科目 *</label>
              <select className="select-field" value={form.budgetId} onChange={(e) => updateForm('budgetId', e.target.value)} required>
                <option value="">选择预算科目</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} (额度: {b.totalAmount.toLocaleString('zh-CN')})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">报销单号</label>
              <input className="input-field" value={form.reimbursementNo} onChange={(e) => updateForm('reimbursementNo', e.target.value)} />
            </div>
            <div className="col-span-2 pt-2">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? '提交中...' : '提交并风控校验'}
              </button>
            </div>
          </form>

          {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          {result && (
            <div className={`mt-5 p-4 border rounded-lg ${judgmentBg[result.autoJudgment.decision]}`}>
              <div className="flex items-center gap-2 mb-2">
                {judgmentIcons[result.autoJudgment.decision]}
                <span className="font-semibold">
                  自动判定：{judgmentLabels[result.autoJudgment.decision]}
                </span>
              </div>
              <p className="text-sm">{result.autoJudgment.reason}</p>
              {result.flags.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-slate-500">风控标记：</p>
                  {result.flags.map((flag, i) => (
                    <div key={i} className="text-sm bg-white/60 rounded p-2 border">
                      <span className={`status-badge ${flag.severity === 'error' ? 'status-error' : 'status-warning'} mr-2`}>
                        {flag.severity === 'error' ? '异常' : '预警'}
                      </span>
                      {flag.humanReason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-5 flex items-center gap-2">
            <Upload size={18} /> 批量导入
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            CSV格式：卡号,金额,商户名称,MCC,交易时间,员工ID,预算ID,报销单号
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">上传CSV文件</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-navy-50 file:text-navy-600 file:text-sm file:font-medium hover:file:bg-navy-100"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">或直接粘贴CSV数据</label>
              <textarea
                className="input-field font-mono text-xs h-48"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="卡号,金额,商户名称,MCC,交易时间,员工ID,预算ID,报销单号"
              />
            </div>
            <button onClick={handleBatchSubmit} disabled={submitting || !csvText.trim()} className="btn-primary">
              {submitting ? '导入中...' : '开始导入'}
            </button>
          </div>

          {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          {batchResult && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
              <p className="font-semibold text-emerald-700 mb-1">导入完成</p>
              <p>成功：<span className="font-mono font-semibold">{batchResult.success}</span> 条</p>
              <p>失败：<span className="font-mono font-semibold">{batchResult.fail}</span> 条</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

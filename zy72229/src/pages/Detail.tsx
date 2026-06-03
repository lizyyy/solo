import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import {
  ArrowLeft,
  Upload,
  FileSearch,
  AlertTriangle,
  Check,
  X,
  Shield,
} from 'lucide-react'

const STEPS = ['税费率备注导入', '柜台流水尾号补录', '审计明细更新']

export default function Detail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    getRecord,
    importTaxRateRemark,
    supplementaryCounterFlow,
    resolveConflict,
    reviewMixedCurrency,
    completeAudit,
    getConflictsByRecord,
    currentRole,
  } = useStore()

  const record = getRecord(id!)
  const conflicts = getConflictsByRecord(id!)

  const [taxRate, setTaxRate] = useState('')
  const [remark, setRemark] = useState('')
  const [sourceFile, setSourceFile] = useState('')
  const [importedBy, setImportedBy] = useState('')

  const [tailNumber, setTailNumber] = useState('')
  const [oldStandardAmount, setOldStandardAmount] = useState('')
  const [currency, setCurrency] = useState('')
  const [supplementaryBy, setSupplementaryBy] = useState('')

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">未找到该记录</p>
      </div>
    )
  }

  const step = record.currentStep

  const handleImportTaxRate = () => {
    if (!taxRate || !sourceFile || !importedBy) return
    importTaxRateRemark(id!, {
      recordId: id!,
      taxRate: Number(taxRate),
      remark,
      sourceFile,
      importedAt: new Date().toLocaleString('zh-CN'),
      importedBy,
    })
  }

  const handleSupplementary = () => {
    if (!tailNumber || !oldStandardAmount || !currency || !supplementaryBy) return
    supplementaryCounterFlow(id!, {
      recordId: id!,
      tailNumber,
      oldStandardAmount: Number(oldStandardAmount),
      currency,
      supplementaryAt: new Date().toLocaleString('zh-CN'),
      supplementaryBy,
    })
    setCurrency('')
  }

  const isMixedDetected = currency.includes('/') || currency.includes('港币')

  const canCompleteAudit =
    step >= 2 &&
    (record.hasConflict === false || conflicts.every((c) => c.resolution !== 'pending')) &&
    (!record.hasMixedCurrency || record.status !== 'pending_review') &&
    record.status !== 'completed'

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={18} />
        <span>返回总览</span>
      </button>

      <h1 className="text-2xl font-bold text-navy-800 mb-2">{record.productName}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {record.id} · {record.createdAt}
      </p>

      <div className="flex items-center mb-8">
        {STEPS.map((label, i) => {
          const stepNum = i + 1
          const isCurrent = stepNum === step && stepNum < 3
          const isDone = step >= stepNum && stepNum < step
          return (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    isDone || (step >= 3 && stepNum <= 3)
                      ? 'bg-navy-500 text-white'
                      : isCurrent
                        ? 'bg-teal-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isDone || (step >= 3 && stepNum <= 3) ? <Check size={16} /> : stepNum}
                </div>
                <span
                  className={`text-xs mt-1 text-center ${
                    isDone || (step >= 3 && stepNum <= 3)
                      ? 'text-navy-500 font-medium'
                      : isCurrent
                        ? 'text-teal-500 font-medium'
                        : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 ${
                    step > stepNum ? 'bg-navy-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Upload size={18} className="text-teal-500" />
          税费率备注导入
        </h2>
        {record.taxRateRemark ? (
          <div className="bg-white rounded-lg border p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-500">税费率：</span><span className="font-medium">{record.taxRateRemark.taxRate}%</span></div>
              <div><span className="text-gray-500">备注：</span><span className="font-medium">{record.taxRateRemark.remark || '-'}</span></div>
              <div><span className="text-gray-500">来源文件：</span><span className="font-medium">{record.taxRateRemark.sourceFile}</span></div>
              <div><span className="text-gray-500">导入时间：</span><span className="font-medium">{record.taxRateRemark.importedAt}</span></div>
              <div><span className="text-gray-500">导入人：</span><span className="font-medium">{record.taxRateRemark.importedBy}</span></div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="税费率 (%)" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="border rounded px-3 py-2 text-sm" type="number" />
              <input placeholder="备注" value={remark} onChange={(e) => setRemark(e.target.value)} className="border rounded px-3 py-2 text-sm" />
              <input placeholder="来源文件" value={sourceFile} onChange={(e) => setSourceFile(e.target.value)} className="border rounded px-3 py-2 text-sm" />
              <input placeholder="导入人" value={importedBy} onChange={(e) => setImportedBy(e.target.value)} className="border rounded px-3 py-2 text-sm" />
            </div>
            <button
              onClick={handleImportTaxRate}
              disabled={!taxRate || !sourceFile || !importedBy}
              className="bg-teal-500 text-white px-4 py-2 rounded text-sm hover:bg-teal-600 disabled:opacity-50"
            >
              导入
            </button>
          </div>
        )}
      </section>

      {step >= 1 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <FileSearch size={18} className="text-teal-500" />
            柜台流水尾号补录
          </h2>
          {record.counterFlowTail ? (
            <div className="bg-white rounded-lg border p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">尾号：</span><span className="font-medium">{record.counterFlowTail.tailNumber}</span></div>
                <div><span className="text-gray-500">旧口径金额：</span><span className="font-medium">{record.counterFlowTail.oldStandardAmount.toLocaleString()}</span></div>
                <div><span className="text-gray-500">货币：</span><span className="font-medium">{record.counterFlowTail.currency}</span></div>
                <div><span className="text-gray-500">补录时间：</span><span className="font-medium">{record.counterFlowTail.supplementaryAt}</span></div>
                <div><span className="text-gray-500">补录人：</span><span className="font-medium">{record.counterFlowTail.supplementaryBy}</span></div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="尾号" value={tailNumber} onChange={(e) => setTailNumber(e.target.value)} className="border rounded px-3 py-2 text-sm" />
                <input placeholder="旧口径金额" value={oldStandardAmount} onChange={(e) => setOldStandardAmount(e.target.value)} className="border rounded px-3 py-2 text-sm" type="number" />
                <input placeholder="货币（如：人民币 / 港币/人民币）" value={currency} onChange={(e) => setCurrency(e.target.value)} className="border rounded px-3 py-2 text-sm" />
                <input placeholder="补录人" value={supplementaryBy} onChange={(e) => setSupplementaryBy(e.target.value)} className="border rounded px-3 py-2 text-sm" />
              </div>
              {isMixedDetected && (
                <p className="text-amber-600 text-xs">检测到混合货币，提交后将自动标记为待复核</p>
              )}
              <button
                onClick={handleSupplementary}
                disabled={!tailNumber || !oldStandardAmount || !currency || !supplementaryBy}
                className="bg-teal-500 text-white px-4 py-2 rounded text-sm hover:bg-teal-600 disabled:opacity-50"
              >
                补录
              </button>
            </div>
          )}
        </section>
      )}

      {record.hasMixedCurrency && record.status === 'pending_review' && (
        <section className="mb-6">
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-amber-500" />
              <span className="font-semibold text-amber-800">港币与人民币同列</span>
            </div>
            <p className="text-sm text-amber-700 mb-4">检测到港币与人民币写在同一列，需托管对接人复核</p>
            {currentRole === 'custody_liaison' ? (
              <div className="flex gap-3">
                <button
                  onClick={() => reviewMixedCurrency(id!, true)}
                  className="bg-teal-500 text-white px-4 py-2 rounded text-sm hover:bg-teal-600 flex items-center gap-1"
                >
                  <Check size={14} /> 复核通过
                </button>
                <button
                  onClick={() => reviewMixedCurrency(id!, false)}
                  className="bg-amber-500 text-white px-4 py-2 rounded text-sm hover:bg-amber-600 flex items-center gap-1"
                >
                  <X size={14} /> 复核不通过
                </button>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">等待托管对接人复核</p>
            )}
          </div>
        </section>
      )}

      {record.hasConflict && conflicts.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Shield size={18} className="text-red-500" />
            冲突证据面板
          </h2>
          {conflicts.map((conflict) => (
            <div key={conflict.id} className="bg-red-50 border border-red-300 rounded-lg p-4 mb-3">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="bg-white rounded p-3 border">
                  <p className="text-xs text-gray-500 mb-1">税费率备注</p>
                  <p className="font-semibold text-gray-800">{conflict.taxRateRemarkValue}</p>
                </div>
                <div className="bg-white rounded p-3 border">
                  <p className="text-xs text-gray-500 mb-1">柜台流水尾号</p>
                  <p className="font-semibold text-gray-800">{conflict.counterFlowTailValue}</p>
                </div>
              </div>
              <p className="text-sm text-red-700 mb-3">{conflict.conflictDescription}</p>
              {conflict.resolution === 'pending' && currentRole === 'research_assistant' ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => resolveConflict(conflict.id, 'confirmed', '小周')}
                    className="bg-teal-500 text-white px-4 py-2 rounded text-sm hover:bg-teal-600"
                  >
                    确认（以柜台流水尾号口径为准）
                  </button>
                  <button
                    onClick={() => resolveConflict(conflict.id, 'rejected', '小周')}
                    className="bg-amber-500 text-white px-4 py-2 rounded text-sm hover:bg-amber-600"
                  >
                    驳回（以税费率备注口径为准）
                  </button>
                </div>
              ) : conflict.resolution !== 'pending' ? (
                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded text-sm font-medium ${
                  conflict.resolution === 'confirmed' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {conflict.resolution === 'confirmed' ? <Check size={14} /> : <X size={14} />}
                  {conflict.resolution === 'confirmed' ? `已确认（以柜台流水尾号为准）by ${conflict.resolvedBy}` : `已驳回（以税费率备注为准）by ${conflict.resolvedBy}`}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">等待投研助理处理冲突</p>
              )}
            </div>
          ))}
        </section>
      )}

      {canCompleteAudit && (
        <section className="mb-6">
          <button
            onClick={() => completeAudit(id!)}
            className="w-full bg-navy-500 text-white py-3 rounded-lg font-semibold hover:bg-navy-600"
          >
            完成审计
          </button>
        </section>
      )}

      {record.status === 'completed' && (
        <div className="bg-teal-50 border border-teal-300 rounded-lg p-4 text-center text-teal-700 font-medium">
          ✓ 审计已完成，核算流程结束
        </div>
      )}
    </div>
  )
}

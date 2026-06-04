import { useMemo } from 'react'
import { FileDown, CheckCircle2, XCircle, RefreshCw, Download, ShieldCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { CHECK_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/types'
import type { CalibrationRecord, SelfCheckResult } from '@/types'

function CheckItem({ result }: { result: SelfCheckResult }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-steel-200 bg-white px-4 py-3">
      {result.passed ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-steel-900">
          {CHECK_TYPE_LABELS[result.checkType]}
        </p>
        <p className={`mt-0.5 text-xs ${result.passed ? 'text-steel-500' : 'text-red-600'}`}>
          {result.detail}
        </p>
      </div>
    </div>
  )
}

function SelfCheckSection() {
  const selfCheckResults = useStore((s) => s.selfCheckResults)
  const runSelfCheckNow = useStore((s) => s.runSelfCheckNow)
  const lastCheckedAt = selfCheckResults[0]?.checkedAt

  return (
    <section className="rounded-lg border border-steel-200 bg-steel-50/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-steel-900">
          <ShieldCheck className="h-5 w-5 text-amber" />
          自检报告
        </h2>
        <div className="flex items-center gap-3">
          {lastCheckedAt && (
            <span className="text-xs text-steel-500">
              上次检查: {new Date(lastCheckedAt).toLocaleString('zh-CN')}
            </span>
          )}
          <button
            onClick={runSelfCheckNow}
            className="flex items-center gap-1.5 rounded-md bg-amber px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重新自检
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {selfCheckResults.map((r) => (
          <CheckItem key={r.id} result={r} />
        ))}
      </div>
    </section>
  )
}

function RecordRow({ record }: { record: CalibrationRecord }) {
  return (
    <tr className="border-t border-steel-100 hover:bg-steel-50/60">
      <td className="px-3 py-2 font-mono text-xs text-steel-800">{record.batchNo}</td>
      <td className="px-3 py-2 font-mono text-xs text-steel-800">{record.sensorNo}</td>
      <td className="px-3 py-2 font-mono text-xs text-steel-800">{record.coefficient}</td>
      <td className="px-3 py-2 font-mono text-xs text-steel-800">
        {record.originalCoefficient ?? '-'}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-steel-800">
        {record.coefficientChangeReason ?? '-'}
      </td>
      <td className="px-3 py-2">
        <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[record.status]}`}>
          {STATUS_LABELS[record.status]}
        </span>
      </td>
    </tr>
  )
}

function ExportSection() {
  const getExportData = useStore((s) => s.getExportData)
  const exportData = useMemo(() => getExportData(), [getExportData])

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vacuum-pump-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="rounded-lg border border-steel-200 bg-steel-50/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-steel-900">
          <FileDown className="h-5 w-5 text-amber" />
          明细导出
        </h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-md bg-steel-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-steel-800"
        >
          <Download className="h-3.5 w-3.5" />
          导出 JSON
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-steel-200">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-steel-100/80">
              <th className="px-3 py-2 text-xs font-semibold text-steel-600">批次号</th>
              <th className="px-3 py-2 text-xs font-semibold text-steel-600">传感器号</th>
              <th className="px-3 py-2 text-xs font-semibold text-steel-600">系数</th>
              <th className="px-3 py-2 text-xs font-semibold text-steel-600">原始系数</th>
              <th className="px-3 py-2 text-xs font-semibold text-steel-600">改系数原因</th>
              <th className="px-3 py-2 text-xs font-semibold text-steel-600">状态</th>
            </tr>
          </thead>
          <tbody>
            {exportData.map((r) => (
              <RecordRow key={r.id} record={r} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-steel-500">
        导出数据与页面展示、接口返回读取同一数据源
      </p>
    </section>
  )
}

function ConsistencySection() {
  const records = useStore((s) => s.records)
  const getExportData = useStore((s) => s.getExportData)
  const getApiReturnData = useStore((s) => s.getApiReturnData)

  const exportData = useMemo(() => getExportData(), [getExportData])
  const apiData = useMemo(() => getApiReturnData(), [getApiReturnData])

  const allIds = useMemo(() => records.map((r) => r.id), [records])

  const comparison = useMemo(() => {
    return allIds.map((id) => {
      const page = records.find((r) => r.id === id)
      const exp = exportData.find((r) => r.id === id)
      const api = apiData.find((r) => r.id === id)
      const keyFields = ['batchNo', 'coefficient', 'originalCoefficient', 'coefficientChangeReason'] as const
      const match = keyFields.every(
        (f) => page?.[f] === exp?.[f] && exp?.[f] === api?.[f],
      )
      const flagged = page?.originalCoefficient !== null && page?.coefficientChangeReason === null
      return { id, page, exp, api, match, flagged }
    })
  }, [allIds, records, exportData, apiData])

  const allMatch = comparison.every((c) => c.match)

  const FieldVal = ({ value }: { value: string | number | null }) => (
    <span className="font-mono text-xs text-steel-800">{value ?? '-'}</span>
  )

  return (
    <section className="rounded-lg border border-steel-200 bg-steel-50/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-steel-900">
          <CheckCircle2 className="h-5 w-5 text-amber" />
          一致性校验
        </h2>
        {allMatch && (
          <span className="rounded-full bg-emerald px-3 py-1 text-xs font-semibold text-white">
            三端一致
          </span>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border border-steel-200">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-steel-100/80">
              <th className="px-3 py-2 text-xs font-semibold text-steel-600" rowSpan={2}>ID</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-steel-600" colSpan={3}>批次号</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-steel-600" colSpan={3}>系数</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-steel-600" colSpan={3}>原始系数</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-steel-600" colSpan={3}>改系数原因</th>
            </tr>
            <tr className="border-t border-steel-200 bg-steel-50/50">
              {[0, 1, 2].flatMap(() => [
                <th key="exp" className="px-2 py-1 text-center text-[10px] font-semibold text-steel-500">导出明细</th>,
                <th key="page" className="px-2 py-1 text-center text-[10px] font-semibold text-steel-500">页面展示</th>,
                <th key="api" className="px-2 py-1 text-center text-[10px] font-semibold text-steel-500">接口返回</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {comparison.map(({ id, page, exp, api, match, flagged }) => (
              <tr
                key={id}
                className={`border-t border-steel-100 ${
                  !match ? 'bg-red-50' : flagged ? 'bg-amber-50' : 'hover:bg-steel-50/60'
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs text-steel-700">{id}</td>
                <td className="px-2 py-2"><FieldVal value={exp?.batchNo} /></td>
                <td className="px-2 py-2"><FieldVal value={page?.batchNo} /></td>
                <td className="px-2 py-2"><FieldVal value={api?.batchNo} /></td>
                <td className="px-2 py-2"><FieldVal value={exp?.coefficient} /></td>
                <td className="px-2 py-2"><FieldVal value={page?.coefficient} /></td>
                <td className="px-2 py-2"><FieldVal value={api?.coefficient} /></td>
                <td className={`px-2 py-2 ${flagged ? 'font-bold' : ''}`}><FieldVal value={exp?.originalCoefficient} /></td>
                <td className={`px-2 py-2 ${flagged ? 'font-bold' : ''}`}><FieldVal value={page?.originalCoefficient} /></td>
                <td className={`px-2 py-2 ${flagged ? 'font-bold' : ''}`}><FieldVal value={api?.originalCoefficient} /></td>
                <td className={`px-2 py-2 ${flagged ? 'font-bold' : ''}`}><FieldVal value={exp?.coefficientChangeReason} /></td>
                <td className={`px-2 py-2 ${flagged ? 'font-bold' : ''}`}><FieldVal value={page?.coefficientChangeReason} /></td>
                <td className={`px-2 py-2 ${flagged ? 'font-bold' : ''}`}><FieldVal value={api?.coefficientChangeReason} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!allMatch && (
        <p className="mt-3 text-xs text-red-600">存在三端数据不一致的记录，请检查</p>
      )}
      {comparison.some((c) => c.flagged) && (
        <p className="mt-2 text-xs text-amber">
          黄色高亮行：人工改系数但未填写原因，三端应保持一致显示
        </p>
      )}
    </section>
  )
}

export default function ExportPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 font-sans">
      <SelfCheckSection />
      <ExportSection />
      <ConsistencySection />
    </div>
  )
}

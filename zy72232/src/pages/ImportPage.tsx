import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle, ArrowRight } from 'lucide-react'
import { useLedgerStore } from '@/store/useLedgerStore'

interface ImportResult {
  normalCount: number
  inconsistentCount: number
  inconsistentRecords: { trade_no: string; source1: string; source2: string }[]
}

export default function ImportPage() {
  const navigate = useNavigate()
  const { importRecords, loading } = useLedgerStore()
  const [jsonText, setJsonText] = useState('')
  const [operator, setOperator] = useState('阿芬')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleImport = async () => {
    setError(null)
    setResult(null)

    let parsed: Record<string, unknown>[]
    try {
      const data = JSON.parse(jsonText)
      if (!Array.isArray(data)) {
        setError('JSON 数据必须是一个数组')
        return
      }
      parsed = data
    } catch {
      setError('JSON 格式解析失败，请检查数据格式')
      return
    }

    try {
      await importRecords(parsed, operator || undefined)

      let normalCount = 0
      let inconsistentCount = 0
      const inconsistentRecords: ImportResult['inconsistentRecords'] = []

      for (const item of parsed) {
        const rec = item as Record<string, any>
        const s1 = rec.institution_name_source1 || ''
        const s2 = rec.institution_name_source2 || ''
        if (s1 !== s2) {
          inconsistentCount++
          inconsistentRecords.push({ trade_no: rec.trade_no || '未知', source1: s1, source2: s2 })
        } else {
          normalCount++
        }
      }

      setResult({ normalCount, inconsistentCount, inconsistentRecords })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '导入失败，请稍后重试'
      setError(msg)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-full py-10">
      <div
        className="w-full max-w-2xl rounded-xl p-8"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          数据导入
        </h1>

        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              粘贴 JSON 数据
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={12}
              className="w-full rounded-lg px-4 py-3 text-sm font-mono resize-y outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
              placeholder={`[\n  {\n    "trade_no": "TX-2024-004",\n    "institution_name_source1": "招商证券",\n    "institution_name_source2": "招商证券",\n    "ex_rights_date": "2024-12-18",\n    "extension_date": "2025-03-18",\n    "tax_rate": 3.20\n  }\n]`}
            />
          </div>

          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              操作人（可选）
            </label>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
              placeholder="阿芬"
            />
          </div>

          {error && (
            <div
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
              style={{ backgroundColor: 'var(--red-bg)', color: 'var(--red)' }}
            >
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {!result && (
            <button
              onClick={handleImport}
              disabled={loading || !jsonText.trim()}
              className="rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--blue)',
                color: '#fff',
                opacity: loading || !jsonText.trim() ? 0.5 : 1,
                cursor: loading || !jsonText.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '导入中...' : '导入'}
            </button>
          )}

          {result && (
            <div className="flex flex-col gap-4">
              <div
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
                style={{ backgroundColor: 'var(--green-bg)', color: 'var(--green)' }}
              >
                <CheckCircle size={16} />
                导入完成：{result.normalCount} 条正常，{result.inconsistentCount} 条不一致
              </div>

              {result.inconsistentRecords.length > 0 && (
                <div
                  className="rounded-lg p-4"
                  style={{ backgroundColor: 'var(--orange-bg)', border: '1px solid var(--orange)' }}
                >
                  <div className="text-sm font-medium mb-3" style={{ color: 'var(--orange)' }}>
                    不一致记录：
                  </div>
                  <div className="flex flex-col gap-2">
                    {result.inconsistentRecords.map((rec, i) => (
                      <div
                        key={i}
                        className="rounded px-3 py-2 text-sm font-mono"
                        style={{ backgroundColor: 'rgba(255, 145, 0, 0.15)' }}
                      >
                        <span style={{ color: 'var(--orange)' }}>{rec.trade_no}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {' '}— 来源1: <span style={{ color: 'var(--red)' }}>{rec.source1}</span> | 来源2: <span style={{ color: 'var(--red)' }}>{rec.source2}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 self-start rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
                style={{ backgroundColor: 'var(--green)', color: '#fff' }}
              >
                前往台账主页
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

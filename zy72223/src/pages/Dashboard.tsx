import { useState, useEffect, useCallback } from 'react'
import { Upload, FileUp, Play } from 'lucide-react'
import { useStore, type Entry } from '@/store'
import ProgressSteps from '@/components/ProgressSteps'
import EntryTable from '@/components/EntryTable'
import NoteEditor from '@/components/NoteEditor'
import CorrectionModal from '@/components/CorrectionModal'
import ReviewModal from '@/components/ReviewModal'

const DEMO_DATA = {
  name: '2024年3月除权日结算单',
  source: 'upload',
  entries: [
    { tradeDate: '2024-03-15', exDividendDate: '2024-03-18', securityCode: '600519', securityName: '贵州茅台', amount: 0, note: '已冲正' },
    { tradeDate: '2024-03-15', exDividendDate: '2024-03-18', securityCode: '000858', securityName: '五粮液', amount: 12500.00, note: '除权派息' },
    { tradeDate: '2024-03-15', exDividendDate: '2024-03-19', securityCode: '601318', securityName: '中国平安', amount: 0, note: '已冲正' },
    { tradeDate: '2024-03-16', exDividendDate: '2024-03-20', securityCode: '600036', securityName: '招商银行', amount: 8300.50, note: '分红到账' },
    { tradeDate: '2024-03-16', exDividendDate: null, securityCode: '000001', securityName: '平安银行', amount: 4500.00, note: '利息收入' },
  ],
}

export default function Dashboard() {
  const {
    settlements,
    entries,
    currentSettlementId,
    fetchSettlements,
    fetchEntries,
    importSettlement,
    setCurrentSettlementId,
  } = useStore()

  const [noteEntry, setNoteEntry] = useState<Entry | null>(null)
  const [correctEntry, setCorrectEntry] = useState<Entry | null>(null)
  const [reviewEntry, setReviewEntry] = useState<Entry | null>(null)
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    fetchSettlements()
    fetchEntries()
  }, [fetchSettlements, fetchEntries])

  const currentSettlement = settlements.find((s) => s.id === currentSettlementId) || settlements[0] || null
  const filteredEntries = currentSettlement
    ? entries.filter((e) => e.settlementId === currentSettlement.id)
    : entries

  const handleDemoImport = useCallback(async () => {
    await importSettlement(DEMO_DATA)
  }, [importSettlement])

  const handleImport = useCallback(async () => {
    if (!importText.trim()) return
    try {
      const parsed = JSON.parse(importText)
      await importSettlement({
        name: parsed.name || '手动导入结算单',
        source: 'upload',
        entries: parsed.entries || [],
      })
      setImportText('')
      setShowImport(false)
    } catch {
      alert('JSON 格式不正确，请检查输入')
    }
  }, [importText, importSettlement])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-semibold text-ledger-text">结算单拆解看板</h1>
        <button
          onClick={() => setShowImport(!showImport)}
          className="flex items-center gap-2 rounded-lg bg-ledger-amber text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-ledger-amber/90 transition-colors"
        >
          <Upload className="w-4 h-4" />
          导入结算单
        </button>
      </div>

      {currentSettlement && (
        <div className="bg-white rounded-xl border border-ledger-border p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <select
                value={currentSettlement.id}
                onChange={(e) => setCurrentSettlementId(e.target.value)}
                className="rounded-lg border border-ledger-border px-3 py-1.5 text-sm text-ledger-text focus:outline-none focus:ring-2 focus:ring-ledger-amber/30"
              >
                {settlements.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <span className="text-xs text-ledger-muted font-mono">
                {new Date(currentSettlement.importedAt).toLocaleString('zh-CN')}
              </span>
            </div>
          </div>
          <ProgressSteps status={currentSettlement.status} />
        </div>
      )}

      {showImport && (
        <div className="bg-white rounded-xl border border-ledger-border p-5 shadow-sm space-y-4">
          <h3 className="font-serif font-semibold text-ledger-text">导入结算单数据</h3>

          <div className="border-2 border-dashed border-ledger-border rounded-lg p-8 text-center hover:border-ledger-amber/50 transition-colors">
            <FileUp className="w-8 h-8 text-ledger-muted mx-auto mb-2" />
            <p className="text-sm text-ledger-muted mb-3">粘贴 JSON 数据或使用演示数据</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-ledger-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ledger-amber/30 focus:border-ledger-amber resize-none mb-3"
              placeholder='{"name": "结算单名称", "entries": [{...}]}'
            />
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleImport}
                disabled={!importText.trim()}
                className="flex items-center gap-2 rounded-lg bg-ledger-amber text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-ledger-amber/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                导入
              </button>
              <button
                onClick={handleDemoImport}
                className="flex items-center gap-2 rounded-lg border border-ledger-border text-ledger-text px-4 py-2 text-sm font-medium hover:bg-ledger-bg transition-colors"
              >
                <Play className="w-4 h-4" />
                加载演示数据
              </button>
            </div>
          </div>
        </div>
      )}

      <EntryTable
        entries={filteredEntries}
        onNote={setNoteEntry}
        onReview={setReviewEntry}
        onCorrect={setCorrectEntry}
      />

      <NoteEditor entry={noteEntry} onClose={() => setNoteEntry(null)} />
      <CorrectionModal entry={correctEntry} onClose={() => setCorrectEntry(null)} />
      <ReviewModal entry={reviewEntry} onClose={() => setReviewEntry(null)} />
    </div>
  )
}

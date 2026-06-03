import { useState, useEffect } from 'react'
import { useStore, type Entry } from '@/store'
import EntryTable from '@/components/EntryTable'
import NoteEditor from '@/components/NoteEditor'
import CorrectionModal from '@/components/CorrectionModal'
import ReviewModal from '@/components/ReviewModal'

export default function Notes() {
  const { entries, fetchEntries } = useStore()
  const [noteEntry, setNoteEntry] = useState<Entry | null>(null)
  const [correctEntry, setCorrectEntry] = useState<Entry | null>(null)
  const [reviewEntry, setReviewEntry] = useState<Entry | null>(null)

  useEffect(() => {
    fetchEntries('pending_review')
  }, [fetchEntries])

  const needNotes = entries.filter(
    (e) => e.status === 'pending_review' && e.taxRate == null
  )
  const needReview = entries.filter(
    (e) => e.status === 'pending_review' && e.taxRate != null
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold text-ledger-text">税费率备注补录</h1>
        <p className="text-sm text-ledger-muted mt-1">
          待补录 <strong className="text-ledger-amber">{needNotes.length}</strong> 条 ·
          待复核 <strong className="text-blue-500">{needReview.length}</strong> 条
        </p>
      </div>

      <div className="space-y-6">
        {needNotes.length > 0 && (
          <div>
            <h2 className="text-base font-medium text-ledger-text mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ledger-amber" />
              待补录税费率
            </h2>
            <EntryTable
              entries={needNotes}
              onNote={setNoteEntry}
              onReview={setReviewEntry}
              onCorrect={setCorrectEntry}
            />
          </div>
        )}

        {needReview.length > 0 && (
          <div>
            <h2 className="text-base font-medium text-ledger-text mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              待风控复核
            </h2>
            <EntryTable
              entries={needReview}
              onNote={setNoteEntry}
              onReview={setReviewEntry}
              onCorrect={setCorrectEntry}
            />
          </div>
        )}

        {needNotes.length === 0 && needReview.length === 0 && (
          <div className="text-center py-12 text-ledger-muted text-sm">
            所有条目已完成补录和复核
          </div>
        )}
      </div>

      <NoteEditor entry={noteEntry} onClose={() => setNoteEntry(null)} />
      <CorrectionModal entry={correctEntry} onClose={() => setCorrectEntry(null)} />
      <ReviewModal entry={reviewEntry} onClose={() => setReviewEntry(null)} />
    </div>
  )
}

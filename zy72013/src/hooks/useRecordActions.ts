import { useRecordStore } from '@/store/recordStore'

export function useRecordActions() {
  const rejudgeRecord = useRecordStore((s) => s.rejudge)
  const rollbackRecord = useRecordStore((s) => s.rollback)
  const supplementRecord = useRecordStore((s) => s.supplement)
  const exportCsv = useRecordStore((s) => s.exportCsv)

  return {
    rejudgeRecord,
    rollbackRecord,
    supplementRecord,
    exportCsv,
  }
}

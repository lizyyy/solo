import { useEffect } from 'react'
import ConflictAlert from '@/components/alias/ConflictAlert'
import AliasTable from '@/components/alias/AliasTable'
import AliasMergeModal from '@/components/alias/AliasMergeModal'
import { useLineageStore } from '@/store/useLineageStore'
import { useAliasStore } from '@/store/useAliasStore'

export default function AliasPage() {
  const aliases = useLineageStore((s) => s.aliases)
  const detectConflicts = useAliasStore((s) => s.detectConflicts)
  const refreshGroups = useAliasStore((s) => s.refreshGroups)

  useEffect(() => {
    detectConflicts(aliases)
    refreshGroups(aliases)
  }, [aliases, detectConflicts, refreshGroups])

  return (
    <div className="h-full overflow-auto p-6">
      <ConflictAlert />
      <AliasTable />
      <AliasMergeModal />
    </div>
  )
}

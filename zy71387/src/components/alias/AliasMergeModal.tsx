import { useAliasStore } from '@/store/useAliasStore'
import { useLineageStore } from '@/store/useLineageStore'

export default function AliasMergeModal() {
  const showMergeModal = useAliasStore((s) => s.showMergeModal)
  const mergeSourceId = useAliasStore((s) => s.mergeSourceId)
  const mergeTargetId = useAliasStore((s) => s.mergeTargetId)
  const mergeAliasIds = useAliasStore((s) => s.mergeAliasIds)
  const cancelMerge = useAliasStore((s) => s.cancelMerge)
  const executeMerge = useAliasStore((s) => s.executeMerge)
  const startMerge = useAliasStore((s) => s.startMerge)
  const aliases = useLineageStore((s) => s.aliases)
  const nodes = useLineageStore((s) => s.nodes)
  const setAliases = useLineageStore.setState

  if (!showMergeModal) return null

  const sourceNode = nodes.find((n) => n.id === mergeSourceId)
  const fieldNodes = nodes.filter((n) => n.type === 'field' && n.id !== mergeSourceId)
  const movingAliases = aliases.filter((a) => mergeAliasIds.includes(a.id))

  const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (mergeSourceId) {
      startMerge(mergeSourceId, e.target.value, mergeAliasIds)
    }
  }

  const handleConfirmMerge = () => {
    if (!mergeTargetId) return
    const updatedAliases = executeMerge(aliases)
    setAliases({ aliases: updatedAliases })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-[500px] bg-base-800 border border-base-600 rounded-lg p-5">
        <h2 className="font-mono text-lg text-white mb-4">合并别名</h2>
        <div className="space-y-4">
          <p className="text-muted text-sm">将以下别名从源字段移动到目标字段</p>

          <div>
            <label className="block text-xs text-muted mb-1">源字段</label>
            <div className="bg-base-700 border border-base-600 rounded px-3 py-2 text-white font-mono text-sm">
              {sourceNode?.label || '-'}
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">目标字段</label>
            <select
              value={mergeTargetId || ''}
              onChange={handleTargetChange}
              className="w-full bg-base-700 border border-base-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
            >
              <option value="">请选择目标字段</option>
              {fieldNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted mb-2">待移动的别名</label>
            <div className="bg-base-700 border border-base-600 rounded p-3">
              {movingAliases.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {movingAliases.map((alias) => (
                    <span
                      key={alias.id}
                      className="bg-base-600 px-2 py-1 rounded text-xs font-mono text-white"
                    >
                      {alias.aliasName}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-muted text-sm">无别名</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={cancelMerge}
            className="px-4 py-2 bg-base-700 hover:bg-base-600 text-white rounded text-sm transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirmMerge}
            disabled={!mergeTargetId}
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-base-900 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认合并
          </button>
        </div>
      </div>
    </div>
  )
}

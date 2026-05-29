import { useCallback } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import { useLineageStore } from '@/store/useLineageStore'
import { getConnectedNodeIds } from '@/engine/lineageTracker'
import LineageGraph from '@/components/lineage/LineageGraph'
import NodeDetailDrawer from '@/components/lineage/NodeDetailDrawer'

export default function LineagePage() {
  const nodes = useLineageStore((s) => s.nodes)
  const edges = useLineageStore((s) => s.edges)
  const searchQuery = useLineageStore((s) => s.searchQuery)
  const setSearchQuery = useLineageStore((s) => s.setSearchQuery)
  const setHighlightedNodes = useLineageStore((s) => s.setHighlightedNodes)

  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q)
      if (!q.trim()) { setHighlightedNodes(new Set()); return }
      const lower = q.toLowerCase()
      const matched = nodes.filter(
        (n) => n.label.toLowerCase().includes(lower) || n.aliases.some((a) => a.toLowerCase().includes(lower))
      )
      const ids = new Set<string>()
      for (const n of matched) {
        ids.add(n.id)
        for (const cid of getConnectedNodeIds(n.id, edges, 2)) ids.add(cid)
      }
      setHighlightedNodes(ids)
    },
    [nodes, edges, setSearchQuery, setHighlightedNodes]
  )

  return (
    <div className="h-screen flex flex-col bg-base-900 font-sans">
      <div className="flex items-center gap-3 px-4 py-3 bg-base-800 border-b border-base-600 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索字段名/别名..."
            className="w-full bg-base-700 border border-base-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event('resize'))}
          className="flex items-center gap-1.5 px-3 py-2 bg-base-700 hover:bg-base-600 border border-base-600 rounded-lg text-sm text-gray-300 transition-colors"
        >
          <RefreshCw size={14} /> 刷新布局
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <LineageGraph />
        <NodeDetailDrawer />
      </div>
    </div>
  )
}

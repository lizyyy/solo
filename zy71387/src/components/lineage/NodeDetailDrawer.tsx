import { X, Database, ArrowRightLeft, FileBarChart, Globe, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react'
import { useLineageStore } from '@/store/useLineageStore'
import { findUpstream, findDownstream } from '@/engine/lineageTracker'

const TYPE_ICON: Record<string, React.ReactNode> = {
  field: <Database size={14} />,
  etl: <ArrowRightLeft size={14} />,
  report: <FileBarChart size={14} />,
  api: <Globe size={14} />,
}
const TYPE_COLOR: Record<string, string> = {
  field: 'bg-accent/20 text-accent',
  etl: 'bg-safe/20 text-safe',
  report: 'bg-warn/20 text-warn',
  api: 'bg-purple-500/20 text-purple-400',
}
const STATUS_COLOR: Record<string, string> = {
  active: 'bg-safe/20 text-safe',
  changed: 'bg-accent/20 text-accent',
  broken: 'bg-danger/20 text-danger',
  unregistered: 'bg-warn/20 text-warn',
}

export default function NodeDetailDrawer() {
  const selectedNodeId = useLineageStore((s) => s.selectedNodeId)
  const nodes = useLineageStore((s) => s.nodes)
  const edges = useLineageStore((s) => s.edges)
  const setSelectedNode = useLineageStore((s) => s.setSelectedNode)

  const node = nodes.find((n) => n.id === selectedNodeId)
  const upstream = node ? findUpstream(node.id, nodes, edges) : []
  const downstream = node ? findDownstream(node.id, nodes, edges) : []

  const uniqueUp = [...new Map(upstream.map((u) => [u.node.id, u.node])).values()]
  const uniqueDown = [...new Map(downstream.map((d) => [d.node.id, d.node])).values()]

  return (
    <div
      className={`fixed top-0 right-0 h-full w-96 bg-base-800 border-l border-base-600 z-50 overflow-y-auto
        transition-transform duration-300 ease-in-out font-sans
        ${node ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {node && (
        <div className="p-5 space-y-5">
          <div className="flex items-start justify-between">
            <h2 className="font-mono text-lg text-accent leading-tight break-all pr-4">{node.label}</h2>
            <button onClick={() => setSelectedNode(null)} className="text-muted hover:text-white shrink-0">
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${TYPE_COLOR[node.type]}`}>
              {TYPE_ICON[node.type]} {node.type.toUpperCase()}
            </span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLOR[node.status] || 'bg-base-600 text-muted'}`}>
              {node.status}
            </span>
          </div>

          {node.type === 'field' && node.metadata?.table && (
            <div className="text-sm">
              <span className="text-muted">表名: </span>
              <span className="text-white font-mono">{String(node.metadata.table)}</span>
            </div>
          )}

          {node.isHidden && (
            <div className="bg-danger-glow text-danger px-3 py-2 rounded text-sm font-medium flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>该字段已隐藏，相关链路可能中断</span>
            </div>
          )}

          {node.aliases.length > 0 && (
            <div>
              <h3 className="text-muted text-xs uppercase tracking-wider mb-2">别名</h3>
              <div className="flex flex-wrap gap-1.5">
                {node.aliases.map((a) => (
                  <span key={a} className="bg-base-600 rounded px-2 py-1 text-sm text-gray-300 font-mono">{a}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-muted text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
              <ArrowUp size={12} /> 上游节点 ({uniqueUp.length})
            </h3>
            {uniqueUp.length === 0 ? <p className="text-sm text-muted/60">无上游节点</p> : (
              <ul className="space-y-1">
                {uniqueUp.map((n) => (
                  <li key={n.id} className="flex items-center gap-2 text-sm text-gray-300 hover:text-accent cursor-pointer" onClick={() => setSelectedNode(n.id)}>
                    {TYPE_ICON[n.type]} <span className="font-mono truncate">{n.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-muted text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
              <ArrowDown size={12} /> 下游节点 ({uniqueDown.length})
            </h3>
            {uniqueDown.length === 0 ? <p className="text-sm text-muted/60">无下游节点</p> : (
              <ul className="space-y-1">
                {uniqueDown.map((n) => (
                  <li key={n.id} className="flex items-center gap-2 text-sm text-gray-300 hover:text-accent cursor-pointer" onClick={() => setSelectedNode(n.id)}>
                    {TYPE_ICON[n.type]} <span className="font-mono truncate">{n.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {Object.keys(node.metadata).length > 0 && (
            <div>
              <h3 className="text-muted text-xs uppercase tracking-wider mb-2">元数据</h3>
              <div className="bg-base-900 rounded p-3 space-y-1.5">
                {Object.entries(node.metadata).map(([k, v]) => (
                  <div key={k} className="flex text-sm">
                    <span className="text-muted font-mono shrink-0 mr-2">{k}:</span>
                    <span className="text-gray-300 font-mono break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

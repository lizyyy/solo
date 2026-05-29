import { useState } from 'react'
import { X, Plus, Merge } from 'lucide-react'
import { useLineageStore } from '@/store/useLineageStore'
import { useAliasStore } from '@/store/useAliasStore'
import type { FieldAlias, LineageNode } from '@/types'

function FieldRow({ node, fieldAliases }: { node: LineageNode; fieldAliases: FieldAlias[] }) {
  const [newAliasName, setNewAliasName] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)
  const removeAlias = useLineageStore((s) => s.removeAlias)
  const addAlias = useLineageStore((s) => s.addAlias)
  const startMerge = useAliasStore((s) => s.startMerge)

  const hasConflict = fieldAliases.some((a) => a.isConflict)

  const handleRemoveAlias = (aliasId: string) => {
    removeAlias(aliasId)
  }

  const handleAddAlias = () => {
    if (!newAliasName.trim()) return
    const newAlias: FieldAlias = {
      id: `alias-${Date.now()}`,
      fieldId: node.id,
      aliasName: newAliasName.trim(),
      source: 'manual',
      isConflict: false,
    }
    addAlias(newAlias)
    setNewAliasName('')
    setShowAddInput(false)
  }

  const handleMerge = () => {
    const aliasIds = fieldAliases.map((a) => a.id)
    startMerge(node.id, '', aliasIds)
  }

  const sources = fieldAliases.map((a) => a.source).filter(Boolean)

  return (
    <tr
      data-field-id={node.id}
      className={`border-t border-base-600 ${hasConflict ? 'bg-danger-glow/40' : ''}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-white">{node.label}</span>
          {node.isHidden && (
            <span className="text-xs bg-danger-glow text-danger px-2 py-0.5 rounded">
              隐藏字段
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center">
          {fieldAliases.map((alias) => (
            <span
              key={alias.id}
              className="bg-base-600 hover:bg-base-500 rounded px-2 py-1 text-xs font-mono mr-1 mb-1 inline-flex items-center gap-1"
            >
              {alias.aliasName}
              <button
                onClick={() => handleRemoveAlias(alias.id)}
                className="hover:text-danger transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {showAddInput ? (
            <div className="flex items-center gap-1 mr-1 mb-1">
              <input
                type="text"
                value={newAliasName}
                onChange={(e) => setNewAliasName(e.target.value)}
                placeholder="输入别名"
                className="bg-base-700 border border-base-500 rounded px-2 py-1 text-xs text-white w-24 focus:outline-none focus:border-accent"
                onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
                autoFocus
              />
              <button
                onClick={handleAddAlias}
                className="bg-accent text-base-900 px-2 py-1 rounded text-xs font-medium hover:bg-accent/90"
              >
                添加
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddInput(true)}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-white px-2 py-1 border border-dashed border-base-500 rounded mr-1 mb-1"
            >
              <Plus className="w-3 h-3" />
              添加别名
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted">
        {sources.length > 0 ? sources.join(', ') : '-'}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={handleMerge}
          className="inline-flex items-center gap-1 text-xs bg-base-600 hover:bg-base-500 text-white px-3 py-1.5 rounded transition-colors"
        >
          <Merge className="w-3.5 h-3.5" />
          合并
        </button>
      </td>
    </tr>
  )
}

export default function AliasTable() {
  const nodes = useLineageStore((s) => s.nodes)
  const groupedAliases = useAliasStore((s) => s.groupedAliases)

  const fieldNodes = nodes.filter((n) => n.type === 'field')

  return (
    <div className="w-full bg-base-800 rounded border border-base-600 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-base-700 text-muted text-xs uppercase tracking-wider">
            <th className="px-4 py-3 text-left font-medium">主字段</th>
            <th className="px-4 py-3 text-left font-medium">别名</th>
            <th className="px-4 py-3 text-left font-medium">来源</th>
            <th className="px-4 py-3 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {fieldNodes.map((node) => {
            const fieldAliases = groupedAliases.get(node.id) || []
            return <FieldRow key={node.id} node={node} fieldAliases={fieldAliases} />
          })}
        </tbody>
      </table>
    </div>
  )
}

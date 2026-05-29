import { useStore } from '@/store'
import { Plus, Link2, HelpCircle } from 'lucide-react'
import { useState } from 'react'

export default function InterfaceMappingPanel({ clusterId }: { clusterId: string }) {
  const mappings = useStore((s) => s.interfaceMappings)
  const updateInterfaceMapping = useStore((s) => s.updateInterfaceMapping)
  const addToast = useStore((s) => s.addToast)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const clusterMappings = mappings.filter((m) => m.cluster_id === clusterId)

  const handleAdd = () => {
    if (!newName.trim()) return
    updateInterfaceMapping(clusterId, newName.trim())
    addToast(`接口 ${newName.trim()} 已关联`, 'success')
    setNewName('')
    setAdding(false)
  }

  return (
    <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e2a36]">
        <h3 className="text-xs font-semibold text-[#a0b3c6] uppercase tracking-wider">
          接口关联
        </h3>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          {clusterMappings.map((m) => {
            if (m.interface_name && m.mapping_source !== 'none') {
              const sourceLabel = {
                log_annotation: '日志标注',
                trace_mapping: '调用链',
                manual: '手动',
              }[m.mapping_source]

              return (
                <span
                  key={m.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-['JetBrains_Mono'] ${
                    m.is_inferred
                      ? 'bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/20'
                      : 'bg-[#00D9A6]/10 text-[#00D9A6] border border-[#00D9A6]/20'
                  }`}
                >
                  {m.is_inferred ? <HelpCircle className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                  {m.interface_name}
                  <span className="text-[9px] opacity-60 ml-0.5">{sourceLabel}</span>
                </span>
              )
            }

            return (
              <button
                key={m.id}
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border-2 border-dashed border-[#E74C3C]/40 text-[#E74C3C] hover:bg-[#E74C3C]/10 transition-colors"
              >
                <Plus className="w-3 h-3" />
                需补充接口名
              </button>
            )
          })}
        </div>

        {adding && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="/api/example"
              className="flex-1 bg-[#0a0e12] border border-[#1e2a36] rounded px-3 py-1.5 text-xs font-['JetBrains_Mono'] text-[#c8d6e5] focus:border-[#00D9A6] focus:outline-none transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 rounded text-[11px] bg-[#00D9A6] text-[#0F1419] font-medium hover:bg-[#00D9A6]/80 transition-colors"
            >
              关联
            </button>
            <button
              onClick={() => { setAdding(false); setNewName('') }}
              className="px-3 py-1.5 rounded text-[11px] text-[#6b7f94] hover:text-white transition-colors"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

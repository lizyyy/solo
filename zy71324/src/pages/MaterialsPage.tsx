import { useMemo } from 'react'
import { Plus, AlertTriangle } from 'lucide-react'
import { useMaterialStore } from '@/store/materialStore'
import { validateAllMaterials } from '@/utils/validation'
import MaterialCard from '@/components/MaterialCard'
import MaterialForm from '@/components/MaterialForm'
import GapPanel from '@/components/GapPanel'

export default function MaterialsPage() {
  const materials = useMaterialStore((s) => s.materials)
  const editingMaterial = useMaterialStore((s) => s.editingMaterial)
  const isFormOpen = useMaterialStore((s) => s.isFormOpen)
  const gapPanelOpen = useMaterialStore((s) => s.gapPanelOpen)
  const addMaterial = useMaterialStore((s) => s.addMaterial)
  const updateMaterial = useMaterialStore((s) => s.updateMaterial)
  const removeMaterial = useMaterialStore((s) => s.removeMaterial)
  const setEditingMaterial = useMaterialStore((s) => s.setEditingMaterial)
  const setIsFormOpen = useMaterialStore((s) => s.setIsFormOpen)
  const setGapPanelOpen = useMaterialStore((s) => s.setGapPanelOpen)

  const issues = useMemo(() => validateAllMaterials(materials), [materials])

  const handleEdit = (material: Parameters<typeof setEditingMaterial>[0]) => {
    setEditingMaterial(material)
  }

  const handleDelete = (id: string) => {
    if (confirm('确定删除该材料？')) removeMaterial(id)
  }

  const handleSave = (material: Parameters<typeof addMaterial>[0]) => {
    const existing = materials.find((m) => m.id === material.id)
    if (existing) {
      updateMaterial(material.id, material)
    } else {
      addMaterial(material)
    }
    setIsFormOpen(false)
    setEditingMaterial(null)
  }

  const handleNavigate = (materialId: string) => {
    const el = document.getElementById(materialId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="min-h-screen bg-[#1a2f2a] p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">材料数据库</h1>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setEditingMaterial(null)
                setIsFormOpen(true)
              }}
              className="flex items-center gap-1.5 rounded bg-[#e8a838] px-4 py-2 text-sm font-semibold text-[#1a2f2a] hover:bg-[#d4952e] transition"
            >
              <Plus size={16} />
              添加材料
            </button>
            <button
              onClick={() => setGapPanelOpen(!gapPanelOpen)}
              className="flex items-center gap-1.5 rounded border border-[#2a4a40] px-4 py-2 text-sm text-gray-300 hover:bg-[#2a4a40] transition"
            >
              <AlertTriangle size={16} />
              缺口识别
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => (
            <div key={m.id} id={m.id}>
              <MaterialCard
                material={m}
                issues={issues}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>

        {materials.length === 0 && (
          <p className="mt-16 text-center text-gray-500">暂无材料，点击上方按钮添加</p>
        )}
      </div>

      {isFormOpen && (
        <MaterialForm
          material={editingMaterial}
          onSave={handleSave}
          onCancel={() => {
            setIsFormOpen(false)
            setEditingMaterial(null)
          }}
        />
      )}

      <GapPanel
        issues={issues}
        isOpen={gapPanelOpen}
        onClose={() => setGapPanelOpen(false)}
        onNavigate={handleNavigate}
      />
    </div>
  )
}

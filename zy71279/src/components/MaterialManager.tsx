import React, { useState } from 'react';
import { Plus, Edit2, Trash2, AlertTriangle, Check, X } from 'lucide-react';
import type { Material } from '@/types';

interface MaterialManagerProps {
  materials: Material[];
  selectedMaterialId: string | null;
  onSelect: (material: Material) => void;
  onAdd: (material: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'isDuplicateWarning'>) => Promise<Material | void>;
  onUpdate: (id: string, updates: Partial<Material>) => Promise<Material | undefined | void>;
  onDelete: (id: string) => Promise<void>;
}

const materialTypes = ['PLA', 'ABS', 'PETG', 'TPU', '树脂', '金属', '其他'];

export const MaterialManager: React.FC<MaterialManagerProps> = ({
  materials,
  selectedMaterialId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'PLA' as string,
    density: 1.24,
    costPerGram: 0.1,
    printSpeed: 50,
    nozzleTemp: 200,
    bedTemp: 60
  });

  const duplicateCodes = materials.filter(m => m.isDuplicateWarning).map(m => m.code);

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'PLA',
      density: 1.24,
      costPerGram: 0.1,
      printSpeed: 50,
      nozzleTemp: 200,
      bedTemp: 60
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      await onUpdate(editingId, formData);
    } else {
      await onAdd(formData);
    }
    resetForm();
  };

  const startEdit = (material: Material) => {
    setFormData({
      code: material.code,
      name: material.name,
      type: material.type,
      density: material.density,
      costPerGram: material.costPerGram,
      printSpeed: material.printSpeed,
      nozzleTemp: material.nozzleTemp,
      bedTemp: material.bedTemp
    });
    setEditingId(material.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">材料库</h3>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加材料
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-blue-800">
              {editingId ? '编辑材料' : '添加新材料'}
            </h4>
            <button
              onClick={resetForm}
              className="p-1 hover:bg-blue-100 rounded transition-colors"
            >
              <X className="w-4 h-4 text-blue-600" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">材料编号 *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="如: PLA-001"
                required
              />
              {duplicateCodes.includes(formData.code) && !editingId && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  该编号已存在，将标记为重复
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">材料名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="如: 通用PLA"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">材料类型</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {materialTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">密度 (g/cm³)</label>
              <input
                type="number"
                step="0.01"
                value={formData.density}
                onChange={(e) => setFormData({ ...formData, density: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">成本 (元/g)</label>
              <input
                type="number"
                step="0.01"
                value={formData.costPerGram}
                onChange={(e) => setFormData({ ...formData, costPerGram: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">打印速度 (mm/s)</label>
              <input
                type="number"
                step="5"
                value={formData.printSpeed}
                onChange={(e) => setFormData({ ...formData, printSpeed: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">喷嘴温度 (°C)</label>
              <input
                type="number"
                step="5"
                value={formData.nozzleTemp}
                onChange={(e) => setFormData({ ...formData, nozzleTemp: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">热床温度 (°C)</label>
              <input
                type="number"
                step="5"
                value={formData.bedTemp}
                onChange={(e) => setFormData({ ...formData, bedTemp: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {editingId ? '保存修改' : '添加材料'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-2">
        {materials.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">暂无材料，请先添加</p>
          </div>
        ) : (
          materials.map((material) => (
            <div
              key={material.id}
              onClick={() => onSelect(material)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedMaterialId === material.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${material.isDuplicateWarning ? 'ring-2 ring-amber-400 ring-opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{material.name}</span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-mono">
                      {material.code}
                    </span>
                    {material.isDuplicateWarning && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        编号重复
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{material.type}</span>
                    <span>密度: {material.density} g/cm³</span>
                    <span>¥{material.costPerGram}/g</span>
                    <span>{material.printSpeed} mm/s</span>
                    <span>{material.nozzleTemp}°C / {material.bedTemp}°C</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(material); }}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(material.id); }}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

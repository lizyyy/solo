import { Plus, Upload, Database } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { MaterialCard } from './MaterialCard';
import { useState, useMemo } from 'react';
import { ImportDialog } from './ImportDialog';
import { AddMaterialDialog } from './AddMaterialDialog';
import { detectExceptions } from '@/utils/traceEngine';

export function MaterialList() {
  const materials = useStore((state) => state.materials);
  const records = useStore((state) => state.records);
  const filters = useStore((state) => state.filters);
  const selectedMaterialId = useStore((state) => state.selectedMaterialId);
  const selectMaterial = useStore((state) => state.selectMaterial);
  const resetToMockData = useStore((state) => state.resetToMockData);

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const filteredMaterials = useMemo(() => {
    let result = [...materials];

    if (filters.statuses.length > 0) {
      result = result.filter(m => filters.statuses.includes(m.status));
    }

    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      result = result.filter(m =>
        m.projectName.toLowerCase().includes(keyword) ||
        m.buildingNo.toLowerCase().includes(keyword) ||
        m.materialType.toLowerCase().includes(keyword) ||
        m.surveyNo.toLowerCase().includes(keyword) ||
        m.currentConclusion.toLowerCase().includes(keyword)
      );
    }

    if (filters.dateRange.start) {
      result = result.filter(m => new Date(m.importDate) >= new Date(filters.dateRange.start!));
    }
    if (filters.dateRange.end) {
      result = result.filter(m => new Date(m.importDate) <= new Date(filters.dateRange.end!));
    }

    if (filters.buildingNo) {
      result = result.filter(m => m.buildingNo === filters.buildingNo);
    }

    if (filters.onlyPending) {
      result = result.filter(m => {
        if (m.isPending) return true;
        const { hasException } = detectExceptions(m, records);
        return hasException;
      });
    }

    if (filters.onlyException) {
      result = result.filter(m => m.status === 'exception');
    }

    return result.sort((a, b) => new Date(b.importDate).getTime() - new Date(a.importDate).getTime());
  }, [materials, records, filters]);

  return (
    <div className="h-full flex flex-col bg-industrial-850">
      <div className="p-4 border-b border-industrial-700 bg-industrial-900">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-industrial-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary-400" />
              材料列表
            </h2>
            <p className="text-xs text-industrial-500 mt-0.5">
              共 {filteredMaterials.length} 条记录
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportDialog(true)}
              className="btn-secondary flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              导入
            </button>
            <button
              onClick={() => setShowAddDialog(true)}
              className="btn-primary flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              新增
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetToMockData}
            className="text-xs text-industrial-500 hover:text-industrial-300 transition-colors flex items-center gap-1"
          >
            <Database className="w-3 h-3" />
            重置为示例数据
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredMaterials.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-industrial-500">
            <Database className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">暂无符合条件的材料记录</p>
            <p className="text-xs mt-1">请尝试调整筛选条件</p>
          </div>
        ) : (
          filteredMaterials.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              recordCount={records.filter((r) => r.materialId === material.id).length}
              isSelected={selectedMaterialId === material.id}
              onClick={() => selectMaterial(material.id)}
            />
          ))
        )}
      </div>

      {showImportDialog && <ImportDialog onClose={() => setShowImportDialog(false)} />}
      {showAddDialog && <AddMaterialDialog onClose={() => setShowAddDialog(false)} />}
    </div>
  );
}

import { useState } from 'react';
import {
  FileText,
  Image,
  FileCheck,
  ListChecks,
  Lightbulb,
  Paperclip,
  StickyNote,
  Trash2,
  Link,
  Check,
  Eye,
  X,
  Plus,
} from 'lucide-react';
import { useHandoverStore } from '@/store/useHandoverStore';
import {
  MATERIAL_TYPE_LABELS,
  MATERIAL_STATUS_LABELS,
  MaterialType,
} from '@/types';
import { cn } from '@/lib/utils';

const typeIcons: Record<MaterialType, React.ReactNode> = {
  wall_image: <Image className="w-5 h-5" />,
  insurance_policy: <FileCheck className="w-5 h-5" />,
  installation_list: <ListChecks className="w-5 h-5" />,
  light_record: <Lightbulb className="w-5 h-5" />,
  attachment: <Paperclip className="w-5 h-5" />,
  remark: <StickyNote className="w-5 h-5" />,
};

export default function Materials() {
  const [selectedType, setSelectedType] = useState<MaterialType | 'all'>('all');
  const [relatingMode, setRelatingMode] = useState(false);
  const [selectedForRelation, setSelectedForRelation] = useState<string[]>([]);
  const [viewingMaterial, setViewingMaterial] = useState<string | null>(null);

  const {
    getCurrentHandover,
    getMaterialsForHandover,
    deleteMaterial,
    markMaterialCorrected,
    relateMaterials,
    addMaterialManual,
  } = useHandoverStore();

  const currentHandover = getCurrentHandover();
  const allMaterials = currentHandover ? getMaterialsForHandover(currentHandover.id) : [];

  const filteredMaterials =
    selectedType === 'all'
      ? allMaterials
      : allMaterials.filter(m => m.type === selectedType);

  const materialsByType = allMaterials.reduce((acc, m) => {
    acc[m.type] = (acc[m.type] || 0) + 1;
    return acc;
  }, {} as Record<MaterialType, number>);

  const viewingMaterialData = viewingMaterial
    ? allMaterials.find(m => m.id === viewingMaterial)
    : null;

  const handleToggleSelect = (id: string) => {
    setSelectedForRelation(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleRelate = () => {
    if (selectedForRelation.length >= 2) {
      const [first, ...rest] = selectedForRelation;
      relateMaterials(first, rest);
      setSelectedForRelation([]);
      setRelatingMode(false);
    }
  };

  const handleAddManual = () => {
    if (!currentHandover) return;
    const type = selectedType === 'all' ? 'attachment' : selectedType;
    const name = prompt('请输入材料名称:');
    if (name?.trim()) {
      addMaterialManual(currentHandover.id, type, name.trim());
    }
  };

  if (!currentHandover) {
    return (
      <div className="p-6">
        <div className="bg-white border border-gallery-200 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-gallery-300 mb-4" />
          <h3 className="text-lg font-medium text-gallery-700 mb-2">请先选择交接单</h3>
          <p className="text-gallery-500">在交接工作台中选择或创建交接单</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gallery-900">材料管理</h1>
          <p className="text-sm text-gallery-500 mt-1">管理交接单中的所有材料和关联关系</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAddManual}
            className="flex items-center gap-2 px-4 py-2 border border-gallery-300 rounded hover:bg-gallery-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            手动添加
          </button>
          <button
            onClick={() => {
              setRelatingMode(!relatingMode);
              setSelectedForRelation([]);
            }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded transition-colors',
              relatingMode
                ? 'bg-accent-info text-white'
                : 'border border-gallery-300 hover:bg-gallery-50'
            )}
          >
            <Link className="w-4 h-4" />
            {relatingMode ? '取消关联' : '关联材料'}
          </button>
        </div>
      </div>

      {relatingMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link className="w-5 h-5 text-accent-info" />
              <span className="text-blue-800">
                请选择至少 2 个材料进行关联 (已选择 {selectedForRelation.length} 个)
              </span>
            </div>
            {selectedForRelation.length >= 2 && (
              <button
                onClick={handleRelate}
                className="bg-accent-success text-white px-4 py-1.5 rounded text-sm hover:bg-green-600 transition-colors"
              >
                <Check className="w-4 h-4 inline mr-1" />
                确认关联
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedType('all')}
          className={cn(
            'px-4 py-2 rounded whitespace-nowrap text-sm transition-colors',
            selectedType === 'all'
              ? 'bg-gallery-900 text-white'
              : 'bg-gallery-100 text-gallery-600 hover:bg-gallery-200'
          )}
        >
          全部 ({allMaterials.length})
        </button>
        {Object.entries(typeIcons).map(([type, icon]) => (
          <button
            key={type}
            onClick={() => setSelectedType(type as MaterialType)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded whitespace-nowrap text-sm transition-colors',
              selectedType === type
                ? 'bg-gallery-900 text-white'
                : 'bg-gallery-100 text-gallery-600 hover:bg-gallery-200'
            )}
          >
            {icon}
            {MATERIAL_TYPE_LABELS[type as MaterialType]} ({materialsByType[type as MaterialType] || 0})
          </button>
        ))}
      </div>

      <div className="bg-white border border-gallery-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gallery-50 border-b border-gallery-200">
              <tr>
                {relatingMode && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500 w-12">
                    选择
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">关联</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">上传时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gallery-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gallery-100">
              {filteredMaterials.map(material => (
                <tr
                  key={material.id}
                  className={cn(
                    'hover:bg-gallery-50 transition-colors',
                    viewingMaterial === material.id && 'bg-blue-50',
                    selectedForRelation.includes(material.id) && 'bg-accent-info/10'
                  )}
                >
                  {relatingMode && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedForRelation.includes(material.id)}
                        onChange={() => handleToggleSelect(material.id)}
                        className="rounded border-gallery-300"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-gallery-100 rounded">
                      {typeIcons[material.type]}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{material.name}</div>
                    {material.fileName && (
                      <div className="text-xs text-gallery-400 truncate max-w-xs">
                        {material.fileName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded',
                        material.status === 'normal'
                          ? 'bg-green-100 text-green-700'
                          : material.status === 'duplicate'
                          ? 'bg-amber-100 text-amber-700'
                          : material.status === 'late'
                          ? 'bg-orange-100 text-orange-700'
                          : material.status === 'corrected'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                      )}
                    >
                      {MATERIAL_STATUS_LABELS[material.status]}
                    </span>
                    {material.isDuplicate && material.duplicateOf && (
                      <div className="text-xs text-gallery-400 mt-1">重复项</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {material.relatedIds.length > 0 ? (
                      <div className="flex items-center gap-1 text-xs text-accent-info">
                        <Link className="w-3 h-3" />
                        {material.relatedIds.length} 个关联
                      </div>
                    ) : (
                      <span className="text-xs text-gallery-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gallery-500">
                    {new Date(material.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewingMaterial(material.id)}
                        className="p-1.5 text-gallery-500 hover:text-gallery-700 hover:bg-gallery-100 rounded transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {material.status !== 'corrected' && material.status !== 'normal' && (
                        <button
                          onClick={() => markMaterialCorrected(material.id)}
                          className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                          title="标记为已更正"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('确定删除此材料？')) {
                            deleteMaterial(material.id);
                          }
                        }}
                        className="p-1.5 text-gallery-500 hover:text-accent-danger hover:bg-red-50 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredMaterials.length === 0 && (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gallery-300 mb-3" />
            <p className="text-gallery-500">暂无材料</p>
          </div>
        )}
      </div>

      {viewingMaterialData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gallery-200">
              <h3 className="font-medium">材料详情</h3>
              <button
                onClick={() => setViewingMaterial(null)}
                className="p-1 hover:bg-gallery-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(80vh-60px)]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-xs text-gallery-500 mb-1">类型</div>
                  <div className="font-medium">
                    {MATERIAL_TYPE_LABELS[viewingMaterialData.type]}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gallery-500 mb-1">状态</div>
                  <div className="font-medium">
                    {MATERIAL_STATUS_LABELS[viewingMaterialData.status]}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gallery-500 mb-1">文件名</div>
                  <div className="font-medium">{viewingMaterialData.fileName || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gallery-500 mb-1">文件大小</div>
                  <div className="font-medium">
                    {viewingMaterialData.fileSize
                      ? `${(viewingMaterialData.fileSize / 1024).toFixed(2)} KB`
                      : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gallery-500 mb-1">上传时间</div>
                  <div className="font-medium">
                    {new Date(viewingMaterialData.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gallery-500 mb-1">关联材料数</div>
                  <div className="font-medium">{viewingMaterialData.relatedIds.length}</div>
                </div>
              </div>

              {viewingMaterialData.fileData &&
                viewingMaterialData.type === 'wall_image' && (
                  <div className="mt-4">
                    <div className="text-xs text-gallery-500 mb-2">预览</div>
                    <img
                      src={viewingMaterialData.fileData}
                      alt={viewingMaterialData.name}
                      className="max-w-full rounded border border-gallery-200"
                    />
                  </div>
                )}

              {Object.keys(viewingMaterialData.metadata).length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-gallery-500 mb-2">元数据</div>
                  <div className="bg-gallery-50 rounded p-3 text-sm font-mono">
                    {JSON.stringify(viewingMaterialData.metadata, null, 2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

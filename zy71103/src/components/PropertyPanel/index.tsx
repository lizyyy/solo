import React from 'react';
import { X, Trash2, MapPin, Clock } from 'lucide-react';
import { useAppStore, generateId } from '../../store/useAppStore';
import type { Staff, PathPoint } from '../../types';

export const PropertyPanel: React.FC = () => {
  const {
    selectedElementId,
    sceneData,
    updateElement,
    removeElement,
    setSelectedElement,
    addPathPoint,
    removePathPoint,
    updatePathPoint,
  } = useAppStore();

  const selectedElement = sceneData.elements.find((e) => e.id === selectedElementId);

  if (!selectedElement) {
    return (
      <div className="absolute right-4 top-20 w-72 z-20">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <p className="text-gray-500 text-sm text-center">选择一个元素查看属性</p>
        </div>
      </div>
    );
  }

  const handleNameChange = (name: string) => {
    updateElement(selectedElement.id, { name });
  };

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    updateElement(selectedElement.id, {
      position: { ...selectedElement.position, [axis]: value },
    });
  };

  const handleAddPathPoint = () => {
    if (selectedElement.type !== 'staff') return;
    const staff = selectedElement as Staff;
    const lastTimestamp = staff.path.length > 0
      ? staff.path[staff.path.length - 1].timestamp + 2
      : 0;
    const newPoint: PathPoint = {
      id: generateId(),
      position: { x: Math.random() * 4 - 2, y: 0, z: Math.random() * 4 - 2 },
      timestamp: lastTimestamp,
      action: '新节点',
    };
    addPathPoint(selectedElement.id, newPoint);
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'instrumentCart':
        return '器械车';
      case 'sterileZone':
        return '无菌区';
      case 'recycleBin':
        return '回收桶';
      case 'staff':
        return '人员';
      default:
        return type;
    }
  };

  return (
    <div className="absolute right-4 top-20 w-80 z-20">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-medium text-gray-800">{selectedElement.name}</h3>
            <p className="text-xs text-gray-500">{getTypeLabel(selectedElement.type)}</p>
          </div>
          <button
            onClick={() => setSelectedElement(null)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
            <input
              type="text"
              value={selectedElement.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              位置
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <div key={axis}>
                  <span className="text-xs text-gray-500 uppercase">{axis}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedElement.position[axis].toFixed(2)}
                    onChange={(e) => handlePositionChange(axis, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {selectedElement.type === 'staff' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  路径节点
                </label>
                <button
                  onClick={handleAddPathPoint}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  + 添加节点
                </button>
              </div>
              {(selectedElement as Staff).path.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">暂无路径节点</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(selectedElement as Staff).path.map((point, index) => (
                    <div
                      key={point.id}
                      className="p-2 bg-gray-50 rounded-lg flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {point.action || `节点 ${index + 1}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {point.timestamp.toFixed(1)}s · ({point.position.x.toFixed(1)}, {point.position.z.toFixed(1)})
                        </p>
                      </div>
                      <button
                        onClick={() => removePathPoint(selectedElement.id, point.id)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => removeElement(selectedElement.id)}
            className="w-full py-2 px-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            删除元素
          </button>
        </div>
      </div>
    </div>
  );
};

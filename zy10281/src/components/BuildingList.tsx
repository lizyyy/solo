import React from 'react';
import type { Building } from '../types';
import { ElevatorSignStore } from '../store';

interface BuildingListProps {
  buildings: Building[];
  onSelect: (building: Building) => void;
  selectedId?: string;
  onAddBuilding: () => void;
}

export const BuildingList: React.FC<BuildingListProps> = ({ 
  buildings, 
  onSelect, 
  selectedId,
  onAddBuilding 
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">楼栋列表</h2>
        <button
          onClick={onAddBuilding}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
        >
          + 新增楼栋
        </button>
      </div>
      
      <div className="space-y-3">
        {buildings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无楼栋数据
          </div>
        ) : (
          buildings.map(building => {
            const stats = ElevatorSignStore.getProgressStats(building.id);
            return (
              <div
                key={building.id}
                onClick={() => onSelect(building)}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                  selectedId === building.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{building.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{building.address}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(building.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className="text-gray-600">
                    {building.totalFloors} 层 · {building.units.length} 单元
                  </span>
                  <span className="text-blue-600 font-medium">
                    同意率 {stats.agreeRate.toFixed(1)}%
                  </span>
                </div>
                
                <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${stats.signedRate}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

import { X, Building2, ListChecks, Clock } from 'lucide-react';
import { useBuildingStore } from '@/store/useBuildingStore';
import { useRecordStore } from '@/store/useRecordStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useNavigate } from 'react-router-dom';

export function BuildingInfoPanel() {
  const { selectedBuildingId, setSelectedBuildingId, getBuildingById } = useBuildingStore();
  const records = useRecordStore((state) => state.records);
  const navigate = useNavigate();

  const building = selectedBuildingId ? getBuildingById(selectedBuildingId) : null;
  const buildingRecords = records.filter((r) => r.buildingId === selectedBuildingId);

  if (!building) return null;

  return (
    <div className="absolute top-6 right-6 z-10 w-80">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6" />
              <div>
                <h3 className="font-bold text-lg">{building.name}</h3>
                <p className="text-primary-200 text-sm">
                  高度: {building.dimensions.height}m | 记录数: {buildingRecords.length}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedBuildingId(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 max-h-80 overflow-auto">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-700">关联记录</span>
          </div>

          {buildingRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无关联记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {buildingRecords.map((record) => (
                <div
                  key={record.id}
                  onClick={() => navigate(`/records/${record.id}`)}
                  className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-700">
                      {record.floor}层 {record.roomNumber}
                    </span>
                    <StatusBadge status={record.status} />
                  </div>
                  <div className="text-xs text-slate-500">
                    来源: {record.source}
                  </div>
                  {record.pendingReason && (
                    <div className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded">
                      {record.pendingReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

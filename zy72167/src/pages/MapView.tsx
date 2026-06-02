import { useState } from 'react';
import { useCarbonStore } from '@/store/carbonStore';
import { MapPin, ZoomIn, ZoomOut, Layers, Filter, X } from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import SourceBadge from '@/components/common/SourceBadge';
import type { RecordStatus } from '@/types';

export default function MapView() {
  const { records, mergeGroups } = useCarbonStore();
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');

  const filteredRecords = statusFilter === 'all'
    ? records
    : records.filter(r => r.status === statusFilter);

  const getMarkerColor = (status: RecordStatus) => {
    switch (status) {
      case 'review_confirmed': return 'bg-green-500';
      case 'needs_confirmation': return 'bg-warn-500';
      case 'auto_merged': return 'bg-blue-500';
      case 'pending_review': return 'bg-yellow-500';
      case 'rejected': return 'bg-danger-500';
      case 'split': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getMarkerGlow = (status: RecordStatus) => {
    switch (status) {
      case 'needs_confirmation': return 'shadow-warn-500/50';
      case 'auto_merged': return 'shadow-blue-500/50';
      default: return '';
    }
  };

  const hasPulse = (status: RecordStatus) => {
    return status === 'needs_confirmation' || status === 'auto_merged';
  };

  const selected = selectedRecord ? records.find(r => r.id === selectedRecord) : null;
  const selectedGroup = selected?.mergeGroupId
    ? mergeGroups.find(g => g.id === selected.mergeGroupId)
    : null;

  const statusOptions: { value: RecordStatus | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'review_confirmed', label: '审核通过' },
    { value: 'needs_confirmation', label: '需确认' },
    { value: 'auto_merged', label: '自动归并' },
    { value: 'pending_review', label: '待审核' },
    { value: 'rejected', label: '已驳回' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-lg font-semibold text-gray-800 mb-1">地图标注</h3>
          <p className="text-sm text-gray-500">
            可视化展示所有点位位置，按状态着色区分，点击可查看详情
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RecordStatus | 'all')}
              className="input-field text-sm py-1.5 w-36"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md overflow-hidden">
            <button
              onClick={() => setZoom(z => Math.max(0.6, z - 0.1))}
              className="p-2 hover:bg-gray-50 transition-colors"
            >
              <ZoomOut className="w-4 h-4 text-gray-600" />
            </button>
            <span className="px-3 text-sm text-gray-600 border-x border-gray-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
              className="p-2 hover:bg-gray-50 transition-colors"
            >
              <ZoomIn className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 card overflow-hidden">
          <div className="bg-gradient-to-br from-primary-50 to-cream-100 p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary-600" />
              <span className="font-medium text-gray-800">和平里街道片区示意图</span>
            </div>
            <div className="text-sm text-gray-500">
              共 {filteredRecords.length} 个点位
            </div>
          </div>
          
          <div className="relative bg-cream-50 overflow-hidden" style={{ height: '600px' }}>
            <div
              className="absolute inset-0 transition-transform duration-300 ease-out"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            >
              <svg viewBox="0 0 600 500" className="w-full h-full">
                <defs>
                  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="600" height="500" fill="url(#grid)" />
                
                <path d="M 50 250 Q 150 200 250 250 T 550 250" fill="none" stroke="#d1d5db" strokeWidth="8" strokeLinecap="round" />
                <text x="300" y="275" textAnchor="middle" fill="#9ca3af" fontSize="12">和平里大街</text>
                
                <path d="M 250 50 Q 300 150 250 250" fill="none" stroke="#d1d5db" strokeWidth="6" strokeLinecap="round" />
                <text x="225" y="150" textAnchor="middle" fill="#9ca3af" fontSize="12" transform="rotate(-20, 225, 150)">安定门内大街</text>
                
                <path d="M 350 100 Q 400 200 350 300" fill="none" stroke="#d1d5db" strokeWidth="6" strokeLinecap="round" />
                <text x="375" y="200" textAnchor="middle" fill="#9ca3af" fontSize="12" transform="rotate(15, 375, 200)">地坛西街</text>
                
                <rect x="100" y="180" width="120" height="100" rx="4" fill="#e5e7eb" opacity="0.5" />
                <text x="160" y="235" textAnchor="middle" fill="#6b7280" fontSize="11">和平里七区</text>
                
                <ellipse cx="380" cy="150" rx="80" ry="60" fill="#86efac" opacity="0.3" />
                <text x="380" y="155" textAnchor="middle" fill="#166534" fontSize="11">地坛公园</text>
                
                <rect x="420" y="320" width="100" height="80" rx="4" fill="#fef3c7" opacity="0.5" />
                <text x="470" y="365" textAnchor="middle" fill="#92400e" fontSize="11">便民停车场</text>
              </svg>

              {filteredRecords.map((record) => {
                const mapX = record.location.mapX || 300;
                const mapY = record.location.mapY || 250;
                const isSelected = selectedRecord === record.id;
                
                return (
                  <div
                    key={record.id}
                    className="absolute cursor-pointer"
                    style={{
                      left: `${(mapX / 600) * 100}%`,
                      top: `${(mapY / 500) * 100}%`,
                      transform: 'translate(-50%, -100%)',
                      zIndex: isSelected ? 20 : 10,
                    }}
                    onClick={() => setSelectedRecord(record.id)}
                  >
                    {hasPulse(record.status) && (
                      <div
                        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full ${getMarkerColor(record.status)} opacity-30 marker-pulse`}
                      />
                    )}
                    <div
                      className={`relative w-6 h-6 rounded-full ${getMarkerColor(record.status)} flex items-center justify-center
                        shadow-lg ${getMarkerGlow(record.status)} shadow-lg
                        transition-all duration-200 hover:scale-125
                        ${isSelected ? 'ring-4 ring-white ring-opacity-80 scale-125' : ''}
                      `}
                    >
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="w-80 space-y-4">
          <div className="card p-4">
            <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              图例说明
            </h4>
            <div className="space-y-2">
              {[
                { status: 'review_confirmed', label: '审核通过' },
                { status: 'auto_merged', label: '自动归并待确认' },
                { status: 'needs_confirmation', label: '需人工确认' },
                { status: 'pending_review', label: '待审核' },
                { status: 'rejected', label: '已驳回' },
              ].map(item => (
                <div key={item.status} className="flex items-center gap-2 text-sm">
                  <div className={`w-3 h-3 rounded-full ${getMarkerColor(item.status as RecordStatus)}`} />
                  <span className="text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {selected ? (
            <div className="card p-4 animate-scale-in">
              <div className="flex items-start justify-between mb-4">
                <h4 className="font-medium text-gray-800">{selected.pointName}</h4>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">地址</p>
                  <p className="text-gray-800">{selected.address}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">碳排放量</span>
                  <span className="font-semibold text-primary-600">
                    {selected.carbonAmount} {selected.unit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <SourceBadge sourceType={selected.sourceType} className="text-xs" />
                  <StatusBadge status={selected.status} className="text-xs" />
                </div>
                <div>
                  <p className="text-gray-500">记录日期</p>
                  <p className="text-gray-800">{selected.recordDate}</p>
                </div>
                
                {selectedGroup && (
                  <div className="bg-primary-50 rounded-md p-3 mt-3">
                    <p className="text-xs text-primary-700 font-medium mb-1">归并信息</p>
                    <p className="text-sm text-primary-800">{selectedGroup.canonicalName}</p>
                    <p className="text-xs text-primary-600 mt-1">
                      匹配度 {selectedGroup.confidenceScore}% · {selectedGroup.recordCount} 条记录
                    </p>
                  </div>
                )}
                
                {selected.isOldCaliber && (
                  <div className="bg-orange-50 rounded-md p-3">
                    <p className="text-xs text-orange-700 font-medium">旧口径数据</p>
                    <p className="text-sm text-orange-800 mt-1">{selected.oldCaliberNote}</p>
                  </div>
                )}
                
                {selected.remark && (
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500 font-medium">人工备注</p>
                    <p className="text-sm text-gray-800 mt-1">{selected.remark}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-gray-400">
              <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">点击地图上的标注点查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

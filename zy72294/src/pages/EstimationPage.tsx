import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Triangle, Box, Shapes, LayoutGrid, BarChart2, ChevronDown, ChevronUp, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

const modelIcons = {
  cone: Triangle,
  cuboid: Box,
  irregular: Shapes,
};

const modelLabels = {
  cone: '锥体',
  cuboid: '长方体',
  irregular: '不规则体',
};

export default function EstimationPage() {
  const navigate = useNavigate();
  const { viewMode, setViewMode, getReviewForRecord, getUniqueRecords, getEstimationForRecord, setSelectedRecordId } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const uniqueRecords = getUniqueRecords();
  const uniqueEstimations = uniqueRecords
    .map((r) => getEstimationForRecord(r.id))
    .filter((e): e is NonNullable<typeof e> => !!e);

  const totalVolume = uniqueEstimations.reduce((sum, e) => sum + e.volume, 0);
  const avgVolume = uniqueEstimations.length > 0 ? totalVolume / uniqueEstimations.length : 0;
  const recordCount = uniqueRecords.length;

  const getRecord = (recordId: string) => {
    return uniqueRecords.find((r) => r.id === recordId);
  };

  const handleCardClick = (estimation: typeof uniqueEstimations[0]) => {
    const record = getRecord(estimation.recordId);
    const review = getReviewForRecord(estimation.recordId);
    setSelectedRecordId(estimation.recordId);
    if (record?.alarmOccluded && review?.reviewStatus === 'pending') {
      navigate('/review');
    } else {
      navigate('/obstacles');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">堆垛体积估算</h1>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors',
              viewMode === 'list' ? 'bg-industrial-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            列表
          </button>
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors',
              viewMode === '3d' ? 'bg-industrial-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Box className="w-4 h-4" />
            3D
          </button>
          <button
            type="button"
            onClick={() => setViewMode('chart')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors',
              viewMode === 'chart' ? 'bg-industrial-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <BarChart2 className="w-4 h-4" />
            图表
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-card">
          <p className="text-sm text-gray-500 mb-1">总体积 (m³)</p>
          <p className="text-3xl font-semibold font-mono text-gray-900">{totalVolume.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-card">
          <p className="text-sm text-gray-500 mb-1">平均体积 (m³)</p>
          <p className="text-3xl font-semibold font-mono text-gray-900">{avgVolume.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-card">
          <p className="text-sm text-gray-500 mb-1">记录总数</p>
          <p className="text-3xl font-semibold font-mono text-gray-900">{recordCount}</p>
        </div>
      </div>

      {viewMode === 'list' && (
        <div className="space-y-4">
          {uniqueEstimations.map((estimation) => {
            const record = getRecord(estimation.recordId);
            const review = getReviewForRecord(estimation.recordId);
            const ModelIcon = modelIcons[estimation.calculationModel];
            const isExpanded = expandedId === estimation.id;
            const isHovered = hoveredId === estimation.id;

            return (
              <div
                key={estimation.id}
                className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleCardClick(estimation)}
                onMouseEnter={() => setHoveredId(estimation.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-lg bg-industrial-100 flex items-center justify-center">
                          <ModelIcon className="w-8 h-8 text-industrial-600" />
                        </div>
                        {isHovered && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-gray-900 text-white text-xs rounded-lg p-3 z-10 shadow-xl">
                            <div className="flex items-start gap-2">
                              <Info className="w-4 h-4 shrink-0 mt-0.5" />
                              <p>{estimation.tradeoffReason}</p>
                            </div>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-4 border-transparent border-t-gray-900" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <p className="text-4xl font-bold font-mono text-gray-900">
                            {estimation.volume.toFixed(2)}
                          </p>
                          <span className="text-sm text-gray-500">m³</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {modelLabels[estimation.calculationModel]}模型 · 测距点 ({record?.pointX}, {record?.pointY})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-industrial-100 text-industrial-700">
                        {estimation.paramVersion}
                      </span>
                      {record?.alarmOccluded && (
                        <StatusBadge status={review?.reviewStatus || 'pending'} />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : estimation.id);
                        }}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  {record?.alarmOccluded && review?.reviewStatus === 'pending' && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-warning-50 rounded-lg text-warning-700 text-sm mb-4">
                      <AlertTriangle className="w-4 h-4" />
                      <span>该记录存在遮挡告警，需先由经理复核</span>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm font-medium text-gray-700 mb-3">计算参数</p>
                      <div className="grid grid-cols-4 gap-4">
                        {Object.entries(estimation.calculationParams).map(([key, value]) => (
                          <div key={key} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">{key}</p>
                            <p className="text-sm font-mono text-gray-900">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === '3d' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-12 text-center">
          <Box className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">3D 视图开发中...</p>
        </div>
      )}

      {viewMode === 'chart' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-12 text-center">
          <BarChart2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">图表视图开发中...</p>
        </div>
      )}
    </div>
  );
}

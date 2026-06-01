import { useState, Fragment } from 'react';
import { Check, X, AlertTriangle, Clock, Image, MapPin, Users, Layers, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { ANOMALY_LABELS, STATUS_LABELS } from '@/types';
import type { AnomalyType, PointStatus, SoundFieldPoint } from '@/types';

const anomalyIcons: Record<AnomalyType, typeof AlertTriangle> = {
  coordinate_offset: MapPin,
  duplicate_name: Users,
  missing_photo: Image,
  cross_floor: Layers,
  coordinate_mismatch: Globe,
};

const statusBadgeClass: Record<PointStatus, string> = {
  normal: 'badge-normal',
  pending: 'badge-pending',
  anomaly: 'badge-anomaly',
};

export function PointList() {
  const {
    points,
    getFilteredPoints,
    selectedPointId,
    selectPoint,
    updatePointStatus,
    currentOperator,
  } = useStore();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filteredPoints = getFilteredPoints();

  const toggleExpand = (pointId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(pointId)) {
      newExpanded.delete(pointId);
    } else {
      newExpanded.add(pointId);
    }
    setExpandedRows(newExpanded);
  };

  const handleConfirm = (point: SoundFieldPoint) => {
    if (point.status === 'pending') {
      updatePointStatus(point.id, 'normal', '人工确认：坐标偏移为特殊编排，数据有效');
    } else if (point.status === 'anomaly') {
      updatePointStatus(point.id, 'pending', '需进一步核实异常情况');
    }
  };

  const handleReject = (point: SoundFieldPoint) => {
    updatePointStatus(point.id, 'anomaly', '人工判定为无效数据');
  };

  const getDataSourceBadge = (source: string) => {
    if (source === 'gis_legacy') {
      return <span className="badge badge-gis">GIS旧口径</span>;
    }
    if (source === 'manual') {
      return <span className="badge bg-blue-100 text-blue-800">人工补录</span>;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary-700 font-serif">
          明细数据列表
        </h3>
        <div className="text-sm text-gray-500">
          显示 {filteredPoints.length} / {points.length} 条记录
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium text-gray-600 w-8"></th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">点位ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">设备名称</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">乐器</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">坐标</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">坐标系</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">楼层</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">照片</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">来源</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">状态</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">异常</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredPoints.map((point, index) => {
              const isSelected = selectedPointId === point.id;
              const isExpanded = expandedRows.has(point.id);
              
              return (
                <Fragment key={point.id}>
                  <tr
                    onClick={() => selectPoint(point.id)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    } hover:bg-primary-50/50`}
                  >
                    <td className="px-3 py-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(point.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{point.id}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{point.name}</td>
                    <td className="px-3 py-2 text-gray-600">{point.instrument}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">
                      ({point.x}, {point.y})
                    </td>
                    <td className="px-3 py-2">
                      <span className={point.coordinateSystem !== 'CGCS2000' ? 'text-purple-600 font-medium' : 'text-gray-600'}>
                        {point.coordinateSystem}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{point.floor}层</td>
                    <td className="px-3 py-2">
                      {point.photoUrl ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <Image className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1" title="缺照片">
                          <X className="w-4 h-4" />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {getDataSourceBadge(point.dataSource)}
                        {!getDataSourceBadge(point.dataSource) && (
                          <span className="text-gray-500 text-xs">主数据源</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`badge ${statusBadgeClass[point.status]}`}>
                        {STATUS_LABELS[point.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {point.anomalies.length > 0 ? (
                          point.anomalies.map((a) => {
                            const Icon = anomalyIcons[a];
                            return (
                              <span
                                key={a}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-orange-50 text-orange-700"
                                title={ANOMALY_LABELS[a]}
                              >
                                <Icon className="w-3 h-3" />
                                {ANOMALY_LABELS[a]}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {point.status !== 'normal' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirm(point);
                            }}
                            className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                            title="确认正常"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(point);
                            }}
                            className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
                            title="标记异常"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {point.status === 'normal' && point.confirmedBy && (
                        <span className="text-xs text-gray-400">
                          {point.confirmedBy}确认
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={12} className="px-6 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-gray-700 mb-1">判断过程</div>
                            <p className="text-gray-600 leading-relaxed">{point.judgmentProcess}</p>
                          </div>
                          <div>
                            <div className="font-medium text-gray-700 mb-1">备注</div>
                            <p className="text-gray-600">{point.remark || '暂无备注'}</p>
                          </div>
                          {point.diffHistory.length > 0 && (
                            <div className="col-span-2">
                              <div className="font-medium text-gray-700 mb-2">变更历史</div>
                              <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-thin">
                                {point.diffHistory.map((diff, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 bg-white rounded border border-gray-200 text-xs"
                                  >
                                    <div className="flex items-center justify-between text-gray-500 mb-1">
                                      <span>{diff.operator} · {new Date(diff.timestamp).toLocaleString('zh-CN')}</span>
                                      <span className="text-primary-600">{diff.reason}</span>
                                    </div>
                                    <div className="text-gray-700">
                                      {diff.field}: 
                                      <span className="text-red-500 line-through mx-1">
                                        {String(diff.oldValue) || '(空)'}
                                      </span>
                                      →
                                      <span className="text-green-600 mx-1">
                                        {String(diff.newValue) || '(空)'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-green-500" />
            人工确认正常
          </span>
          <span className="flex items-center gap-1">
            <X className="w-3 h-3 text-red-500" />
            标记为异常
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-yellow-500" />
            需人工确认
          </span>
        </div>
        <div>当前操作人: {currentOperator}</div>
      </div>
    </div>
  );
}

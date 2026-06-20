import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Clock, FileText, ChevronRight, AlertTriangle, CheckCircle, XCircle, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { useAppStore } from '@/store';
import { showToast } from '@/utils/errorMessageUtils';
import type { BoundaryStatus, Point } from '@/types';

interface LocationState {
  fromBusTime?: boolean;
  fromRedline?: boolean;
  highlightPointId?: string;
}

interface StatusConfig {
  label: string;
  dot: string;
  ring: string;
  text: string;
  bg: string;
  Icon: typeof AlertTriangle;
}

function getStatusConfig(status: BoundaryStatus | string): StatusConfig {
  switch (status) {
    case 'pending':
      return {
        label: '待复核',
        dot: '#F59E0B',
        ring: 'ring-amber-400/40',
        text: 'text-amber-700',
        bg: 'bg-amber-100',
        Icon: AlertTriangle,
      };
    case 'confirmed':
      return {
        label: '已确认',
        dot: '#10B981',
        ring: 'ring-emerald-400/40',
        text: 'text-emerald-700',
        bg: 'bg-emerald-100',
        Icon: CheckCircle,
      };
    case 'rejected':
      return {
        label: '已驳回',
        dot: '#EF4444',
        ring: 'ring-red-400/40',
        text: 'text-red-700',
        bg: 'bg-red-100',
        Icon: XCircle,
      };
    case 'normal':
    default:
      return {
        label: '正常',
        dot: '#3B82F6',
        ring: 'ring-blue-400/40',
        text: 'text-blue-700',
        bg: 'bg-blue-100',
        Icon: CheckCircle,
      };
  }
}

interface StreetColor {
  fill: string;
  stroke: string;
}

function getStreetColor(streetId: string): StreetColor {
  switch (streetId) {
    case 'st1':
      return { fill: 'rgba(59,130,246,0.12)', stroke: '#3B82F6' };
    case 'st2':
      return { fill: 'rgba(16,185,129,0.12)', stroke: '#10B981' };
    default:
      return { fill: 'rgba(100,116,139,0.10)', stroke: '#64748B' };
  }
}

function transformLngToX(lng: number): number {
  return 100 + (lng - 116.35) * 2000;
}

function transformLatToY(lat: number): number {
  return 100 + (39.95 - lat) * 2000;
}

export default function MapView() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  const { points, streets, busTimeSlots, getPointRemarks } = useAppStore();

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [viewScale, setViewScale] = useState<number>(1);

  useEffect(() => {
    if (locationState?.highlightPointId) {
      setSelectedPointId(locationState.highlightPointId);
      showToast('已返回地图，自动展开关联点位详情', 'info');
    }
  }, [locationState?.highlightPointId]);

  const selectedPoint = useMemo<Point | null>(() => {
    return points.find((p) => p.id === selectedPointId) || null;
  }, [points, selectedPointId]);

  const pointSlots = useMemo(() => {
    return selectedPointId ? busTimeSlots.filter((s) => s.relatedPointIds.includes(selectedPointId)) : [];
  }, [busTimeSlots, selectedPointId]);

  const pointRemarks = useMemo(() => {
    return selectedPointId ? getPointRemarks(selectedPointId) : [];
  }, [getPointRemarks, selectedPointId]);

  const getStreetName = (id: string): string => {
    return streets.find((s) => s.id === id)?.name || id;
  };

  const handleViewBusTime = () => {
    if (!selectedPoint) return;
    navigate('/bus-time', {
      state: {
        fromMap: true,
        pointId: selectedPointId,
        pointName: selectedPoint.name,
        highlightSlotIds: pointSlots.map((s) => s.id),
      },
    });
  };

  const handleViewRedlineRemark = () => {
    if (!selectedPoint) return;
    navigate('/redline-remark', {
      state: {
        fromMap: true,
        pointId: selectedPointId,
        pointName: selectedPoint.name,
        highlightRemarkIds: pointRemarks.map((r) => r.id),
      },
    });
  };

  const handleZoomIn = () => {
    setViewScale((prev) => Math.min(prev + 0.25, 2));
  };

  const handleZoomOut = () => {
    setViewScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const statusItems: Array<{ status: BoundaryStatus | string; label: string }> = [
    { status: 'normal', label: '正常' },
    { status: 'pending', label: '待复核' },
    { status: 'confirmed', label: '已确认' },
    { status: 'rejected', label: '已驳回' },
  ];

  const latestRemark = pointRemarks.length > 0
    ? pointRemarks.slice().sort((a, b) => b.version - a.version)[0]
    : null;

  return (
    <div className="h-[calc(100vh-5rem)] flex bg-slate-50">
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="w-10 h-10 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
            title="放大"
          >
            <ZoomIn className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-10 h-10 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
            title="缩小"
          >
            <ZoomOut className="w-5 h-5 text-slate-600" />
          </button>
          <div className="w-10 h-10 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center">
            <Move className="w-5 h-5 text-slate-400" />
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 px-2 py-1 text-center text-xs text-slate-500 font-medium">
            {Math.round(viewScale * 100)}%
          </div>
        </div>

        <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm border border-slate-200 max-w-[200px]">
          <div className="text-xs font-semibold text-slate-700 mb-2 tracking-wide">图例</div>
          <div className="space-y-1.5 mb-3">
            <div className="text-[11px] text-slate-500 font-medium mb-1.5">点位状态</div>
            {statusItems.map((item) => {
              const cfg = getStatusConfig(item.status);
              return (
                <div key={item.status} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: cfg.dot }}
                  />
                  <span className="text-xs text-slate-600">{item.label}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-100 pt-2">
            <div className="text-[11px] text-slate-500 font-medium mb-1.5">街道区域</div>
            <div className="space-y-1.5">
              {streets.map((street) => {
                const color = getStreetColor(street.id);
                return (
                  <div key={street.id} className="flex items-center gap-2">
                    <span
                      className="w-4 h-3 rounded-sm inline-block shrink-0 border"
                      style={{ backgroundColor: color.fill, borderColor: color.stroke }}
                    />
                    <span className="text-xs text-slate-600 truncate">{street.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <svg
          viewBox="0 0 800 600"
          className="absolute inset-0 w-full h-full"
          style={{
            transform: `scale(${viewScale})`,
            transformOrigin: 'center center',
          }}
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="0.5" />
            </pattern>
            <pattern id="grid-small" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#F1F5F9" strokeWidth="0.3" />
            </pattern>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
            </filter>
          </defs>

          <rect width="800" height="600" fill="#F8FAFC" />
          <rect width="800" height="600" fill="url(#grid-small)" />
          <rect width="800" height="600" fill="url(#grid)" />

          {streets.map((street) => {
            const color = getStreetColor(street.id);
            const pointsStr = street.boundary
              .map((pt) => `${transformLngToX(pt[0])},${transformLatToY(pt[1])}`)
              .join(' ');
            const centerX = street.boundary.reduce((sum, pt) => sum + transformLngToX(pt[0]), 0) / street.boundary.length;
            const centerY = street.boundary.reduce((sum, pt) => sum + transformLatToY(pt[1]), 0) / street.boundary.length;
            return (
              <g key={street.id}>
                <polygon
                  points={pointsStr}
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth="2"
                  strokeDasharray="8 4"
                  strokeLinejoin="round"
                />
                <text
                  x={centerX}
                  y={centerY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color.stroke}
                  fontSize="13"
                  fontWeight="600"
                  className="select-none pointer-events-none"
                >
                  {street.name}
                </text>
              </g>
            );
          })}

          {points.map((point) => {
            const cfg = getStatusConfig(point.boundaryStatus);
            const cx = transformLngToX(point.lng);
            const cy = transformLatToY(point.lat);
            const isSelected = selectedPointId === point.id;
            const baseRadius = point.isBoundary ? 7 : 6;
            const radius = isSelected ? baseRadius + 2 : baseRadius;

            return (
              <g
                key={point.id}
                onClick={() => setSelectedPointId(point.id)}
                className="cursor-pointer"
              >
                {isSelected && (
                  <>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius + 10}
                      fill={cfg.dot}
                      fillOpacity="0.12"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius + 5}
                      fill="none"
                      stroke={cfg.dot}
                      strokeWidth="2"
                      strokeOpacity="0.5"
                      strokeDasharray="4 3"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${cx} ${cy}`}
                        to={`360 ${cx} ${cy}`}
                        dur="6s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </>
                )}
                {point.isBoundary && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius + 2}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                    strokeOpacity="0.6"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={cfg.dot}
                  stroke="white"
                  strokeWidth="2.5"
                  filter="url(#shadow)"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius / 2.5}
                  fill="white"
                  fillOpacity="0.7"
                />
                <text
                  x={cx + radius + 6}
                  y={cy - radius - 2}
                  fontSize="11"
                  fill="#334155"
                  fontWeight={isSelected ? '600' : '500'}
                  className="select-none pointer-events-none"
                  style={{ paintOrder: 'stroke' }}
                  stroke="white"
                  strokeWidth="3"
                  strokeLinejoin="round"
                >
                  {point.name}
                </text>
              </g>
            );
          })}

          {points.map((point) => {
            const cx = transformLngToX(point.lng);
            const cy = transformLatToY(point.lat);
            return (
              <g key={`label-${point.id}`}>
                <line
                  x1={cx}
                  y1={cy + 10}
                  x2={cx}
                  y2={cy + 20}
                  stroke="#94A3B8"
                  strokeWidth="0.8"
                  strokeDasharray="2 2"
                  strokeOpacity="0.4"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="w-[22rem] bg-white border-l border-slate-200 p-4 overflow-y-auto flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <MapPin className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-bold font-serif text-slate-800">点位列表</h2>
          <span className="ml-auto text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {points.length} 个
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {points.map((point) => {
            const cfg = getStatusConfig(point.boundaryStatus);
            const StatusIcon = cfg.Icon;
            const isSelected = selectedPointId === point.id;
            const streetNames = point.streetIds.map(getStreetName).join('、');

            return (
              <button
                key={point.id}
                onClick={() => setSelectedPointId(point.id)}
                className={`w-full text-left rounded-lg border p-3 transition-all duration-200 ${
                  isSelected
                    ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200 shadow-sm'
                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `${cfg.dot}1A` }}
                  >
                    <MapPin className="w-4 h-4" style={{ color: cfg.dot }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                        {point.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.bg} ${cfg.text}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="truncate">{streetNames}</span>
                    </div>
                    {point.isBoundary && (
                      <div className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        边界点位
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedPoint && (
          <div className="sticky bottom-0 bg-white border-t border-slate-200 -mx-4 -mb-4 px-4 py-4 mt-2">
            {locationState?.highlightPointId === selectedPointId && (
              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-700">
                  从业务页溯源返回，自动展开该点位详情
                </span>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3.5 py-3 bg-white border-b border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">
                      {selectedPoint.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 font-mono">
                      {selectedPoint.lng.toFixed(4)}°E, {selectedPoint.lat.toFixed(4)}°N
                    </div>
                  </div>
                  {(() => {
                    const cfg = getStatusConfig(selectedPoint.boundaryStatus);
                    const StatusIcon = cfg.Icon;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.text}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="p-3.5 space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-semibold text-slate-700">关联公交时段</span>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {pointSlots.length} 条
                    </span>
                  </div>
                  <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {pointSlots.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-slate-400">
                        暂无关联公交时段
                      </div>
                    ) : (
                      <>
                        {pointSlots.slice(0, 3).map((slot) => (
                          <div key={slot.id} className="px-3 py-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-700">
                                {slot.routeName}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {slot.startTime}-{slot.endTime}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-bold text-blue-600">
                                {slot.passengerCount}
                              </div>
                              <div className="text-[10px] text-slate-400">客流</div>
                            </div>
                          </div>
                        ))}
                        {pointSlots.length > 3 && (
                          <div className="px-3 py-2 text-xs text-slate-400 text-center">
                            还有 {pointSlots.length - 3} 条...
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleViewBusTime}
                    disabled={pointSlots.length === 0}
                    className="mt-2 w-full flex items-center justify-center gap-1 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                  >
                    <Clock className="w-4 h-4" />
                    查看关联时段
                    <ChevronRight className="w-4 h-4 -mr-1" />
                  </button>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-semibold text-slate-700">红线图备注</span>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {pointRemarks.length} 条
                    </span>
                  </div>
                  <div className="bg-white rounded-lg border border-slate-200">
                    {!latestRemark ? (
                      <div className="px-3 py-4 text-center text-xs text-slate-400">
                        暂无红线图备注
                      </div>
                    ) : (
                      <div className="px-3 py-3">
                        <div className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                          {latestRemark.content}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span>{latestRemark.createdByName}</span>
                          <span className="font-mono">v{latestRemark.version}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleViewRedlineRemark}
                    disabled={pointRemarks.length === 0}
                    className="mt-2 w-full flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    查看红线备注
                    <ChevronRight className="w-4 h-4 -mr-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

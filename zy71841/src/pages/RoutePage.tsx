import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, AlertTriangle, Info, MapPin, History, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/store';
import type { Conflict, RoutePoint } from '@/types';
import { formatDate } from '@/utils/helpers';
import { exportRouteComparison } from '@/utils/exporter';

export default function RoutePage() {
  const { exhibits, currentRoute, routes, setCurrentRoute, addRoutePoint, removeRoutePoint, updateRoutePoint, saveRoute, detectConflicts } = useAppStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [draggingPoint, setDraggingPoint] = useState<string | null>(null);
  const [routeName, setRouteName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const conflicts: Conflict[] = useMemo(() => detectConflicts(), [detectConflicts]);
  const conflictPointIds = useMemo(() => new Set(conflicts.map(c => c.routePointId)), [conflicts]);

  useEffect(() => {
    if (currentRoute) {
      setRouteName(currentRoute.name);
    }
  }, [currentRoute]);

  const getSvgCoords = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / scale,
      y: (e.clientY - rect.top - pan.y) / scale,
    };
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isPanning || draggingPoint) return;
    if (isDrawing) {
      const { x, y } = getSvgCoords(e);
      addRoutePoint(x, y);
    }
  };

  const handlePointMouseDown = (e: React.MouseEvent, pointId: string) => {
    e.stopPropagation();
    setDraggingPoint(pointId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingPoint) {
      const { x, y } = getSvgCoords(e);
      updateRoutePoint(draggingPoint, x, y);
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingPoint(null);
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleSave = () => {
    if (routeName.trim() && currentRoute && currentRoute.points.length > 1) {
      saveRoute(routeName.trim());
      setShowSaveModal(false);
    }
  };

  const generatePath = (points: RoutePoint[]) => {
    if (points.length < 2) return '';
    const sorted = [...points].sort((a, b) => a.order - b.order);
    let path = `M ${sorted[0].x} ${sorted[0].y}`;
    for (let i = 1; i < sorted.length; i++) {
      path += ` L ${sorted[i].x} ${sorted[i].y}`;
    }
    return path;
  };

  const getExhibitFill = (exhibitId: string) => {
    const hasConflict = conflicts.some(c => c.exhibitId === exhibitId);
    if (hasConflict) return 'rgba(239, 68, 68, 0.3)';
    if (exhibitId.startsWith('RECEP')) return 'rgba(59, 130, 246, 0.2)';
    if (exhibitId.startsWith('PILLAR')) return 'rgba(148, 163, 184, 0.4)';
    if (exhibitId.startsWith('LOUNGE')) return 'rgba(34, 197, 94, 0.2)';
    return 'rgba(59, 130, 246, 0.15)';
  };

  const getExhibitStroke = (exhibitId: string) => {
    const hasConflict = conflicts.some(c => c.exhibitId === exhibitId);
    if (hasConflict) return '#ef4444';
    return '#3b82f6';
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">路线规划</h1>
          <p className="text-slate-500">
            点击画布绘制讲解路线，系统自动检测与展品的冲突。按住 Alt 键拖拽可平移画布。
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-white rounded-lg border border-slate-200 p-1">
            <button
              className="p-2 hover:bg-slate-100 rounded transition-colors"
              onClick={() => setScale(s => Math.min(s + 0.1, 2))}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              className="p-2 hover:bg-slate-100 rounded transition-colors"
              onClick={() => setScale(s => Math.max(s - 0.1, 0.5))}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              className="p-2 hover:bg-slate-100 rounded transition-colors"
              onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          <button
            className={`btn ${isDrawing ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => setIsDrawing(!isDrawing)}
          >
            <Plus className={`w-4 h-4 mr-1 ${isDrawing ? '' : ''}`} />
            {isDrawing ? '停止绘制' : '开始绘制'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="w-4 h-4 mr-1" />
            历史版本 ({routes.length})
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowSaveModal(true)}
            disabled={!currentRoute || currentRoute.points.length < 2}
          >
            <Save className="w-4 h-4 mr-1" />
            保存路线
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => exportRouteComparison(routes)}
            disabled={routes.length < 2}
          >
            <Download className="w-4 h-4 mr-1" />
            导出对比
          </button>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-800 mb-2">
                检测到 {conflicts.length} 处路线冲突
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {conflicts.map((conflict, index) => (
                  <div key={index} className="bg-white/60 rounded p-2 text-sm">
                    <span className="text-red-700 font-medium">{conflict.exhibitName}</span>
                    <span className="text-red-500 text-xs ml-2">
                      距离: {conflict.distance.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm relative">
          {isDrawing && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-primary-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-pulse">
              点击画布添加路线点
            </div>
          )}
          
          <svg
            ref={svgRef}
            className="w-full h-full cursor-crosshair"
            style={{ cursor: isPanning ? 'grabbing' : isDrawing ? 'crosshair' : 'default' }}
            viewBox="0 0 300 320"
            preserveAspectRatio="xMidYMid meet"
            onClick={handleCanvasClick}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
              </pattern>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" />
              </filter>
            </defs>
            
            <g transform={`translate(${pan.x / scale}, ${pan.y / scale}) scale(${scale})`}>
              <rect width="300" height="320" fill="url(#grid)" />
              
              {exhibits.map(exhibit => (
                <g key={exhibit.id}>
                  <rect
                    x={exhibit.x}
                    y={exhibit.y}
                    width={exhibit.width}
                    height={exhibit.height}
                    fill={getExhibitFill(exhibit.id)}
                    stroke={getExhibitStroke(exhibit.id)}
                    strokeWidth={conflicts.some(c => c.exhibitId === exhibit.id) ? 2 : 1}
                    rx="3"
                    filter="url(#shadow)"
                    className={conflicts.some(c => c.exhibitId === exhibit.id) ? 'animate-pulse-slow' : ''}
                  />
                  <text
                    x={exhibit.x + exhibit.width / 2}
                    y={exhibit.y + exhibit.height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="7"
                    fill="#334155"
                    fontWeight="500"
                  >
                    {exhibit.name}
                  </text>
                </g>
              ))}

              {currentRoute && currentRoute.points.length > 1 && (
                <>
                  <path
                    d={generatePath(currentRoute.points)}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="6,4"
                    opacity="0.6"
                  />
                  <path
                    d={generatePath(currentRoute.points)}
                    fill="none"
                    stroke="#1a365d"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {currentRoute && currentRoute.points.map((point) => {
                const hasConflict = conflictPointIds.has(point.id);
                return (
                  <g key={point.id}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill={hasConflict ? '#ef4444' : '#1a365d'}
                      stroke="white"
                      strokeWidth="2"
                      className={`cursor-move ${hasConflict ? 'animate-pulse' : ''}`}
                      onMouseDown={(e) => handlePointMouseDown(e, point.id)}
                    />
                    <text
                      x={point.x}
                      y={point.y - 10}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#64748b"
                      fontWeight="600"
                    >
                      {point.order + 1}
                    </text>
                    {hasConflict && (
                      <g>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="10"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="1"
                          className="animate-ping"
                          opacity="0.5"
                        />
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {currentRoute && currentRoute.points.length > 0 && (
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex items-center space-x-4">
                <span className="text-slate-500">路线点数:</span>
                <span className="font-semibold text-slate-800">{currentRoute.points.length}</span>
                {currentRoute.version && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">版本:</span>
                    <span className="font-semibold text-primary-600">v{currentRoute.version}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {showHistory && (
          <div className="w-80 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">路线历史版本</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-full overflow-y-auto scrollbar-thin">
              {[...routes].reverse().map((route, index) => (
                <div
                  key={route.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    currentRoute?.id === route.id
                      ? 'bg-primary-50 border-l-4 border-primary-500'
                      : 'hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                  onClick={() => setCurrentRoute(route.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-slate-800">{route.name}</h4>
                    {route.isActive && (
                      <span className="badge bg-green-100 text-green-800 text-xs">当前</span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>版本</span>
                      <span className="font-mono">v{route.version}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>点数</span>
                      <span>{route.points.length} 个</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>修改人</span>
                      <span>{route.modifiedBy}</span>
                    </div>
                    <div className="pt-1 text-xs">
                      {formatDate(route.createdAt)}
                    </div>
                  </div>
                  {index < routes.length - 1 && (
                    <button
                      className="mt-3 w-full text-xs text-primary-600 hover:text-primary-700 text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      → 查看与上一版本差异
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="w-72 space-y-4">
          <div className="card p-4">
            <h4 className="font-semibold text-slate-800 mb-3 flex items-center">
              <Info className="w-4 h-4 mr-2 text-primary-500" />
              操作说明
            </h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start">
                <MapPin className="w-4 h-4 mr-2 mt-0.5 text-primary-500 flex-shrink-0" />
                <span>点击「开始绘制」后，在画布上点击添加路线点</span>
              </li>
              <li className="flex items-start">
                <Plus className="w-4 h-4 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                <span>路线点按顺序自动编号，可拖拽调整位置</span>
              </li>
              <li className="flex items-start">
                <Trash2 className="w-4 h-4 mr-2 mt-0.5 text-red-500 flex-shrink-0" />
                <span>右键点击路线点可删除</span>
              </li>
              <li className="flex items-start">
                <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 text-orange-500 flex-shrink-0" />
                <span>红色区域表示路线被展品挡住</span>
              </li>
            </ul>
          </div>

          {currentRoute && currentRoute.points.length > 0 && (
            <div className="card p-4">
              <h4 className="font-semibold text-slate-800 mb-3">路线点列表</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                {[...currentRoute.points]
                  .sort((a, b) => a.order - b.order)
                  .map((point) => {
                    const hasConflict = conflictPointIds.has(point.id);
                    return (
                      <div
                        key={point.id}
                        className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                          hasConflict ? 'bg-red-50 border border-red-200' : 'bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            hasConflict ? 'bg-red-500 text-white' : 'bg-primary-100 text-primary-700'
                          }`}>
                            {point.order + 1}
                          </span>
                          <span className="text-slate-700">
                            ({point.x.toFixed(0)}, {point.y.toFixed(0)})
                          </span>
                        </div>
                        <button
                          className="p-1 hover:bg-slate-200 rounded transition-colors"
                          onClick={() => removeRoutePoint(point.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="card p-4">
            <h4 className="font-semibold text-slate-800 mb-3">图例</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-4 rounded bg-blue-500/20 border border-blue-500" />
                <span className="text-slate-600">展车</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-4 rounded bg-slate-400/40 border border-slate-400" />
                <span className="text-slate-600">立柱/障碍物</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-4 rounded bg-green-500/20 border border-green-500" />
                <span className="text-slate-600">洽谈区</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-4 rounded bg-red-500/30 border-2 border-red-500" />
                <span className="text-slate-600">冲突区域</span>
              </div>
              <div className="flex items-center space-x-3">
                <svg className="w-8 h-4" viewBox="0 0 32 16">
                  <path d="M 2 8 L 30 8" fill="none" stroke="#1a365d" strokeWidth="1.5" strokeDasharray="4,2" />
                </svg>
                <span className="text-slate-600">讲解路线</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">保存路线</h3>
            <div className="mb-4">
              <label className="label">路线名称</label>
              <input
                type="text"
                className="input"
                placeholder="请输入路线名称"
                value={routeName}
                onChange={e => setRouteName(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">
                保存后将创建新版本，当前版本：v{currentRoute?.version || 1} → v{(currentRoute?.version || 0) + 1}
              </p>
            </div>
            <div className="flex items-center justify-end space-x-3">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSaveModal(false)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!routeName.trim()}
              >
                <Save className="w-4 h-4 mr-1" />
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ExhibitData, Waypoint, Route as RouteType, ConflictRecord } from '@/types';
import { generateSmoothCurvePoints } from '@/utils/routeCalculator';

interface RouteVisualizationProps {
  exhibits: ExhibitData[];
  routes: RouteType[];
  conflicts: ConflictRecord[];
  width?: number;
  height?: number;
}

export default function RouteVisualization({
  exhibits,
  routes,
  conflicts,
  width = 800,
  height = 500,
}: RouteVisualizationProps) {
  const padding = 60;
  
  const bounds = useMemo(() => {
    const allX = [
      ...exhibits.map((e) => e.x),
      ...routes.flatMap((r) => r.waypoints.map((w) => w.x)),
    ];
    const allY = [
      ...exhibits.map((e) => e.y),
      ...routes.flatMap((r) => r.waypoints.map((w) => w.y)),
    ];
    
    const minX = Math.min(...allX) - 5;
    const maxX = Math.max(...allX) + 5;
    const minY = Math.min(...allY) - 5;
    const maxY = Math.max(...allY) + 5;
    
    return { minX, maxX, minY, maxY };
  }, [exhibits, routes]);

  const scaleX = (x: number) => {
    return padding + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (width - padding * 2);
  };

  const scaleY = (y: number) => {
    return height - padding - ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * (height - padding * 2);
  };

  const getConflictForExhibit = (exhibitId: string) => {
    return conflicts.find((c) => c.exhibitId === exhibitId && c.status === 'pending');
  };

  const getEffectiveRadius = (exhibit: ExhibitData) => {
    const conflict = getConflictForExhibit(exhibit.exhibitId);
    if (conflict) {
      return {
        primary: exhibit.pointCloudRadius,
        secondary: conflict.safetyRadiusValue,
        hasConflict: true,
      };
    }
    return {
      primary: exhibit.safetyRadius || exhibit.pointCloudRadius,
      secondary: null,
      hasConflict: false,
    };
  };

  const svgRoutes = useMemo(() => {
    return routes.map((route, routeIdx) => {
      const smoothPoints = generateSmoothCurvePoints(route.waypoints, 30);
      const pathData = smoothPoints
        .map((p, i) => {
          const x = scaleX(p.x);
          const y = scaleY(p.y);
          return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        })
        .join(' ');

      return {
        id: route.id,
        pathData,
        isSupplementary: route.isSupplementary,
        reviewStatus: route.reviewStatus,
        length: route.calculatedLength,
        color: route.isSupplementary 
          ? (route.reviewStatus === 'pending' ? '#f97316' : '#f59e0b')
          : '#1e40af',
        dashArray: route.isSupplementary ? '8 4' : undefined,
        waypoints: route.waypoints.map((w) => ({
          x: scaleX(w.x),
          y: scaleY(w.y),
        })),
        routeIdx,
      };
    });
  }, [routes, bounds]);

  const svgExhibits = useMemo(() => {
    return exhibits.map((exhibit) => {
      const x = scaleX(exhibit.x);
      const y = scaleY(exhibit.y);
      const radiusInfo = getEffectiveRadius(exhibit);
      const conflict = getConflictForExhibit(exhibit.exhibitId);
      
      const scaleFactor = Math.min(
        (width - padding * 2) / (bounds.maxX - bounds.minX),
        (height - padding * 2) / (bounds.maxY - bounds.minY)
      );

      return {
        id: exhibit.exhibitId,
        name: exhibit.name,
        x,
        y,
        primaryRadius: radiusInfo.primary * scaleFactor,
        secondaryRadius: radiusInfo.secondary ? radiusInfo.secondary * scaleFactor : null,
        hasConflict: radiusInfo.hasConflict,
        conflict,
        radiusInfo,
      };
    });
  }, [exhibits, conflicts, bounds]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">展柜动线可视化</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-survey-600" />
            <span className="text-gray-600">主动线</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-warning-500 border-dashed" style={{ background: 'repeating-linear-gradient(to right, #f97316 0, #f97316 4px, transparent 4px, transparent 8px)' }} />
            <span className="text-gray-600">补录路线</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-danger-500/50 border border-danger-500" />
            <span className="text-gray-600">冲突</span>
          </div>
        </div>
      </div>
      
      <div className="relative" style={{ aspectRatio: `${width}/${height}` }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          <rect width="100%" height="100%" fill="url(#grid)" />

          {svgExhibits.map((exhibit) => (
            <g key={`radius-${exhibit.id}`}>
              {exhibit.secondaryRadius !== null && (
                <motion.circle
                  initial={{ r: 0, opacity: 0 }}
                  animate={{ r: exhibit.secondaryRadius, opacity: 0.3 }}
                  transition={{ duration: 0.5 }}
                  cx={exhibit.x}
                  cy={exhibit.y}
                  fill="#fef2f2"
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                />
              )}
              
              <motion.circle
                initial={{ r: 0, opacity: 0 }}
                animate={{ r: exhibit.primaryRadius, opacity: 0.2 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                cx={exhibit.x}
                cy={exhibit.y}
                fill={exhibit.hasConflict ? '#fef2f2' : '#dbeafe'}
                stroke={exhibit.hasConflict ? '#dc2626' : '#1e40af'}
                strokeWidth="1.5"
              />
            </g>
          ))}

          {svgRoutes.map((route) => (
            <g key={`route-${route.id}`}>
              <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1, delay: route.routeIdx * 0.3 }}
                d={route.pathData}
                fill="none"
                stroke={route.color}
                strokeWidth="3"
                strokeDasharray={route.dashArray}
                strokeLinecap="round"
                filter="url(#glow)"
              />
              
              {route.waypoints.map((wp, idx) => (
                <motion.circle
                  key={`wp-${route.id}-${idx}`}
                  initial={{ r: 0, opacity: 0 }}
                  animate={{ r: 4, opacity: 1 }}
                  transition={{ duration: 0.3, delay: route.routeIdx * 0.3 + 0.5 + idx * 0.05 }}
                  cx={wp.x}
                  cy={wp.y}
                  fill={route.color}
                  stroke="white"
                  strokeWidth="2"
                />
              ))}
            </g>
          ))}

          {svgExhibits.map((exhibit) => (
            <g key={`exhibit-${exhibit.id}`}>
              <motion.circle
                initial={{ r: 0 }}
                animate={{ r: 10 }}
                transition={{ duration: 0.3, delay: 0.8 }}
                cx={exhibit.x}
                cy={exhibit.y}
                fill="white"
                stroke={exhibit.hasConflict ? '#dc2626' : '#1e40af'}
                strokeWidth="2"
                className={exhibit.hasConflict ? 'animate-pulse' : ''}
              />
              
              <text
                x={exhibit.x}
                y={exhibit.y + 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill={exhibit.hasConflict ? '#dc2626' : '#1e40af'}
              >
                {exhibit.id.slice(-3)}
              </text>
              
              <motion.text
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 1 }}
                x={exhibit.x}
                y={exhibit.y + 25}
                textAnchor="middle"
                fontSize="11"
                fill="#475569"
                fontWeight="500"
              >
                {exhibit.name}
              </motion.text>
              
              {exhibit.conflict && (
                <motion.text
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 1.2 }}
                  x={exhibit.x}
                  y={exhibit.y - 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#dc2626"
                  fontWeight="bold"
                >
                  差{exhibit.conflict.diffValue}m
                </motion.text>
              )}
            </g>
          ))}

          {svgRoutes.map((route, idx) => (
            <g key={`label-${route.id}`}>
              <rect
                x={route.waypoints[Math.floor(route.waypoints.length / 2)].x - 40}
                y={route.waypoints[Math.floor(route.waypoints.length / 2)].y - 45}
                width="80"
                height="20"
                rx="4"
                fill="white"
                stroke={route.color}
                strokeWidth="1"
              />
              <text
                x={route.waypoints[Math.floor(route.waypoints.length / 2)].x}
                y={route.waypoints[Math.floor(route.waypoints.length / 2)].y - 31}
                textAnchor="middle"
                fontSize="11"
                fontWeight="500"
                fill={route.color}
              >
                {route.isSupplementary ? '补录' : '主'}线：{route.length.toFixed(2)}m
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
        <div>
          坐标范围：X({bounds.minX.toFixed(1)} ~ {bounds.maxX.toFixed(1)}), 
          Y({bounds.minY.toFixed(1)} ~ {bounds.maxY.toFixed(1)})
        </div>
        <div className="text-gray-400">
          共 {exhibits.length} 个展柜 · {routes.length} 条路线 · 
          总长 {routes.reduce((s, r) => s + r.calculatedLength, 0).toFixed(2)}m
        </div>
      </div>
    </div>
  );
}

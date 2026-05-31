import type { CoordinateData, Point } from '../../../shared/types';
import { pointsToSvgPath, getPointTypeColor } from '../utils/format';

interface CoordinatePlotProps {
  coordinates: CoordinateData;
  width?: number;
  height?: number;
  title?: string;
  highlight?: boolean;
}

export default function CoordinatePlot({
  coordinates,
  width = 400,
  height = 300,
  title,
  highlight = false,
}: CoordinatePlotProps) {
  const padding = 40;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const path = pointsToSvgPath(coordinates.points, innerWidth, innerHeight);

  return (
    <div className={`bg-white border-2 rounded-lg overflow-hidden ${highlight ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'}`}>
      {title && (
        <div className="px-4 py-2 bg-slate-50 border-b-2 border-slate-200">
          <h4 className="font-medium text-sm text-slate-700">{title}</h4>
        </div>
      )}
      <div className="p-4">
        <svg width={width} height={height} className="bg-slate-50 rounded">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          
          <rect
            x={padding}
            y={padding}
            width={innerWidth}
            height={innerHeight}
            fill="url(#grid)"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          
          {path && (
            <path
              d={path}
              transform={`translate(${padding}, ${padding})`}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeDasharray="5,3"
            />
          )}
          
          {coordinates.points.map((point, index) => {
            const scaleX = innerWidth / 600;
            const scaleY = innerHeight / 600;
            const x = point.x * scaleX + padding;
            const y = point.y * scaleY + padding;
            const color = getPointTypeColor(point.type);
            
            return (
              <g key={point.id}>
                <circle
                  cx={x}
                  cy={y}
                  r="8"
                  fill="white"
                  stroke={color}
                  strokeWidth="2"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill={color}
                />
                <text
                  x={x + 12}
                  y={y - 8}
                  fontSize="11"
                  fill="#475569"
                  fontWeight="500"
                >
                  {point.label}
                </text>
                <text
                  x={x + 12}
                  y={y + 16}
                  fontSize="9"
                  fill="#94a3b8"
                  fontFamily="monospace"
                >
                  ({point.x}, {point.y})
                </text>
              </g>
            );
          })}
          
          <circle
            cx={coordinates.centerX * (innerWidth / 600) + padding}
            cy={coordinates.centerY * (innerHeight / 600) + padding}
            r="4"
            fill="#EF4444"
            fillOpacity="0.5"
          />
        </svg>
        
        <div className="mt-3 flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getPointTypeColor('cad') }}></span>
            <span className="text-slate-600">CAD点位</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getPointTypeColor('route') }}></span>
            <span className="text-slate-600">讲解路线</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getPointTypeColor('device') }}></span>
            <span className="text-slate-600">设备点位</span>
          </div>
        </div>
      </div>
    </div>
  );
}

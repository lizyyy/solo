import { useStore } from '@/store/useStore';

const SVG_W = 400;
const SVG_H = 360;
const PAD = 30;

function getSpotColor(temp: number, critical: number, warning: number): string {
  if (temp >= critical) return '#ef4444';
  if (temp >= warning) return '#f59e0b';
  return '#22c55e';
}

function getSpotRadius(temp: number, maxTemp: number): number {
  if (maxTemp === 0) return 8;
  return 6 + (temp / maxTemp) * 10;
}

export default function SceneView() {
  const { records, selectedRecord, selectRecord, currentScheme } = useStore();

  const critical = currentScheme?.criticalThreshold ?? 120;
  const warning = currentScheme?.warningThreshold ?? 80;

  const coordXs = records.map((r) => r.coordinateX);
  const coordYs = records.map((r) => r.coordinateY);
  const minX = Math.min(...coordXs, 0);
  const maxX = Math.max(...coordXs, 100);
  const minY = Math.min(...coordYs, 0);
  const maxY = Math.max(...coordYs, 100);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const maxTemp = Math.max(...records.map((r) => r.temperature), 1);

  function mapX(x: number) {
    return PAD + ((x - minX) / rangeX) * (SVG_W - PAD * 2);
  }
  function mapY(y: number) {
    return PAD + ((y - minY) / rangeY) * (SVG_H - PAD * 2);
  }

  const isCoordInconsistent = (cs: string) =>
    currentScheme && cs !== currentScheme.coordinateSystem;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 flex items-center justify-center">
        <svg width={SVG_W} height={SVG_H} className="bg-gray-900/50 rounded">
          <rect
            x={PAD}
            y={PAD}
            width={SVG_W - PAD * 2}
            height={SVG_H - PAD * 2}
            fill="none"
            stroke="#4b5563"
            strokeWidth={1.5}
            rx={4}
          />
          <line
            x1={SVG_W / 2}
            y1={PAD}
            x2={SVG_W / 2}
            y2={SVG_H - PAD}
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
          <line
            x1={PAD}
            y1={SVG_H / 2}
            x2={SVG_W - PAD}
            y2={SVG_H / 2}
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="4,4"
          />

          {records.map((r) => {
            const cx = mapX(r.coordinateX);
            const cy = mapY(r.coordinateY);
            const color = getSpotColor(r.temperature, critical, warning);
            const radius = getSpotRadius(r.temperature, maxTemp);
            const inconsistent = isCoordInconsistent(r.coordinateSystem);
            const isSelected = selectedRecord?.id === r.id;

            return (
              <g key={r.id} onClick={() => selectRecord(r)} style={{ cursor: 'pointer' }}>
                {isSelected && (
                  <circle cx={cx} cy={cy} r={radius + 5} fill="none" stroke="#f59e0b" strokeWidth={2} />
                )}
                {inconsistent ? (
                  <>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="3,3"
                    />
                    <text
                      x={cx}
                      y={cy - radius - 4}
                      textAnchor="middle"
                      fill="#3b82f6"
                      fontSize={9}
                    >
                      坐标系: {r.coordinateSystem}
                    </text>
                  </>
                ) : (
                  <circle cx={cx} cy={cy} r={radius} fill={color} fillOpacity={0.7} />
                )}
                <text
                  x={cx + radius + 3}
                  y={cy + 3}
                  fill="#d1d5db"
                  fontSize={9}
                >
                  {r.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center gap-4 pt-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
          ≥{critical}°C 严重
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
          ≥{warning}°C 警告
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
          &lt;{warning}°C 正常
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-gray-400" />
          坐标系不一致
        </span>
      </div>
    </div>
  );
}

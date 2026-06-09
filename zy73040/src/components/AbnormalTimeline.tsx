import { useMemo, useRef, useState } from 'react';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import type { WorkOrder } from '@/types';
import { AlertTriangle, ShieldBan, ChevronDown } from 'lucide-react';

export default function AbnormalTimeline() {
  const workOrders = usePlaybackStore((s) => s.workOrders);
  const selectedOrderId = usePlaybackStore((s) => s.selectedOrderId);
  const selectOrder = usePlaybackStore((s) => s.selectOrder);
  const highlightAbnormal = usePlaybackStore((s) => s.highlightAbnormal);
  const highlightId = usePlaybackStore((s) => s.highlightAbnormalId);
  const setScrollTarget = usePlaybackStore((s) => s.setScrollTarget);
  const timelineData = usePlaybackStore((s) => s.abnormalTimeline);
  const [hoverEvent, setHoverEvent] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number; text: string; type: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { minDate, maxDate, totalHours } = useMemo(() => {
    const allDates: Date[] = [];
    workOrders.forEach((o) => {
      allDates.push(new Date(o.plannedStartTime.replace(' ', 'T')));
      allDates.push(new Date(o.plannedEndTime.replace(' ', 'T')));
      o.spareParts.forEach((sp) => {
        allDates.push(new Date(sp.requiredByTime.replace(' ', 'T')));
        allDates.push(new Date(sp.actualArrivalTime.replace(' ', 'T')));
        if (sp.replacement) allDates.push(new Date(sp.replacement.applyTime.replace(' ', 'T')));
      });
    });
    allDates.push(...timelineData.map((e) => e.startTime));
    allDates.push(...timelineData.map((e) => e.endTime));
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())) - 12 * 3600000);
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())) + 12 * 3600000);
    return { minDate: min, maxDate: max, totalHours: (max.getTime() - min.getTime()) / 3600000 };
  }, [workOrders, timelineData]);

  const CHART_LEFT = 140;
  const CHART_RIGHT = 40;
  const ROW_HEIGHT = 64;
  const ROW_GAP = 12;
  const HEADER_HEIGHT = 56;
  const TICK_HEIGHT = 24;

  const width = 1100;
  const chartInnerWidth = width - CHART_LEFT - CHART_RIGHT;
  const totalRows = workOrders.length;
  const height = HEADER_HEIGHT + TICK_HEIGHT + totalRows * (ROW_HEIGHT + ROW_GAP) + 20;

  const xForDate = (d: Date) => CHART_LEFT + ((d.getTime() - minDate.getTime()) / 3600000 / totalHours) * chartInnerWidth;

  const handleEventClick = (orderId: string, sparePartId?: string) => {
    selectOrder(orderId);
    if (sparePartId) {
      highlightAbnormal(sparePartId);
      setTimeout(() => {
        setScrollTarget(`sparepart-${sparePartId}`);
      }, 100);
    }
    setTimeout(() => {
      setScrollTarget('spare-parts-section');
    }, 50);
  };

  const renderWorkOrderRow = (o: WorkOrder, idx: number) => {
    const y = HEADER_HEIGHT + TICK_HEIGHT + idx * (ROW_HEIGHT + ROW_GAP);
    const woStart = new Date(o.plannedStartTime.replace(' ', 'T'));
    const woEnd = new Date(o.plannedEndTime.replace(' ', 'T'));
    const x1 = xForDate(woStart);
    const x2 = xForDate(woEnd);
    const barW = x2 - x1;
    const centerY = y + ROW_HEIGHT / 2;

    const isSelected = o.id === selectedOrderId;
    const statusColor =
      o.status === 'smooth' ? 'bg-jade-400' : o.status === 'supplement' ? 'bg-amber-400' : 'bg-coral-400';
    const statusLabel = o.status === 'smooth' ? '顺利' : o.status === 'supplement' ? '补录' : '异常';

    return (
      <g key={o.id} className="cursor-pointer" onClick={() => selectOrder(o.id)}>
        {isSelected && (
          <rect x={4} y={y - 4} width={width - 8} height={ROW_HEIGHT + 8} rx={4} fill="#F0F4FA" stroke="#0A2342" strokeWidth={1.5} />
        )}
        <rect x={0} y={y} width={6} height={ROW_HEIGHT} className={statusColor} rx={2} />
        <text x={18} y={y + 22} className="text-[12px] font-bold fill-coolgray-700" fontFamily="inherit">
          {o.orderNo}
        </text>
        <text x={18} y={y + 40} className="text-[11px] fill-coolgray-500" fontFamily="inherit">
          {o.pumpStationName}
        </text>
        <text x={18} y={y + 56} className="text-[10px] fill-coolgray-400" fontFamily="inherit">
          {o.plannedStartTime.slice(5, 16)}
        </text>

        <rect
          x={x1}
          y={centerY - 10}
          width={barW}
          height={20}
          rx={3}
          fill={isSelected ? '#D6E0F0' : '#E8ECEF'}
          stroke={isSelected ? '#3F5A8A' : '#A9B2BD'}
          strokeWidth={1}
        />
        <text
          x={(x1 + x2) / 2}
          y={centerY + 4}
          textAnchor="middle"
          className="text-[10px] fill-coolgray-600 font-medium"
          fontFamily="inherit"
          pointerEvents="none"
        >
          {statusLabel} · {Math.round((woEnd.getTime() - woStart.getTime()) / 3600000)}h窗口
        </text>

        {o.spareParts.map((sp) => {
          if (sp.status === 'normal') return null;
          const spId = `ab-${o.id}-${sp.id}`;
          const isHighlight = highlightId === sp.id;
          let evStart: Date, evEnd: Date, color: string, icon: typeof AlertTriangle, label: string;
          if (sp.status === 'delayed') {
            evStart = new Date(sp.requiredByTime.replace(' ', 'T'));
            evEnd = new Date(sp.actualArrivalTime.replace(' ', 'T'));
            color = '#FF6B4A';
            icon = AlertTriangle;
            const mins = Math.round((evEnd.getTime() - evStart.getTime()) / 60000);
            label = `延误${mins}分钟`;
          } else {
            evStart = sp.replacement ? new Date(sp.replacement.applyTime.replace(' ', 'T')) : new Date(sp.requiredByTime.replace(' ', 'T'));
            evEnd = new Date(sp.actualArrivalTime.replace(' ', 'T'));
            color = '#0A2342';
            icon = ShieldBan;
            const hrs = Math.round((evEnd.getTime() - evStart.getTime()) / 3600000);
            label = `替换拦截${hrs}h`;
          }
          const ex1 = xForDate(evStart);
          const ex2 = xForDate(evEnd);
          const ew = Math.max(ex2 - ex1, 10);
          const eventY = centerY + 10;
          const isHover = hoverEvent === spId;

          return (
            <g
              key={spId}
              onClick={(e) => {
                e.stopPropagation();
                handleEventClick(o.id, sp.id);
              }}
              onMouseEnter={(e) => {
                setHoverEvent(spId);
                const rect = svgRef.current?.getBoundingClientRect();
                if (rect) setTipPos({ x: ex1 + ew / 2, y: eventY - ROW_HEIGHT / 2, text: `${sp.name} - ${label}`, type: sp.status });
              }}
              onMouseMove={(e) => {
                const rect = svgRef.current?.getBoundingClientRect();
                if (rect) {
                  const x = (e.clientX - rect.left) * (width / rect.width);
                  const y = (e.clientY - rect.top) * (height / rect.height);
                  setTipPos((prev) => (prev ? { ...prev, x, y: y - 16 } : null));
                }
              }}
              onMouseLeave={() => {
                setHoverEvent(null);
                setTipPos(null);
              }}
              style={{ cursor: 'pointer' }}
            >
              <line
                x1={ex1}
                y1={centerY}
                x2={ex1}
                y2={eventY - 2}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray={isHighlight ? '0' : '2,2'}
                opacity={0.7}
              />
              <rect
                x={ex1}
                y={eventY}
                width={ew}
                height={16}
                rx={3}
                fill={color}
                opacity={isHover || isHighlight ? 1 : 0.88}
                stroke={isHighlight ? '#0A2342' : 'none'}
                strokeWidth={isHighlight ? 2.5 : 0}
              >
                {isHighlight && (
                  <animate attributeName="opacity" values="0.88;1;0.88" dur="1.5s" repeatCount="indefinite" />
                )}
              </rect>
              {ew > 70 && (
                <text x={ex1 + ew / 2} y={eventY + 11.5} textAnchor="middle" fill="white" fontSize={9} fontFamily="inherit" fontWeight={600} pointerEvents="none">
                  {label}
                </text>
              )}
              <circle cx={ex1} cy={centerY} r={4.5} fill={color} stroke="white" strokeWidth={1.5} />
            </g>
          );
        })}
      </g>
    );
  };

  const tickHours = Math.ceil(totalHours / 8);
  const ticks: Date[] = [];
  for (let i = 0; i <= 8; i++) {
    ticks.push(new Date(minDate.getTime() + (i * totalHours * 3600000) / 8));
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">
          <AlertTriangle className="w-4 h-4" />
          异常时间轴总览
        </h2>
        <div className="flex items-center gap-4 text-xs text-coolgray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-coral-400" />到货延误
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-navy-500" />替换拦截
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-sm bg-coolgray-200 border border-coolgray-300" />停机窗口
          </span>
          <span className="text-navy-500 font-medium flex items-center gap-1">
            点击异常块跳转详情
            <ChevronDown className="w-3 h-3 animate-bounce" />
          </span>
        </div>
      </div>
      <div className="overflow-x-auto -mx-2 px-2">
        <div className="min-w-[1000px] relative">
          <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            <defs>
              <linearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F7F9FA" stopOpacity="1" />
                <stop offset="100%" stopColor="#E8ECEF" stopOpacity="0" />
              </linearGradient>
            </defs>

            <rect x={0} y={0} width={width} height={height} fill="url(#gridGrad)" />

            {ticks.map((t, i) => {
              const x = xForDate(t);
              return (
                <g key={i}>
                  <line x1={x} y1={HEADER_HEIGHT} x2={x} y2={height - 10} stroke="#D1D7DE" strokeWidth={0.5} strokeDasharray={i === 0 || i === ticks.length - 1 ? '0' : '3,4'} />
                  <text x={x} y={HEADER_HEIGHT + TICK_HEIGHT - 6} textAnchor="middle" fontSize={10} fill="#838F9C" fontFamily="inherit">
                    {t.getMonth() + 1}/{t.getDate()} {String(t.getHours()).padStart(2, '0')}:00
                  </text>
                </g>
              );
            })}

            <line x1={CHART_LEFT} y1={HEADER_HEIGHT + TICK_HEIGHT - 1} x2={width - CHART_RIGHT} y2={HEADER_HEIGHT + TICK_HEIGHT - 1} stroke="#A9B2BD" strokeWidth={1} />

            {workOrders.map(renderWorkOrderRow)}
          </svg>

          {tipPos && (
            <div
              className="absolute pointer-events-none z-20 bg-navy-700 text-white text-xs px-2.5 py-1.5 rounded-sm shadow-lg animate-slide-down whitespace-nowrap"
              style={{
                left: `${(tipPos.x / width) * 100}%`,
                top: `${(tipPos.y / height) * 100}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              {tipPos.text}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-navy-700 rotate-45" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import type { Seat, AcousticReading, DisplayParameter } from '../../data/models/acoustic';
import { DISPLAY_PARAM_LABELS, DISPLAY_PARAM_UNITS } from '../../data/models/acoustic';
import { getParameterColor } from '../../utils/colorMap';

interface SeatTooltipProps {
  hoveredSeat: Seat | null;
  reading: AcousticReading | undefined;
  displayParam: DisplayParameter;
}

export function SeatTooltip({ hoveredSeat, reading, displayParam }: SeatTooltipProps) {
  const { camera, gl } = useThree();
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hoveredSeat) {
      setVisible(false);
      return;
    }

    const position = new THREE.Vector3(
      hoveredSeat.position.x,
      hoveredSeat.position.y + 1,
      hoveredSeat.position.z
    );

    position.project(camera);

    const canvas = gl.domElement;
    const rect = canvas.getBoundingClientRect();

    const x = (position.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-position.y * 0.5 + 0.5) * rect.height + rect.top;

    setScreenPos({ x, y });
    setVisible(true);
  }, [hoveredSeat, camera, gl]);

  if (!hoveredSeat || !visible) return null;

  const value = reading ? reading[displayParam] : null;
  const valueColor = value ? getParameterColor(value, displayParam, true) : null;

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: screenPos.x + 15,
        top: screenPos.y - 10,
        transform: 'translateY(-100%)',
      }}
    >
      <div className="px-4 py-3 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl min-w-56">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: valueColor 
                  ? `rgb(${valueColor.r * 255}, ${valueColor.g * 255}, ${valueColor.b * 255})`
                  : '#666',
              }}
            >
              <span className="text-sm font-bold text-white">{hoveredSeat.row}</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {hoveredSeat.row}排 {hoveredSeat.number}座
              </p>
              <p className="text-xs text-slate-400">{hoveredSeat.area}</p>
            </div>
          </div>
          {hoveredSeat.isVip && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold">
              VIP
            </span>
          )}
        </div>

        {reading ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{DISPLAY_PARAM_LABELS[displayParam]}</span>
              <span
                className="text-lg font-bold"
                style={{
                  color: valueColor
                    ? `rgb(${valueColor.r * 255}, ${valueColor.g * 255}, ${valueColor.b * 255})`
                    : '#fff',
                }}
              >
                {value?.toFixed(2)}
                <span className="text-xs font-normal text-slate-500 ml-1">
                  {DISPLAY_PARAM_UNITS[displayParam]}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">混响时间</span>
              <span className="text-slate-300 font-mono">{reading.reverberationTime.toFixed(2)} s</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">声压级</span>
              <span className="text-slate-300 font-mono">{reading.soundPressureLevel.toFixed(1)} dB</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">清晰度</span>
              <span className="text-slate-300 font-mono">{reading.clarity.toFixed(2)} dB</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-red-400">
            ⚠️ 该座位缺少声学读数
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <p className="text-xs text-slate-500">
            点击查看详细信息
          </p>
        </div>
      </div>

      <div
        className="absolute left-4 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-slate-900/95"
      />
    </div>
  );
}

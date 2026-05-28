import { X, Crown, MapPin, Clock, Volume2, Zap, Target } from 'lucide-react';
import type { Seat, AcousticReading, DisplayParameter } from '../../data/models/acoustic';
import { DISPLAY_PARAM_LABELS, DISPLAY_PARAM_UNITS } from '../../data/models/acoustic';
import { getParameterColor } from '../../utils/colorMap';

interface InfoPanelProps {
  selectedSeat: (Seat & { reading?: AcousticReading }) | null;
  displayParam: DisplayParameter;
  onClose: () => void;
}

export function InfoPanel({ selectedSeat, displayParam, onClose }: InfoPanelProps) {
  if (!selectedSeat) return null;

  const reading = selectedSeat.reading;

  const getStatusBadge = (value: number, param: DisplayParameter) => {
    let status: 'optimal' | 'good' | 'fair' | 'poor';
    let color: string;

    if (param === 'reverberationTime') {
      if (value >= 1.6 && value <= 2.0) {
        status = 'optimal';
        color = 'text-emerald-400 bg-emerald-500/20 border-emerald-400/30';
      } else if (value >= 1.4 && value <= 2.2) {
        status = 'good';
        color = 'text-blue-400 bg-blue-500/20 border-blue-400/30';
      } else if (value >= 1.2 && value <= 2.4) {
        status = 'fair';
        color = 'text-amber-400 bg-amber-500/20 border-amber-400/30';
      } else {
        status = 'poor';
        color = 'text-red-400 bg-red-500/20 border-red-400/30';
      }
    } else if (param === 'soundPressureLevel') {
      if (value >= 80 && value <= 90) {
        status = 'optimal';
        color = 'text-emerald-400 bg-emerald-500/20 border-emerald-400/30';
      } else if (value >= 75 && value <= 95) {
        status = 'good';
        color = 'text-blue-400 bg-blue-500/20 border-blue-400/30';
      } else if (value >= 70 && value <= 100) {
        status = 'fair';
        color = 'text-amber-400 bg-amber-500/20 border-amber-400/30';
      } else {
        status = 'poor';
        color = 'text-red-400 bg-red-500/20 border-red-400/30';
      }
    } else {
      if (value >= 3 && value <= 6) {
        status = 'optimal';
        color = 'text-emerald-400 bg-emerald-500/20 border-emerald-400/30';
      } else if (value >= 1 && value <= 8) {
        status = 'good';
        color = 'text-blue-400 bg-blue-500/20 border-blue-400/30';
      } else {
        status = 'fair';
        color = 'text-amber-400 bg-amber-500/20 border-amber-400/30';
      }
    }

    const labelMap = {
      optimal: '最优',
      good: '良好',
      fair: '一般',
      poor: '待优化',
    };

    return { status, color, label: labelMap[status] };
  };

  const currentValue = reading ? reading[displayParam] : null;
  const statusBadge = currentValue ? getStatusBadge(currentValue, displayParam) : null;
  const valueColor = currentValue ? getParameterColor(currentValue, displayParam, true) : null;

  return (
    <div className="w-80 bg-slate-900/90 backdrop-blur-md border-l border-slate-700/50 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-wide">座位详情</h2>
          <p className="text-xs text-slate-400 mt-1">当前选中座位的声学参数</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: valueColor ? `rgb(${valueColor.r * 255}, ${valueColor.g * 255}, ${valueColor.b * 255})` : '#666',
                }}
              >
                <span className="text-xl font-bold text-white">
                  {selectedSeat.row}
                </span>
              </div>
              <div>
                <p className="text-xl font-bold text-white">
                  {selectedSeat.row}排 {selectedSeat.number}座
                </p>
                <p className="text-sm text-slate-400">{selectedSeat.area}</p>
              </div>
            </div>
            {selectedSeat.isVip && (
              <div className="px-2 py-1 rounded-md bg-amber-500/20 border border-amber-400/30 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">VIP</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-300">
            <MapPin className="w-4 h-4 text-slate-500" />
            <span>
              坐标: ({selectedSeat.position.x.toFixed(1)}, {selectedSeat.position.y.toFixed(1)}, {selectedSeat.position.z.toFixed(1)})
            </span>
          </div>
        </div>

        {statusBadge && (
          <div className={`px-3 py-2 rounded-lg border text-center ${statusBadge.color}`}>
            <span className="text-sm font-semibold">当前参数状态: {statusBadge.label}</span>
          </div>
        )}

        {reading ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">声学参数</h3>
            
            <ReadingItem
              icon={<Clock className="w-4 h-4" />}
              label="混响时间 (RT60)"
              value={`${reading.reverberationTime.toFixed(3)} s`}
              highlight={displayParam === 'reverberationTime'}
              optimal="1.6 - 2.0 s"
            />

            <ReadingItem
              icon={<Volume2 className="w-4 h-4" />}
              label="声压级 (SPL)"
              value={`${reading.soundPressureLevel.toFixed(1)} dB`}
              highlight={displayParam === 'soundPressureLevel'}
              optimal="80 - 90 dB"
            />

            <ReadingItem
              icon={<Zap className="w-4 h-4" />}
              label="清晰度 (C80)"
              value={`${reading.clarity.toFixed(2)} dB`}
              highlight={displayParam === 'clarity'}
              optimal="3 - 6 dB"
            />

            <ReadingItem
              icon={<Target className="w-4 h-4" />}
              label="定义度 (D50)"
              value={`${reading.definition.toFixed(1)} %`}
              highlight={false}
              optimal="> 50 %"
            />
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-400/30">
            <p className="text-sm text-red-400">⚠️ 该座位缺少声学读数数据</p>
            <p className="text-xs text-slate-500 mt-1">可能是采样错误或数据缺失</p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">当前显示</h3>
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <p className="text-sm text-slate-400">{DISPLAY_PARAM_LABELS[displayParam]}</p>
            {currentValue && (
              <p className="text-2xl font-bold mt-1" style={{ color: valueColor ? `rgb(${valueColor.r * 255}, ${valueColor.g * 255}, ${valueColor.b * 255})` : '#fff' }}>
                {currentValue.toFixed(2)} <span className="text-sm font-normal text-slate-500">{DISPLAY_PARAM_UNITS[displayParam]}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReadingItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  optimal: string;
  highlight: boolean;
}

function ReadingItem({ icon, label, value, optimal, highlight }: ReadingItemProps) {
  return (
    <div
      className={`p-3 rounded-lg transition-all ${
        highlight
          ? 'bg-blue-500/20 border border-blue-400/40'
          : 'bg-slate-800/30 border border-slate-700/50'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={highlight ? 'text-blue-400' : 'text-slate-500'}>{icon}</span>
          <span className={`text-sm ${highlight ? 'text-blue-300' : 'text-slate-400'}`}>{label}</span>
        </div>
        <span className={`text-lg font-bold ${highlight ? 'text-blue-300' : 'text-slate-200'}`}>
          {value}
        </span>
      </div>
      <div className="text-xs text-slate-500 pl-6">
        最优范围: {optimal}
      </div>
    </div>
  );
}

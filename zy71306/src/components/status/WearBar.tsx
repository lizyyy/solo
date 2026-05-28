import { useCalibrationStore } from '../../store/calibrationStore';
import { getWearLevelDescription } from '../../services/wearService';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function WearBar() {
  const { wearLevel } = useCalibrationStore();

  const getWearColor = () => {
    if (wearLevel < 30) return 'text-success-500';
    if (wearLevel < 60) return 'text-amber-500';
    return 'text-danger-500';
  };

  const getWearBgColor = () => {
    if (wearLevel < 30) return 'bg-success-500';
    if (wearLevel < 60) return 'bg-amber-500';
    return 'bg-danger-500';
  };

  const getWearIcon = () => {
    if (wearLevel < 30) return <CheckCircle size={20} className="text-success-500" />;
    if (wearLevel < 60) return <AlertTriangle size={20} className="text-amber-500" />;
    return <XCircle size={20} className="text-danger-500" />;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getWearIcon()}
          <span className="text-sm font-medium text-brass-300">磨损程度</span>
        </div>
        <span className={`font-mono text-2xl font-bold ${getWearColor()}`}>
          {Math.round(wearLevel)}%
        </span>
      </div>

      <div className="relative h-6 bg-walnut-700 rounded-lg overflow-hidden">
        <div className="absolute inset-0 flex">
          <div className="flex-1 bg-success-500/30" />
          <div className="flex-1 bg-amber-500/30" />
          <div className="flex-1 bg-danger-500/30" />
        </div>
        <div
          className={`absolute top-0 left-0 h-full ${getWearBgColor()} transition-all duration-500`}
          style={{ width: `${wearLevel}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
      </div>

      <div className="flex justify-between text-xs text-walnut-500">
        <span className="text-success-500">轻微</span>
        <span className="text-amber-500">中度</span>
        <span className="text-danger-500">严重</span>
      </div>

      <p className={`text-sm ${getWearColor()} text-center`}>
        {getWearLevelDescription(wearLevel)}
      </p>
    </div>
  );
}

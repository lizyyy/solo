import { useState, useCallback } from 'react';
import { Settings, RotateCcw, Zap, Target, Layers, ChevronDown, ChevronUp, AlertTriangle, Edit3 } from 'lucide-react';
import { useSwingStore } from '@/store/useSwingStore';
import { toDegrees } from '@/utils/swingMath';
import { getAnomalyTypeLabel, getSeverityColor } from '@/utils/anomalyDetector';
import { getSupplementForFrame } from '@/utils/versionControl';

interface ParameterCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function ParameterCard({ title, icon, children, defaultOpen = true }: ParameterCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="bg-golf-bg-light border border-golf-border rounded-lg overflow-hidden mb-2 transition-all duration-200 hover:border-golf-blue/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-golf-bg-lighter/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-golf-blue">{icon}</span>
          <span className="text-golf-text font-medium text-sm">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-golf-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-golf-text-muted" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-golf-border/50">
          {children}
        </div>
      )}
    </div>
  );
}

interface NumericInputProps {
  label: string;
  value: number;
  unit?: string;
  onChange: (value: number) => void;
  step?: number;
  decimals?: number;
  isAnomaly?: boolean;
  isSupplemented?: boolean;
  supplementInfo?: string;
}

function NumericInput({ 
  label, 
  value, 
  unit = '', 
  onChange, 
  step = 0.01, 
  decimals = 2,
  isAnomaly = false,
  isSupplemented = false,
  supplementInfo,
}: NumericInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  
  const handleBlur = useCallback(() => {
    const num = parseFloat(editValue);
    if (!isNaN(num)) {
      onChange(num);
    }
    setIsEditing(false);
  }, [editValue, onChange]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditValue(value.toString());
      setIsEditing(false);
    }
  };
  
  const increment = () => {
    onChange(parseFloat((value + step).toFixed(decimals)));
  };
  
  const decrement = () => {
    onChange(parseFloat((value - step).toFixed(decimals)));
  };
  
  const borderClass = isAnomaly 
    ? 'border-golf-red shadow-neon-red' 
    : isSupplemented 
      ? 'border-dashed border-golf-orange' 
      : 'border-golf-border focus-within:border-golf-blue';
  
  return (
    <div className="mb-3 last:mb-0 relative">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-golf-text-muted">{label}</label>
        {isAnomaly && <AlertTriangle className="w-3 h-3 text-golf-red animate-pulse" />}
        {isSupplemented && (
          <span className="text-[10px] px-1.5 py-0.5 bg-golf-orange/20 text-golf-orange rounded">
            补录
          </span>
        )}
      </div>
      <div className={`flex items-center bg-golf-bg border rounded-md overflow-hidden transition-all ${borderClass}`}>
        {isEditing ? (
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            step={step}
            autoFocus
            className="flex-1 bg-transparent px-3 py-2 text-golf-text font-mono text-sm outline-none"
          />
        ) : (
          <div 
            onClick={() => setIsEditing(true)}
            className="flex-1 px-3 py-2 text-golf-text font-mono text-sm cursor-pointer hover:bg-golf-bg-lighter/50 transition-colors flex items-center justify-between"
          >
            <span>{value.toFixed(decimals)}</span>
            <Edit3 className="w-3 h-3 text-golf-text-dim opacity-0 group-hover:opacity-100" />
          </div>
        )}
        <div className="flex flex-col border-l border-golf-border">
          <button 
            onClick={increment}
            className="px-2 py-1 hover:bg-golf-bg-lighter text-golf-text-muted hover:text-golf-blue transition-colors"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button 
            onClick={decrement}
            className="px-2 py-1 hover:bg-golf-bg-lighter text-golf-text-muted hover:text-golf-blue transition-colors border-t border-golf-border"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>
      {unit && (
        <span className="text-xs text-golf-text-dim ml-2">{unit}</span>
      )}
      {supplementInfo && (
        <div className="text-[10px] text-golf-orange mt-1">{supplementInfo}</div>
      )}
    </div>
  );
}

export function ParameterPanel() {
  const { 
    currentSession, 
    selectedFrameIndex, 
    updateParameter,
    activePanel,
  } = useSwingStore();
  
  if (!currentSession || activePanel !== 'params') return null;
  
  const frame = currentSession.frames[selectedFrameIndex];
  if (!frame) return null;
  
  const frameAnomalies = currentSession.anomalies.filter(a => {
    if (a.frameId === frame.frameId) return true;
    if (a.frameRange && selectedFrameIndex >= a.frameRange.start && selectedFrameIndex <= a.frameRange.end) return true;
    return false;
  });
  
  const supplement = getSupplementForFrame(currentSession, frame.frameId);
  
  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    updateParameter(selectedFrameIndex, `position.${axis}`, value);
  };
  
  const handleAngleChange = (axis: 'x' | 'y' | 'z', value: number) => {
    updateParameter(selectedFrameIndex, `faceAngle.${axis}`, value);
  };
  
  const handleVelocityChange = (value: number) => {
    updateParameter(selectedFrameIndex, 'velocity', value);
  };
  
  const positionAnomaly = frameAnomalies.some(a => a.type === 'jitter');
  const angleAnomaly = frameAnomalies.some(a => a.type === 'faceAngleReverse');
  
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-golf-blue" />
        <h2 className="text-lg font-semibold text-golf-text">参数面板</h2>
        <span className="ml-auto text-sm text-golf-text-muted font-mono">
          帧 {selectedFrameIndex}/{currentSession.frames.length - 1}
        </span>
      </div>
      
      {frameAnomalies.length > 0 && (
        <div className="mb-4 p-3 bg-golf-red/10 border border-golf-red/30 rounded-lg animate-pulse">
          <div className="flex items-center gap-2 text-golf-red text-sm mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span>检测到 {frameAnomalies.length} 个异常</span>
          </div>
          {frameAnomalies.map(a => (
            <div key={a.anomalyId} className="text-xs text-golf-orange ml-6">
              • {getAnomalyTypeLabel(a.type)} - {a.description}
            </div>
          ))}
        </div>
      )}
      
      <ParameterCard title="位置坐标" icon={<Target className="w-4 h-4" />}>
        <div className="grid grid-cols-3 gap-2">
          <NumericInput
            label="X"
            value={frame.position.x}
            unit="m"
            onChange={(v) => handlePositionChange('x', v)}
            step={0.01}
            decimals={3}
            isAnomaly={positionAnomaly}
            isSupplemented={frame.isSupplemented}
          />
          <NumericInput
            label="Y"
            value={frame.position.y}
            unit="m"
            onChange={(v) => handlePositionChange('y', v)}
            step={0.01}
            decimals={3}
            isAnomaly={positionAnomaly}
            isSupplemented={frame.isSupplemented}
          />
          <NumericInput
            label="Z"
            value={frame.position.z}
            unit="m"
            onChange={(v) => handlePositionChange('z', v)}
            step={0.01}
            decimals={3}
            isAnomaly={positionAnomaly}
            isSupplemented={frame.isSupplemented}
          />
        </div>
      </ParameterCard>
      
      <ParameterCard title="杆面角度" icon={<RotateCcw className="w-4 h-4" />}>
        <div className="grid grid-cols-3 gap-2">
          <NumericInput
            label="横滚 X"
            value={toDegrees(frame.faceAngle.x)}
            unit="°"
            onChange={(v) => handleAngleChange('x', v * (Math.PI / 180))}
            step={0.5}
            decimals={1}
            isAnomaly={angleAnomaly}
            isSupplemented={frame.isSupplemented}
          />
          <NumericInput
            label="俯仰 Y"
            value={toDegrees(frame.faceAngle.y)}
            unit="°"
            onChange={(v) => handleAngleChange('y', v * (Math.PI / 180))}
            step={0.5}
            decimals={1}
            isAnomaly={angleAnomaly}
            isSupplemented={frame.isSupplemented}
          />
          <NumericInput
            label="偏航 Z"
            value={toDegrees(frame.faceAngle.z)}
            unit="°"
            onChange={(v) => handleAngleChange('z', v * (Math.PI / 180))}
            step={0.5}
            decimals={1}
            isAnomaly={angleAnomaly}
            isSupplemented={frame.isSupplemented}
          />
        </div>
      </ParameterCard>
      
      <ParameterCard title="运动参数" icon={<Zap className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-2">
          <NumericInput
            label="杆头速度"
            value={frame.velocity}
            unit="m/s"
            onChange={handleVelocityChange}
            step={0.1}
            decimals={1}
            isSupplemented={frame.isSupplemented}
          />
          <NumericInput
            label="加速度"
            value={frame.acceleration / 1000}
            unit="km/s²"
            onChange={() => {}}
            step={0.1}
            decimals={2}
            isSupplemented={frame.isSupplemented}
          />
        </div>
      </ParameterCard>
      
      {currentSession.impactPoint && (
        <ParameterCard title="击球点数据" icon={<Target className="w-4 h-4" />}>
          <div className="grid grid-cols-2 gap-2">
            <NumericInput
              label="击球速度"
              value={currentSession.impactPoint.velocity}
              unit="m/s"
              onChange={() => {}}
              step={0.1}
              decimals={1}
              isSupplemented={currentSession.impactPoint.isSupplemented}
            />
            <NumericInput
              label="杆面角度"
              value={currentSession.impactPoint.faceAngle}
              unit="°"
              onChange={() => {}}
              step={0.5}
              decimals={1}
              isSupplemented={currentSession.impactPoint.isSupplemented}
            />
          </div>
        </ParameterCard>
      )}
      
      <ParameterCard title="显示选项" icon={<Layers className="w-4 h-4" />}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-golf-text">数据完整度</span>
            <span className={`font-mono text-sm ${
              currentSession.dataCompleteness >= 80 ? 'text-golf-green' :
              currentSession.dataCompleteness >= 50 ? 'text-golf-orange' : 'text-golf-red'
            }`}>
              {currentSession.dataCompleteness}%
            </span>
          </div>
          <div className="w-full h-2 bg-golf-bg rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                currentSession.dataCompleteness >= 80 ? 'bg-golf-green' :
                currentSession.dataCompleteness >= 50 ? 'bg-golf-orange' : 'bg-golf-red'
              }`}
              style={{ width: `${currentSession.dataCompleteness}%` }}
            />
          </div>
        </div>
      </ParameterCard>
      
      {supplement && (
        <div className="mt-4 p-3 bg-golf-orange/10 border border-golf-orange/30 rounded-lg">
          <div className="text-xs text-golf-orange mb-1">补录信息</div>
          <div className="text-sm text-golf-text">
            {supplement.fieldType} - {supplement.remark}
          </div>
          <div className="text-xs text-golf-text-muted mt-1">
            {supplement.supplementedBy} @ {new Date(supplement.supplementedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

import { Gauge, AlertCircle, Cpu, Wind, CircleDot, Zap, Maximize2 } from 'lucide-react';
import { useEstimationStore } from '@/store/useEstimationStore';
import { cn } from '@/lib/utils';
import type { DeviceConstraints } from '@/types';

interface FormFieldProps {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  error?: string;
  icon: React.ReactNode;
  placeholder?: string;
  step?: string;
  min?: number;
  max?: number;
}

function FormField({ label, value, unit, onChange, error, icon, placeholder, step = '0.01', min, max }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-ocean-400">{icon}</span>
        <label className="text-sm text-ocean-200">{label}</label>
        <span className="text-xs text-ocean-400 ml-auto">({unit})</span>
      </div>
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 bg-ocean-800/50 border rounded-lg text-ocean-100 placeholder-ocean-500 text-sm focus:outline-none focus:ring-2 transition-all',
          error
            ? 'border-alert-500 focus:ring-alert-500/30'
            : 'border-ocean-600 focus:border-tech-500 focus:ring-tech-500/30'
        )}
      />
      {error && (
        <div className="flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-alert-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-alert-500">{error}</p>
        </div>
      )}
    </div>
  );
}

export default function DeviceParamsForm() {
  const { params, setDeviceConstraints, validation } = useEstimationStore();
  const { deviceConstraints } = params;

  const getFieldError = (field: keyof DeviceConstraints) => {
    return validation.errors.find(e => e.field === field)?.message;
  };

  const handleChange = (field: keyof DeviceConstraints, value: number) => {
    setDeviceConstraints({ [field]: value });
  };

  return (
    <div className="bg-ocean-700/50 rounded-xl p-4 border border-ocean-600 space-y-4">
      <div className="flex items-center gap-2">
        <Cpu className="w-4 h-4 text-tech-400" />
        <h3 className="text-sm font-medium text-ocean-100">设备参数</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FormField
          label="额定功率"
          value={deviceConstraints.ratedPower}
          unit="kW"
          onChange={(v) => handleChange('ratedPower', v)}
          error={getFieldError('ratedPower')}
          icon={<Zap className="w-4 h-4" />}
          placeholder="输入额定功率"
          step="1"
        />

        <FormField
          label="最大流速"
          value={deviceConstraints.maxFlowVelocity}
          unit="m/s"
          onChange={(v) => handleChange('maxFlowVelocity', v)}
          error={getFieldError('maxFlowVelocity')}
          icon={<Wind className="w-4 h-4" />}
          placeholder="输入最大允许流速"
        />

        <FormField
          label="启动流速"
          value={deviceConstraints.minFlowVelocity}
          unit="m/s"
          onChange={(v) => handleChange('minFlowVelocity', v)}
          error={getFieldError('minFlowVelocity')}
          icon={<Gauge className="w-4 h-4" />}
          placeholder="输入启动流速"
        />

        <FormField
          label="最大效率"
          value={deviceConstraints.maxEfficiency}
          unit=""
          onChange={(v) => handleChange('maxEfficiency', v)}
          error={getFieldError('maxEfficiency')}
          icon={<CircleDot className="w-4 h-4" />}
          placeholder="0-1"
          min={0}
          max={1}
        />

        <FormField
          label="叶轮直径"
          value={deviceConstraints.impellerDiameter}
          unit="m"
          onChange={(v) => handleChange('impellerDiameter', v)}
          error={getFieldError('impellerDiameter')}
          icon={<Maximize2 className="w-4 h-4" />}
          placeholder="输入叶轮直径"
        />
      </div>

      {getFieldError('minFlowVelocity') && getFieldError('minFlowVelocity')?.includes('小于') && (
        <div className="flex items-start gap-2 p-2 bg-alert-500/10 border border-alert-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-alert-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-alert-500">流速范围无效：启动流速 {deviceConstraints.minFlowVelocity} m/s 必须小于最大流速 {deviceConstraints.maxFlowVelocity} m/s</p>
        </div>
      )}
    </div>
  );
}

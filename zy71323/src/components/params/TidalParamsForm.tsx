import { Waves, Wind, CircleDot, Zap, AlertCircle } from 'lucide-react';
import { useEstimationStore } from '@/store/useEstimationStore';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  error?: string;
  icon: React.ReactNode;
  placeholder?: string;
  step?: string;
}

function FormField({ label, value, unit, onChange, error, icon, placeholder, step = '0.01' }: FormFieldProps) {
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

export default function TidalParamsForm() {
  const { params, setParams, validation } = useEstimationStore();

  const getFieldError = (field: string) => {
    return validation.errors.find(e => e.field === field)?.message;
  };

  const getEfficiencySuggestion = () => {
    const error = validation.errors.find(e => e.field === 'efficiency');
    if (error?.code === 'EFFICIENCY_EXCEEDS_ONE') {
      return (
        <button
          onClick={() => setParams({ efficiency: params.efficiency / 100 })}
          className="text-xs text-tech-400 hover:text-tech-500 underline mt-1"
        >
          自动转换为 {params.efficiency / 100}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="bg-ocean-700/50 rounded-xl p-4 border border-ocean-600 space-y-4">
      <div className="flex items-center gap-2">
        <Waves className="w-4 h-4 text-tech-400" />
        <h3 className="text-sm font-medium text-ocean-100">潮汐参数</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="潮差"
          value={params.tidalRange}
          unit={params.tidalRangeUnit}
          onChange={(v) => setParams({ tidalRange: v })}
          error={getFieldError('tidalRange')}
          icon={<CircleDot className="w-4 h-4" />}
          placeholder="输入潮差"
        />

        <FormField
          label="流速"
          value={params.flowVelocity}
          unit={params.flowVelocityUnit}
          onChange={(v) => setParams({ flowVelocity: v })}
          error={getFieldError('flowVelocity')}
          icon={<Wind className="w-4 h-4" />}
          placeholder="输入流速"
        />

        <FormField
          label="叶轮面积"
          value={params.impellerArea}
          unit={params.impellerAreaUnit}
          onChange={(v) => setParams({ impellerArea: v })}
          error={getFieldError('impellerArea')}
          icon={<CircleDot className="w-4 h-4" />}
          placeholder="输入叶轮面积"
        />

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-ocean-400" />
            <label className="text-sm text-ocean-200">效率</label>
            <span className="text-xs text-ocean-400 ml-auto">(0-1)</span>
          </div>
          <input
            type="number"
            value={params.efficiency || ''}
            onChange={(e) => setParams({ efficiency: parseFloat(e.target.value) || 0 })}
            step="0.01"
            min="0"
            max="1"
            placeholder="输入效率"
            className={cn(
              'w-full px-3 py-2 bg-ocean-800/50 border rounded-lg text-ocean-100 placeholder-ocean-500 text-sm focus:outline-none focus:ring-2 transition-all',
              getFieldError('efficiency')
                ? 'border-alert-500 focus:ring-alert-500/30'
                : 'border-ocean-600 focus:border-tech-500 focus:ring-tech-500/30'
            )}
          />
          {getFieldError('efficiency') && (
            <div className="flex flex-col">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-alert-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-alert-500">{getFieldError('efficiency')}</p>
              </div>
              {getEfficiencySuggestion()}
            </div>
          )}
          <p className="text-xs text-ocean-500">例如 0.45 表示 45% 效率</p>
        </div>
      </div>
    </div>
  );
}

import { useForm } from 'react-hook-form';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { useValidation } from '@/hooks/useValidation';
import { useBatchStore } from '@/store/useBatchStore';
import type { Batch, ResistanceUnit, CapacitanceUnit, TimeUnit, FitMode } from '@/types';
import { cn } from '@/lib/utils';

interface ParameterFormProps {
  batch: Batch;
  onUpdate: (updates: Partial<Batch>) => void;
}

const resistanceUnits: ResistanceUnit[] = ['Ω', 'kΩ', 'MΩ'];
const capacitanceUnits: CapacitanceUnit[] = ['F', 'μF', 'nF', 'pF'];
const timeUnits: TimeUnit[] = ['s', 'ms', 'μs'];

export const ParameterForm = ({ batch, onUpdate }: ParameterFormProps) => {
  const validationErrors = useBatchStore((state) => state.validationErrors);
  const { getErrorsForTarget, getTargetStatus } = useValidation(validationErrors);

  const { register, formState: { errors }, watch } = useForm({
    defaultValues: {
      studentName: batch.studentName || '',
      experimentDate: batch.experimentDate || '',
      resistance: batch.resistance ?? '',
      resistanceUnit: batch.resistanceUnit,
      capacitance: batch.capacitance ?? '',
      capacitanceUnit: batch.capacitanceUnit,
      initialVoltage: batch.initialVoltage ?? '',
      supplyVoltage: batch.supplyVoltage ?? '',
      timeUnit: batch.timeUnit,
      fitMode: batch.fitMode,
    },
    mode: 'onChange',
  });

  const formValues = watch();

  const StatusIcon = ({ status }: { status: 'error' | 'warning' | 'success' }) => {
    const iconClass = 'w-4 h-4 transition-all duration-300';
    switch (status) {
      case 'error':
        return <XCircle className={cn(iconClass, 'text-red-500')} />;
      case 'warning':
        return <AlertTriangle className={cn(iconClass, 'text-amber-500')} />;
      case 'success':
        return <CheckCircle className={cn(iconClass, 'text-emerald-500')} />;
    }
  };

  const getFieldStatus = (target: string) => getTargetStatus(target);

  const getFieldTooltip = (target: string) => {
    const fieldErrors = getErrorsForTarget(target);
    if (fieldErrors.length === 0) return null;
    return fieldErrors[0].message;
  };

  const handleChange = (field: keyof Batch, value: string | number | null) => {
    onUpdate({ [field]: value });
  };

  const fieldConfig = [
    { key: 'studentName', label: '学生姓名', target: 'studentName', type: 'text' },
    { key: 'experimentDate', label: '实验日期', target: 'experimentDate', type: 'date' },
    { key: 'resistance', label: '电阻值', target: 'R1', type: 'number', unit: 'resistanceUnit', units: resistanceUnits },
    { key: 'capacitance', label: '电容值', target: 'C1', type: 'number', unit: 'capacitanceUnit', units: capacitanceUnits },
    { key: 'initialVoltage', label: '初始电压 V0', target: 'V0', type: 'number', suffix: 'V' },
    { key: 'supplyVoltage', label: '电源电压 Vs', target: 'Vs', type: 'number', suffix: 'V' },
    { key: 'timeUnit', label: '时间单位', target: 'timeUnit', type: 'select', options: timeUnits },
    { key: 'fitMode', label: '拟合模式', target: 'fitMode', type: 'radio', options: [{ value: 'charge', label: '充电' }, { value: 'discharge', label: '放电' }] },
  ];

  const completedFields = fieldConfig.filter((f) => {
    const val = formValues[f.key as keyof typeof formValues];
    return val !== '' && val !== null && val !== undefined;
  }).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">实验参数</h3>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Info className="w-4 h-4" />
          <span>已完成 {completedFields}/{fieldConfig.length} 个字段</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fieldConfig.map((field) => {
          const status = getFieldStatus(field.target);
          const tooltip = getFieldTooltip(field.target);
          const fieldError = errors[field.key as keyof typeof errors];

          return (
            <div key={field.key} className="group relative">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {field.label}
              </label>
              <div className="relative">
                <div className="flex gap-2">
                  {field.type === 'select' && (
                    <select
                      {...register(field.key as any)}
                      onChange={(e) => handleChange(field.key as keyof Batch, e.target.value as TimeUnit)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg border transition-all duration-200',
                        'bg-white dark:bg-slate-800',
                        'border-slate-200 dark:border-slate-700',
                        'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none',
                        status === 'error' && 'border-red-500 focus:ring-red-500/20 focus:border-red-500',
                        status === 'warning' && 'border-amber-500 focus:ring-amber-500/20 focus:border-amber-500'
                      )}
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.type === 'radio' && (
                    <div className="flex gap-4 flex-1">
                      {field.options?.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            {...register(field.key as any)}
                            value={opt.value}
                            onChange={() => handleChange(field.key as keyof Batch, opt.value as FitMode)}
                            checked={formValues[field.key as keyof typeof formValues] === opt.value}
                            className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {field.type !== 'select' && field.type !== 'radio' && (
                    <>
                      <input
                        type={field.type}
                        {...register(field.key as any, {
                          onChange: (e) => {
                            const val = e.target.value;
                            handleChange(
                              field.key as keyof Batch,
                              field.type === 'number' ? (val === '' ? null : Number(val)) : val
                            );
                          },
                        })}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg border transition-all duration-200',
                          'bg-white dark:bg-slate-800',
                          'border-slate-200 dark:border-slate-700',
                          'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none',
                          status === 'error' && 'border-red-500 focus:ring-red-500/20 focus:border-red-500',
                          status === 'warning' && 'border-amber-500 focus:ring-amber-500/20 focus:border-amber-500',
                          field.suffix && 'pr-10'
                        )}
                      />
                      {field.suffix && (
                        <span className="absolute right-12 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                          {field.suffix}
                        </span>
                      )}
                      {field.unit && field.units && (
                        <select
                          {...register(field.unit as any)}
                          onChange={(e) => handleChange(field.unit as keyof Batch, e.target.value as ResistanceUnit)}
                          className={cn(
                            'w-20 px-2 py-2 rounded-lg border transition-all duration-200',
                            'bg-white dark:bg-slate-800',
                            'border-slate-200 dark:border-slate-700',
                            'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none'
                          )}
                        >
                          {field.units.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      )}
                    </>
                  )}

                  <div className="absolute -right-8 top-1/2 -translate-y-1/2">
                    <StatusIcon status={status} />
                  </div>
                </div>

                {tooltip && (
                  <div className={cn(
                    'absolute z-10 mt-1 px-3 py-1.5 rounded-lg text-xs',
                    'bg-red-500 text-white',
                    'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                    'shadow-lg'
                  )}>
                    {field.target}: {tooltip}
                  </div>
                )}

                {fieldError && (
                  <p className="mt-1 text-xs text-red-500">{fieldError.message as string}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap gap-2">
          {fieldConfig.map((field) => {
            const val = formValues[field.key as keyof typeof formValues];
            const isCompleted = val !== '' && val !== null && val !== undefined;
            return (
              <span
                key={field.key}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200',
                  isCompleted
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {isCompleted ? '✓' : '○'} {field.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

import { AlertTriangle, Thermometer, Package, Ruler, CheckCircle, Wrench, Info } from 'lucide-react';
import type { ValidationError } from '../../types';
import { getUnitConversionTable } from '../../utils/unitConverter';
import { getMaterialById } from '../../data/materials';

interface DataValidationProps {
  errors: ValidationError[];
  onFix: (type: 'temp_diff_sign' | 'material_missing' | 'unit_mixed') => void;
}

const ERROR_CONFIG = {
  temp_diff_sign: {
    icon: Thermometer,
    title: '温差符号错误',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/50',
  },
  material_missing: {
    icon: Package,
    title: '材料参数缺失',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/50',
  },
  unit_mixed: {
    icon: Ruler,
    title: '尺寸单位混用',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/50',
  },
};

export const DataValidation = ({ errors, onFix }: DataValidationProps) => {
  if (errors.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
        <div>
          <div className="text-green-400 font-medium">数据校验通过</div>
          <div className="text-sm text-gray-400">所有参数格式正确，可以进行应力分析</div>
        </div>
      </div>
    );
  }

  const renderTempDiffDetails = (error: ValidationError) => {
    const details = error.details as {
      nozzleTemp: number;
      bedTemp: number;
      ambientTemp: number;
      correctGradient: string;
      currentGradient: string;
      signError: string;
    };

    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-start gap-2 text-sm">
          <Info className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-gray-300 mb-1">正确的温度梯度逻辑：</div>
            <div className="font-mono text-orange-300 bg-orange-500/10 px-3 py-2 rounded">
              喷嘴温度 {'>'} 床温 {'>'} 环境温度
            </div>
            <div className="text-gray-400 mt-2">{details.correctGradient}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-800 p-2 rounded text-center">
            <div className="text-gray-400">喷嘴</div>
            <div
              className={`text-lg font-mono ${details.nozzleTemp < details.bedTemp ? 'text-red-400' : 'text-green-400'}`}
            >
              {details.nozzleTemp}°C
            </div>
          </div>
          <div className="bg-slate-800 p-2 rounded text-center">
            <div className="text-gray-400">床温</div>
            <div
              className={`text-lg font-mono ${details.bedTemp < details.ambientTemp ? 'text-red-400' : 'text-green-400'}`}
            >
              {details.bedTemp}°C
            </div>
          </div>
          <div className="bg-slate-800 p-2 rounded text-center">
            <div className="text-gray-400">环境</div>
            <div className="text-lg font-mono text-green-400">
              {details.ambientTemp}°C
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMaterialMissingDetails = (error: ValidationError) => {
    const details = error.details as {
      missingFields: string[];
      fieldLabels: Record<string, string>;
      standardValues: Record<string, number>;
      materialName: string;
    };

    return (
      <div className="mt-3 space-y-2">
        <div className="text-sm text-gray-300 mb-2">
          材料 <span className="text-purple-300 font-medium">{details.materialName}</span> 以下参数缺失：
        </div>
        <div className="space-y-1">
          {details.missingFields.map((field) => (
            <div
              key={field}
              className="flex justify-between items-center text-sm bg-slate-800 px-3 py-2 rounded"
            >
              <span className="text-gray-300">{details.fieldLabels[field] || field}</span>
              <span className="text-red-400 font-mono">缺失</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-400 mt-2">
          系统将使用内置标准参数进行填充
        </div>
      </div>
    );
  };

  const renderUnitMixedDetails = (error: ValidationError) => {
    const details = error.details as {
      units: {
        width: { value: number; unit: string };
        height: { value: number; unit: string };
        depth: { value: number; unit: string };
      };
    };

    const conversionTable = getUnitConversionTable(
      details.units.width.value,
      details.units.width.unit as 'mm' | 'cm' | 'in',
      details.units.height.value,
      details.units.height.unit as 'mm' | 'cm' | 'in',
      details.units.depth.value,
      details.units.depth.unit as 'mm' | 'cm' | 'in',
    );

    return (
      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-800 p-2 rounded text-center">
            <div className="text-gray-400">宽度</div>
            <div
              className={`text-lg font-mono ${details.units.width.unit !== 'mm' ? 'text-yellow-400' : 'text-gray-300'}`}
            >
              {details.units.width.value}{details.units.width.unit}
            </div>
          </div>
          <div className="bg-slate-800 p-2 rounded text-center">
            <div className="text-gray-400">高度</div>
            <div
              className={`text-lg font-mono ${details.units.height.unit !== 'mm' ? 'text-yellow-400' : 'text-gray-300'}`}
            >
              {details.units.height.value}{details.units.height.unit}
            </div>
          </div>
          <div className="bg-slate-800 p-2 rounded text-center">
            <div className="text-gray-400">深度</div>
            <div
              className={`text-lg font-mono ${details.units.depth.unit !== 'mm' ? 'text-yellow-400' : 'text-gray-300'}`}
            >
              {details.units.depth.value}{details.units.depth.unit}
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-400">单位转换对比（统一为mm）：</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left py-1">维度</th>
              <th className="text-center py-1">原值</th>
              <th className="text-center py-1">→</th>
              <th className="text-right py-1">mm</th>
            </tr>
          </thead>
          <tbody>
            {['width', 'height', 'depth'].map((dim) => {
              const dimLabel = dim === 'width' ? '宽' : dim === 'height' ? '高' : '深';
              const original = conversionTable[dim as keyof typeof conversionTable].find((u) => u.isOriginal)!;
              const mmValue = conversionTable[dim as keyof typeof conversionTable].find((u) => u.unit === 'mm')!;
              const needsConversion = original.unit !== 'mm';
              return (
                <tr key={dim} className="border-t border-slate-700">
                  <td className="py-1 text-gray-300">{dimLabel}</td>
                  <td className={`text-center py-1 ${needsConversion ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {original.value}{original.unit}
                  </td>
                  <td className="text-center py-1 text-gray-500">→</td>
                  <td className="text-right py-1 font-mono text-green-400">
                    {mmValue.value.toFixed(1)}mm
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderErrorDetails = (error: ValidationError) => {
    switch (error.type) {
      case 'temp_diff_sign':
        return renderTempDiffDetails(error);
      case 'material_missing':
        return renderMaterialMissingDetails(error);
      case 'unit_mixed':
        return renderUnitMixedDetails(error);
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-orange-400" />
        <span className="text-lg font-semibold text-orange-400">
          发现 {errors.length} 项数据问题
        </span>
      </div>

      {errors.map((error, idx) => {
        const config = ERROR_CONFIG[error.type];
        const Icon = config.icon;
        return (
          <div
            key={`${error.type}-${idx}`}
            className={`p-4 rounded-lg border-2 ${config.bgColor} ${config.borderColor} animate-[fadeIn_0.3s_ease-out]`}
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${config.bgColor} ${config.borderColor} border`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div>
                  <h4 className={`font-semibold ${config.color}`}>{config.title}</h4>
                  <p className="text-sm text-gray-300 mt-1">{error.message}</p>
                </div>
              </div>
              {error.autoFixable && (
                <button
                  onClick={() => onFix(error.type)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
                >
                  <Wrench className="w-4 h-4" />
                  一键修复
                </button>
              )}
            </div>
            {renderErrorDetails(error)}
          </div>
        );
      })}
    </div>
  );
};

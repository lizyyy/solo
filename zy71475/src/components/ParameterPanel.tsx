import { useState } from 'react';
import type { LengthUnit, DensityUnit, BoxDimensions, SoundHole, WoodMaterial, ValidationError } from '@/types';
import { useGuitarStore } from '@/store/useStore';
import { PRESET_WOODS } from '@/utils/sampleData';
import { convertLength, convertDensity, LENGTH_UNIT_LABELS, DENSITY_UNIT_LABELS } from '@/utils/unitConversion';
import { Box, Circle, TreePine, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { clsx } from 'clsx';

export default function ParameterPanel() {
  const {
    inputBoxDims, inputSoundHole, inputWood,
    inputLengthUnit, inputDensityUnit, inputName,
    validationErrors,
    setInputBoxDims, setInputSoundHole, setInputWood,
    setInputLengthUnit, setInputDensityUnit, setInputName,
    submitRecord, validateInput,
  } = useGuitarStore();

  const [operator, setOperator] = useState('制琴师');
  const [reason, setReason] = useState('');
  const [showConversion, setShowConversion] = useState(false);

  const errorFields = new Set(validationErrors.map((e) => e.field));

  function handleDimChange(field: keyof BoxDimensions, value: string) {
    const num = parseFloat(value) || 0;
    setInputBoxDims({ ...inputBoxDims, [field]: num });
  }

  function handleSHChange(field: keyof SoundHole, value: string) {
    if (field === 'diameter') {
      setInputSoundHole({ ...inputSoundHole, diameter: parseFloat(value) || 0 });
    } else {
      setInputSoundHole({ ...inputSoundHole, [field]: value });
    }
  }

  function handleWoodChange(field: keyof WoodMaterial, value: string) {
    if (field === 'name') {
      const preset = PRESET_WOODS.find((w) => w.name === value);
      if (preset) {
        setInputWood({ ...preset });
      } else {
        setInputWood({ ...inputWood, name: value });
      }
    } else if (field === 'density' || field === 'elasticModulus') {
      setInputWood({ ...inputWood, [field]: parseFloat(value) || 0 });
    }
  }

  function handleUnitChange(newUnit: LengthUnit) {
    setInputLengthUnit(newUnit);
  }

  function handleSubmit() {
    const record = submitRecord(operator, reason);
    if (record) {
      setReason('');
    }
  }

  function getConvertedValue(field: string): string {
    if (field.startsWith('boxDims.') || field === 'soundHole.diameter') {
      const targetUnit: LengthUnit = inputLengthUnit === 'mm' ? 'cm' : 'mm';
      if (field === 'boxDims.length') {
        return convertLength(inputBoxDims.length, inputLengthUnit, targetUnit).convertedValue.toFixed(2) + ' ' + LENGTH_UNIT_LABELS[targetUnit];
      }
      if (field === 'boxDims.width') {
        return convertLength(inputBoxDims.width, inputLengthUnit, targetUnit).convertedValue.toFixed(2) + ' ' + LENGTH_UNIT_LABELS[targetUnit];
      }
      if (field === 'boxDims.depth') {
        return convertLength(inputBoxDims.depth, inputLengthUnit, targetUnit).convertedValue.toFixed(2) + ' ' + LENGTH_UNIT_LABELS[targetUnit];
      }
      if (field === 'soundHole.diameter') {
        return convertLength(inputSoundHole.diameter, inputLengthUnit, targetUnit).convertedValue.toFixed(2) + ' ' + LENGTH_UNIT_LABELS[targetUnit];
      }
    }
    if (field === 'wood.density') {
      const targetUnit: DensityUnit = inputDensityUnit === 'kg_m3' ? 'g_cm3' : 'kg_m3';
      return convertDensity(inputWood.density, inputDensityUnit, targetUnit).convertedValue.toFixed(4) + ' ' + DENSITY_UNIT_LABELS[targetUnit];
    }
    return '';
  }

  function getFieldError(field: string): ValidationError | undefined {
    return validationErrors.find((e) => e.field === field);
  }

  const inputCls = (field: string) =>
    clsx(
      'w-full rounded-lg border bg-white px-3 py-2 text-sm text-stone-800 outline-none transition-colors',
      'placeholder:text-stone-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-200',
      errorFields.has(field) ? 'border-red-300 bg-red-50/50' : 'border-stone-200'
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-800">参数输入</h2>
        <button
          onClick={() => setShowConversion(!showConversion)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          换算对照
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-stone-500">记录名称</label>
        <input
          type="text"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          placeholder="例如: 云杉面板方案A"
          className={inputCls('name')}
        />
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <Box className="h-4 w-4 text-amber-600" />
          箱体尺寸
          <select
            value={inputLengthUnit}
            onChange={(e) => handleUnitChange(e.target.value as LengthUnit)}
            className="ml-auto rounded-md border border-stone-200 px-2 py-0.5 text-xs text-stone-600"
          >
            {Object.entries(LENGTH_UNIT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {(['length', 'width', 'depth'] as const).map((dim) => (
          <div key={dim}>
            <div className="flex items-center gap-2">
              <label className="w-12 text-xs text-stone-500">
                {dim === 'length' ? '长' : dim === 'width' ? '宽' : '深'}
              </label>
              <input
                type="number"
                value={inputBoxDims[dim] || ''}
                onChange={(e) => handleDimChange(dim, e.target.value)}
                placeholder="0"
                className={inputCls(`boxDims.${dim}`)}
              />
              <span className="text-xs text-stone-400">{LENGTH_UNIT_LABELS[inputLengthUnit]}</span>
            </div>
            {showConversion && (
              <p className="ml-14 mt-0.5 text-xs text-stone-400">≈ {getConvertedValue(`boxDims.${dim}`)}</p>
            )}
            {getFieldError(`boxDims.${dim}`) && (
              <p className="ml-14 mt-0.5 flex items-center gap-1 text-xs text-red-500">
                <AlertTriangle className="h-3 w-3" />
                {getFieldError(`boxDims.${dim}`)!.message}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <Circle className="h-4 w-4 text-amber-600" />
          音孔参数
        </div>
        <div>
          <div className="flex items-center gap-2">
            <label className="w-12 text-xs text-stone-500">直径</label>
            <input
              type="number"
              value={inputSoundHole.diameter || ''}
              onChange={(e) => handleSHChange('diameter', e.target.value)}
              placeholder="0"
              className={inputCls('soundHole.diameter')}
            />
            <span className="text-xs text-stone-400">{LENGTH_UNIT_LABELS[inputLengthUnit]}</span>
          </div>
          {showConversion && (
            <p className="ml-14 mt-0.5 text-xs text-stone-400">≈ {getConvertedValue('soundHole.diameter')}</p>
          )}
          {getFieldError('soundHole.diameter') && (
            <p className="ml-14 mt-0.5 flex items-center gap-1 text-xs text-red-500">
              <AlertTriangle className="h-3 w-3" />
              {getFieldError('soundHole.diameter')!.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="w-12 text-xs text-stone-500">位置</label>
          <input
            type="text"
            value={inputSoundHole.position}
            onChange={(e) => handleSHChange('position', e.target.value)}
            placeholder="面板中央"
            className={inputCls('soundHole.position')}
          />
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <TreePine className="h-4 w-4 text-amber-600" />
          木材属性
        </div>
        <div>
          <label className="text-xs text-stone-500">选择木材</label>
          <select
            value={inputWood.isCustom ? 'custom' : inputWood.name}
            onChange={(e) => handleWoodChange('name', e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
          >
            <option value="custom">自定义木材</option>
            {PRESET_WOODS.map((w) => (
              <option key={w.name} value={w.name}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="w-12 text-xs text-stone-500">密度</label>
          <input
            type="number"
            value={inputWood.density || ''}
            onChange={(e) => handleWoodChange('density', e.target.value)}
            placeholder="0"
            className={inputCls('wood.density')}
          />
          <select
            value={inputDensityUnit}
            onChange={(e) => setInputDensityUnit(e.target.value as DensityUnit)}
            className="rounded-md border border-stone-200 px-2 py-2 text-xs text-stone-600"
          >
            {Object.entries(DENSITY_UNIT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {showConversion && (
          <p className="ml-14 text-xs text-stone-400">≈ {getConvertedValue('wood.density')}</p>
        )}
        {getFieldError('wood.density') && (
          <p className="ml-14 flex items-center gap-1 text-xs text-red-500">
            <AlertTriangle className="h-3 w-3" />
            {getFieldError('wood.density')!.message}
          </p>
        )}
        <div className="flex items-center gap-2">
          <label className="w-12 text-xs text-stone-500">弹模</label>
          <input
            type="number"
            step="0.1"
            value={inputWood.elasticModulus || ''}
            onChange={(e) => handleWoodChange('elasticModulus', e.target.value)}
            placeholder="0"
            className={inputCls('wood.elasticModulus')}
          />
          <span className="text-xs text-stone-400">GPa</span>
        </div>
        {getFieldError('wood.elasticModulus') && (
          <p className="ml-14 flex items-center gap-1 text-xs text-red-500">
            <AlertTriangle className="h-3 w-3" />
            {getFieldError('wood.elasticModulus')!.message}
          </p>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <label className="w-12 text-xs text-stone-500">操作人</label>
          <input
            type="text"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-12 text-xs text-stone-500">原因</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="为什么这样处理..."
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full rounded-xl bg-amber-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-800 active:bg-amber-900"
      >
        计算并保存
      </button>

      {validationErrors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700">校验未通过，记录将标记为"需退回"</p>
          <ul className="mt-1 space-y-0.5">
            {validationErrors.map((e, i) => (
              <li key={i} className="text-xs text-red-600">• {e.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

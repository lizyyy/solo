import { useState, useEffect, useCallback } from 'react';
import type { SimulationParams, ValidationError } from '../types';
import { MOLD_MATERIALS } from '../data/materials';
import { VALIDATION_RULES, ERROR_CODES, hasCriticalErrors } from '../utils/validation';

interface SimulationFormProps {
  onSubmit: (params: SimulationParams) => Promise<void>;
  errors: ValidationError[];
  isRunning: boolean;
  onValidate: (params: Partial<SimulationParams>) => void;
}

export const SimulationForm: React.FC<SimulationFormProps> = ({
  onSubmit,
  errors,
  isRunning,
  onValidate
}) => {
  const [formData, setFormData] = useState<Partial<SimulationParams>>({
    materialId: 'aluminum',
    ovenTemperature: 180,
    initialTemperature: 25,
    cakeDimensions: {
      diameter: 20,
      height: 8
    },
    timeStep: 5,
    totalTime: 1800
  });

  const [selectedMaterial, setSelectedMaterial] = useState(
    MOLD_MATERIALS.find(m => m.id === formData.materialId)
  );

  useEffect(() => {
    const material = MOLD_MATERIALS.find(m => m.id === formData.materialId);
    setSelectedMaterial(material);
  }, [formData.materialId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onValidate(formData);
    }, 300);
    return () => clearTimeout(timer);
  }, [formData, onValidate]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.materialId || !formData.cakeDimensions) return;
    
    const params: SimulationParams = {
      id: '',
      materialId: formData.materialId,
      ovenTemperature: formData.ovenTemperature!,
      initialTemperature: formData.initialTemperature!,
      cakeDimensions: formData.cakeDimensions,
      timeStep: formData.timeStep!,
      totalTime: formData.totalTime!
    };
    
    await onSubmit(params);
  }, [formData, onSubmit]);

  const getFieldError = (fieldName: string): ValidationError | undefined => {
    return errors.find(e => e.field === fieldName);
  };

  const isWarning = (error: ValidationError): boolean => {
    return error.code === ERROR_CODES.TIME_STEP_TOO_LARGE;
  };

  const hasCritical = hasCriticalErrors(errors);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          模具材料
        </label>
        <select
          value={formData.materialId || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, materialId: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isRunning}
        >
          {MOLD_MATERIALS.map(material => (
            <option key={material.id} value={material.id}>
              {material.name}
            </option>
          ))}
        </select>
        {selectedMaterial && (
          <div className="mt-2 p-3 bg-gray-800/50 rounded-lg text-xs">
            <div className="flex items-center gap-2 mb-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: selectedMaterial.color }}
              />
              <span className="text-gray-300 font-medium">{selectedMaterial.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-gray-400">
              <div>导热系数: {selectedMaterial.thermalConductivity} W/(m·K)</div>
              <div>比热容: {selectedMaterial.specificHeat} J/(kg·K)</div>
              <div>密度: {selectedMaterial.density} kg/m³</div>
              <div>厚度: {selectedMaterial.thickness * 1000} mm</div>
            </div>
            <div className="mt-2 text-blue-400 truncate">
              📚 来源: {selectedMaterial.source}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            烤箱温度 (°C)
          </label>
          <input
            type="number"
            value={formData.ovenTemperature || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, ovenTemperature: Number(e.target.value) }))}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('ovenTemperature') ? 'border-red-500' : 'border-gray-600'
            }`}
            min={VALIDATION_RULES.ovenTemperature.min}
            max={VALIDATION_RULES.ovenTemperature.max}
            disabled={isRunning}
          />
          {getFieldError('ovenTemperature') && (
            <p className="mt-1 text-xs text-red-400">
              {getFieldError('ovenTemperature')?.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            范围: {VALIDATION_RULES.ovenTemperature.min}-{VALIDATION_RULES.ovenTemperature.max}°C
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            初始温度 (°C)
          </label>
          <input
            type="number"
            value={formData.initialTemperature || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, initialTemperature: Number(e.target.value) }))}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('initialTemperature') ? 'border-red-500' : 'border-gray-600'
            }`}
            min={VALIDATION_RULES.initialTemperature.min}
            max={VALIDATION_RULES.initialTemperature.max}
            disabled={isRunning}
          />
          {getFieldError('initialTemperature') && (
            <p className="mt-1 text-xs text-red-400">
              {getFieldError('initialTemperature')?.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            范围: {VALIDATION_RULES.initialTemperature.min}-{VALIDATION_RULES.initialTemperature.max}°C
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            蛋糕直径 (cm)
          </label>
          <input
            type="number"
            value={formData.cakeDimensions?.diameter || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              cakeDimensions: { ...prev.cakeDimensions!, diameter: Number(e.target.value) }
            }))}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('cakeDimensions.diameter') ? 'border-red-500' : 'border-gray-600'
            }`}
            min={VALIDATION_RULES.cakeDiameter.min}
            max={VALIDATION_RULES.cakeDiameter.max}
            disabled={isRunning}
          />
          {getFieldError('cakeDimensions.diameter') && (
            <p className="mt-1 text-xs text-red-400">
              {getFieldError('cakeDimensions.diameter')?.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            范围: {VALIDATION_RULES.cakeDiameter.min}-{VALIDATION_RULES.cakeDiameter.max}cm
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            蛋糕高度 (cm)
          </label>
          <input
            type="number"
            value={formData.cakeDimensions?.height || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              cakeDimensions: { ...prev.cakeDimensions!, height: Number(e.target.value) }
            }))}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('cakeDimensions.height') ? 'border-red-500' : 'border-gray-600'
            }`}
            min={VALIDATION_RULES.cakeHeight.min}
            max={VALIDATION_RULES.cakeHeight.max}
            disabled={isRunning}
          />
          {getFieldError('cakeDimensions.height') && (
            <p className="mt-1 text-xs text-red-400">
              {getFieldError('cakeDimensions.height')?.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            范围: {VALIDATION_RULES.cakeHeight.min}-{VALIDATION_RULES.cakeHeight.max}cm
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            时间步长 (秒)
          </label>
          <input
            type="number"
            value={formData.timeStep || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, timeStep: Number(e.target.value) }))}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('timeStep') 
                ? isWarning(getFieldError('timeStep')!) ? 'border-yellow-500' : 'border-red-500'
                : 'border-gray-600'
            }`}
            min={VALIDATION_RULES.timeStep.min}
            max={VALIDATION_RULES.timeStep.max}
            disabled={isRunning}
          />
          {getFieldError('timeStep') && (
            <p className={`mt-1 text-xs ${isWarning(getFieldError('timeStep')!) ? 'text-yellow-400' : 'text-red-400'}`}>
              {getFieldError('timeStep')?.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            建议: ≤{VALIDATION_RULES.timeStep.recommendedMax}秒
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            总模拟时间 (秒)
          </label>
          <input
            type="number"
            value={formData.totalTime || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, totalTime: Number(e.target.value) }))}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              getFieldError('totalTime') ? 'border-red-500' : 'border-gray-600'
            }`}
            min={VALIDATION_RULES.totalTime.min}
            max={VALIDATION_RULES.totalTime.max}
            disabled={isRunning}
          />
          {getFieldError('totalTime') && (
            <p className="mt-1 text-xs text-red-400">
              {getFieldError('totalTime')?.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            范围: {VALIDATION_RULES.totalTime.min}-{VALIDATION_RULES.totalTime.max}秒
          </p>
        </div>
      </div>

      {getFieldError('simulation') && (
        <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg">
          <p className="text-sm text-red-400">
            {getFieldError('simulation')?.message}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isRunning || hasCritical}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
          isRunning
            ? 'bg-gray-600 cursor-not-allowed text-gray-300'
            : hasCritical
            ? 'bg-gray-600 cursor-not-allowed text-gray-300'
            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg hover:shadow-blue-500/25'
        }`}
      >
        {isRunning ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            模拟计算中...
          </span>
        ) : hasCritical ? (
          '请修正参数错误'
        ) : (
          '🚀 开始模拟'
        )}
      </button>
    </form>
  );
};

import { useState } from 'react';
import { X, FileText, Plus, Trash2, AlertTriangle, Send } from 'lucide-react';
import type { ResourceEffect, Resources } from '@/types';
import { RESOURCE_LABELS, RESOURCE_UNITS } from '@/types';
import { formatNumber } from '@/utils/helpers';

interface SupplementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (effects: ResourceEffect[], reason: string) => void;
  currentResources: Resources;
  isLoading?: boolean;
}

export function SupplementModal({
  isOpen,
  onClose,
  onSubmit,
  currentResources,
  isLoading = false,
}: SupplementModalProps) {
  const [effects, setEffects] = useState<ResourceEffect[]>([]);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ effects?: string; reason?: string }>({});

  const resourceKeys = Object.keys(currentResources) as (keyof Resources)[];

  const negativeResources = resourceKeys.filter((key) => currentResources[key] < 0);

  const addEffect = () => {
    setEffects([
      ...effects,
      {
        resource: 'reserveRequirement',
        change: 0,
        type: 'absolute',
      },
    ]);
  };

  const updateEffect = (index: number, field: keyof ResourceEffect, value: any) => {
    const newEffects = [...effects];
    newEffects[index] = { ...newEffects[index], [field]: value };
    setEffects(newEffects);
  };

  const removeEffect = (index: number) => {
    setEffects(effects.filter((_, i) => i !== index));
  };

  const validate = () => {
    const newErrors: { effects?: string; reason?: string } = {};

    if (effects.length === 0) {
      newErrors.effects = '请至少添加一项资源调整';
    }

    if (!reason.trim()) {
      newErrors.reason = '请填写补充材料说明';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(effects, reason.trim());
  };

  const calculatePreview = () => {
    const preview = { ...currentResources };
    effects.forEach((effect) => {
      if (effect.type === 'absolute') {
        preview[effect.resource] += effect.change;
      } else {
        preview[effect.resource] += preview[effect.resource] * (effect.change / 100);
      }
    });
    return preview;
  };

  const previewResources = calculatePreview();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto card animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-warning-400 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            补充材料
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-danger-500/20 border border-danger-500/30 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-danger-300 font-medium">资源状态异常</p>
              <p className="text-sm text-white/70 mt-1">
                检测到以下资源出现负数，需要补充材料进行调整后才能继续游戏：
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {negativeResources.map((key) => (
                  <span
                    key={key}
                    className="px-3 py-1 bg-danger-500/30 text-danger-300 text-sm rounded-full"
                  >
                    {RESOURCE_LABELS[key]}: {formatNumber(currentResources[key])}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-white/80">资源调整</label>
              <button
                onClick={addEffect}
                className="flex items-center gap-1 text-sm text-accent-400 hover:text-accent-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加调整项
              </button>
            </div>

            {effects.length === 0 && (
              <div className="p-8 bg-white/5 rounded-lg text-center text-white/50">
                点击上方"添加调整项"按钮添加资源调整
              </div>
            )}

            <div className="space-y-3">
              {effects.map((effect, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 bg-white/5 rounded-lg"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-500/20 flex items-center justify-center text-accent-400 text-sm font-medium">
                    {index + 1}
                  </div>

                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div>
                      <select
                        value={effect.resource}
                        onChange={(e) => updateEffect(index, 'resource', e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                      >
                        {resourceKeys.map((key) => (
                          <option key={key} value={key} className="bg-primary-900">
                            {RESOURCE_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={effect.type}
                        onChange={(e) => updateEffect(index, 'type', e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                      >
                        <option value="absolute" className="bg-primary-900">绝对值</option>
                        <option value="percentage" className="bg-primary-900">百分比</option>
                      </select>
                    </div>

                    <div>
                      <input
                        type="number"
                        value={effect.change}
                        onChange={(e) => updateEffect(index, 'change', parseFloat(e.target.value) || 0)}
                        step="0.1"
                        className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                        placeholder="调整数值"
                      />
                    </div>
                  </div>

                  <div className="text-sm text-white/60">
                    {effect.change > 0 ? '+' : ''}
                    {formatNumber(effect.change)}
                    {effect.type === 'percentage' ? '%' : RESOURCE_UNITS[effect.resource]}
                  </div>

                  <button
                    onClick={() => removeEffect(index)}
                    className="p-2 text-danger-400 hover:bg-danger-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {errors.effects && (
              <p className="mt-2 text-sm text-danger-400">{errors.effects}</p>
            )}
          </div>

          {effects.length > 0 && (
            <div className="p-4 bg-primary-900/30 rounded-lg border border-primary-500/30">
              <h4 className="text-sm font-medium text-accent-400 mb-3">调整预览</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {resourceKeys.map((key) => {
                  const current = currentResources[key];
                  const preview = previewResources[key];
                  const diff = preview - current;
                  const hasChange = Math.abs(diff) > 0.001;

                  return (
                    <div key={key} className="text-sm">
                      <span className="text-white/60">{RESOURCE_LABELS[key]}：</span>
                      <span className={`font-mono ${hasChange ? 'text-accent-400' : 'text-white'}`}>
                        {formatNumber(current)}%
                      </span>
                      {hasChange && (
                        <span className="text-success-400 ml-1">
                          → {formatNumber(preview)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              补充材料说明
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请说明补充材料的原因和依据..."
              rows={3}
              className={`w-full px-4 py-3 bg-white/5 border rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none ${
                errors.reason ? 'border-danger-500' : 'border-white/20'
              }`}
            />
            {errors.reason && (
              <p className="mt-1 text-sm text-danger-400">{errors.reason}</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 btn-secondary">
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || effects.length === 0}
              className="flex-1 btn-accent flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isLoading ? '提交中...' : '提交补充材料'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

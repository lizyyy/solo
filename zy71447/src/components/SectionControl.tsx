import { useState } from 'react';
import { Layers, Eye, EyeOff, RotateCcw, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SectionParams, Axis, MaterialGroup } from '@/types';
import { BusinessRules } from '@/utils/businessRules';

interface SectionControlProps {
  params: SectionParams;
  materialGroups: MaterialGroup[];
  onChange: (params: Partial<SectionParams>) => void;
  onToggleMaterial: (id: string) => void;
  onReset: () => void;
  dimensions: { width: number; height: number; depth: number };
}

const axisLabels: Record<Axis, string> = {
  x: 'X轴（横向）',
  y: 'Y轴（纵向）',
  z: 'Z轴（深度）',
};

export function SectionControl({
  params,
  materialGroups,
  onChange,
  onToggleMaterial,
  onReset,
  dimensions,
}: SectionControlProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const validation = BusinessRules.validateSectionPosition(
    params.axis,
    params.position,
    dimensions
  );

  const handleAxisChange = (axis: Axis) => {
    onChange({ axis, position: 0 });
  };

  const handlePositionChange = (value: number) => {
    onChange({ position: value });
  };

  return (
    <div className="card-panel space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-bronze-500" />
          <h3 className="font-serif text-lg text-bronze-400">剖面控制</h3>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="p-1 hover:bg-charcoal-700 rounded transition-colors"
          >
            <Info size={14} className="text-gray-500 hover:text-bronze-400" />
          </button>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-bronze-400 transition-colors"
        >
          <RotateCcw size={12} />
          重置
        </button>
      </div>

      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-walnut-900/30 rounded-lg border border-bronze-700/30">
              <p className="text-xs text-bronze-300 font-mono leading-relaxed">
                {BusinessRules.getExplanation('section_cut').explanation}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {BusinessRules.getExplanation('section_cut').ruleBasis}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <div className="flex gap-2">
          {(Object.keys(axisLabels) as Axis[]).map((axis) => (
            <button
              key={axis}
              onClick={() => handleAxisChange(axis)}
              className={`
                flex-1 py-2 px-3 rounded-lg font-mono text-xs
                transition-all duration-200
                ${params.axis === axis
                  ? 'bg-bronze-600 text-white shadow-bronze-glow'
                  : 'bg-charcoal-800 text-gray-400 hover:bg-charcoal-700'
                }
              `}
            >
              {axisLabels[axis]}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-gray-400">切割位置</span>
            <span className={validation.valid ? 'text-gray-300' : 'text-acoustic-high'}>
              {params.position.toFixed(4)} m
            </span>
          </div>
          <input
            type="range"
            min={validation.min}
            max={validation.max}
            step={(validation.max - validation.min) / 200}
            value={params.position}
            onChange={(e) => handlePositionChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-charcoal-700 rounded-lg appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-4
                       [&::-webkit-slider-thumb]:h-4
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-bronze-500
                       [&::-webkit-slider-thumb]:shadow-bronze-glow
                       [&::-webkit-slider-thumb]:cursor-pointer
                       [&::-webkit-slider-thumb]:transition-all
                       [&::-webkit-slider-thumb]:hover:scale-110"
          />
          <div className="flex justify-between text-xs text-gray-600 font-mono">
            <span>{validation.min.toFixed(2)}</span>
            <span>{validation.max.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              onClick={() => onChange({ showCutSurface: !params.showCutSurface })}
              className={`
                p-1.5 rounded transition-colors
                ${params.showCutSurface ? 'text-bronze-500' : 'text-gray-500'}
              `}
            >
              {params.showCutSurface ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <span className="text-sm text-gray-400">显示切割面</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              onClick={() => onChange({ showInternal: !params.showInternal })}
              className={`
                p-1.5 rounded transition-colors
                ${params.showInternal ? 'text-bronze-500' : 'text-gray-500'}
              `}
            >
              {params.showInternal ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <span className="text-sm text-gray-400">显示内部</span>
          </label>
        </div>
      </div>

      <div className="pt-3 border-t border-charcoal-700">
        <h4 className="text-xs text-gray-500 font-mono mb-2">材质显示</h4>
        <div className="space-y-2">
          {materialGroups.map((material) => (
            <label
              key={material.id}
              className="flex items-center gap-2 p-2 rounded hover:bg-charcoal-800 cursor-pointer transition-colors"
            >
              <div
                className="w-4 h-4 rounded border border-charcoal-600"
                style={{ backgroundColor: material.visible ? material.color : 'transparent' }}
              />
              <span
                className={`text-sm flex-1 ${material.visible ? 'text-gray-300' : 'text-gray-600'}`}
              >
                {material.name}
              </span>
              <button
                onClick={() => onToggleMaterial(material.id)}
                className={`
                  w-10 h-5 rounded-full transition-all duration-200 relative
                  ${material.visible ? 'bg-bronze-600' : 'bg-charcoal-700'}
                `}
              >
                <div
                  className={`
                    absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200
                    ${material.visible ? 'left-5' : 'left-0.5'}
                  `}
                />
              </button>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

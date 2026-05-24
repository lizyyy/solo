import { useState } from 'react';
import { ChevronDown, ChevronUp, Truck, Ruler, RefreshCw } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { VehicleParams } from '../../types';

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

function SliderInput({ label, value, min, max, step, unit, onChange }: SliderInputProps) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm text-gray-400">{label}</label>
        <span className="text-sm font-medium text-white">
          {value.toFixed(1)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}

export function ControlPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const { vehicle, vehiclePresets, updateVehicleParam, setVehicle } = useSimulationStore();

  return (
    <div className="absolute left-4 top-20 w-72 bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-10">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-white">车辆参数配置</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4">
          <div className="mb-6">
            <label className="text-sm text-gray-400 mb-2 block">选择预设车型</label>
            <select
              value={vehicle.id}
              onChange={(e) => {
                const preset = vehiclePresets.find((v) => v.id === e.target.value);
                if (preset) setVehicle(preset);
              }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {vehiclePresets.map((v: VehicleParams) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 mb-4 text-gray-400">
            <Ruler className="w-4 h-4" />
            <span className="text-sm font-medium">尺寸调节</span>
          </div>

          <SliderInput
            label="车长"
            value={vehicle.length}
            min={4}
            max={20}
            step={0.1}
            unit="米"
            onChange={(v) => updateVehicleParam('length', v)}
          />

          <SliderInput
            label="车宽"
            value={vehicle.width}
            min={1.8}
            max={3}
            step={0.1}
            unit="米"
            onChange={(v) => updateVehicleParam('width', v)}
          />

          <SliderInput
            label="轴距"
            value={vehicle.wheelbase}
            min={2}
            max={12}
            step={0.1}
            unit="米"
            onChange={(v) => updateVehicleParam('wheelbase', v)}
          />

          <SliderInput
            label="转弯半径"
            value={vehicle.turningRadius}
            min={5}
            max={20}
            step={0.5}
            unit="米"
            onChange={(v) => updateVehicleParam('turningRadius', v)}
          />

          <SliderInput
            label="车高"
            value={vehicle.height}
            min={2}
            max={5}
            step={0.1}
            unit="米"
            onChange={(v) => updateVehicleParam('height', v)}
          />

          <button
            onClick={() => {
              const preset = vehiclePresets.find((v) => v.id === vehicle.id);
              if (preset) setVehicle(preset);
            }}
            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">重置为预设值</span>
          </button>
        </div>
      )}
    </div>
  );
}

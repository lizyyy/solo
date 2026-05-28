import { useState } from 'react';
import { GateType, MeasurementBasis } from '@/types';
import { useGameStore } from '@/store/gameStore';
import {
  QuantumGate,
  NoiseCardComponent,
  DraggableGate,
  DroppableSlot,
} from '@/components/gates/QuantumGate';
import { getGateInfo } from '@/utils/quantum/quantumEngine';
import { cn } from '@/lib/utils';

interface CircuitEditorProps {
  activeGateType: GateType | null;
}

export const CircuitEditor = ({ activeGateType }: CircuitEditorProps) => {
  const { currentLevel, currentCircuit, addGate, removeGate, setMeasurementBasis } =
    useGameStore();

  if (!currentLevel || !currentCircuit) return null;

  const handleSlotClick = (qubit: number, slot: number) => {
    const existingGate = currentCircuit.gates.find(
      (g) => g.position.qubit === qubit && g.position.slot === slot
    );
    if (existingGate) {
      removeGate(existingGate.id);
    } else if (activeGateType) {
      const gateId = Math.random().toString(36).substring(2, 11);
      const controlQubit =
        activeGateType === 'CNOT'
          ? qubit > 0
            ? qubit - 1
            : 1
          : undefined;

      addGate({
        id: gateId,
        type: activeGateType,
        position: { qubit, slot },
        controlQubit,
      });
    }
  };

  const handleBasisChange = (qubit: number, basis: MeasurementBasis) => {
    setMeasurementBasis(qubit, basis);
  };

  const errorPositions = new Set<string>();
  const validationResult = useGameStore.getState().validationResult;
  if (validationResult) {
    validationResult.gateOrderErrors.forEach((error) => {
      errorPositions.add(`${error.position.qubit}-${error.position.slot}`);
    });
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
        量子电路编辑器
      </h3>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          {Array.from({ length: currentCircuit.qubits }).map((_, qubitIndex) => (
            <div key={qubitIndex} className="flex items-center gap-4 mb-4">
              <div className="w-20 flex items-center gap-2">
                <span className="text-cyan-400 font-mono text-sm">q{qubitIndex}</span>
                <span className="text-slate-500">|0⟩</span>
              </div>

              <div className="flex-1 flex items-center">
                <div className="h-0.5 bg-slate-600 flex-1"></div>
              </div>

              <div className="flex gap-2">
                {Array.from({ length: currentCircuit.slots }).map((__, slotIndex) => {
                  const gate = currentCircuit.gates.find(
                    (g) => g.position.qubit === qubitIndex && g.position.slot === slotIndex
                  );
                  const noise = currentCircuit.noiseCards.find(
                    (n) => n.position.qubit === qubitIndex && n.position.slot === slotIndex
                  );
                  const isError = errorPositions.has(`${qubitIndex}-${slotIndex}`);
                  const slotId = `slot-${qubitIndex}-${slotIndex}`;
                  const isOccupied = !!(gate || noise);

                  return (
                    <div key={slotIndex} className="relative">
                      {noise && !gate && (
                        <NoiseCardComponent
                          type={noise.type}
                          onRemove={
                            currentLevel.requiredNoise ? undefined : () => removeGate(noise.id)
                          }
                        />
                      )}
                      {gate && (
                        <QuantumGate
                          type={gate.type}
                          isError={isError}
                          onRemove={() => removeGate(gate.id)}
                          size="md"
                          showLabel={false}
                        />
                      )}
                      {!isOccupied && (
                        <DroppableSlot
                          id={slotId}
                          qubit={qubitIndex}
                          slot={slotIndex}
                          isOccupied={isOccupied}
                          isError={isError}
                          onClick={() => handleSlotClick(qubitIndex, slotIndex)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex-1 flex items-center">
                <div className="h-0.5 bg-slate-600 flex-1"></div>
              </div>

              <div className="w-24 flex items-center gap-2">
                <span className="text-slate-400 text-sm">测量基:</span>
                <select
                  value={currentCircuit.measurementBasis[qubitIndex]}
                  onChange={(e) =>
                    handleBasisChange(qubitIndex, e.target.value as MeasurementBasis)
                  }
                  className="bg-slate-700 text-white text-sm px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-cyan-400"
                >
                  <option value="Z">Z</option>
                  <option value="X">X</option>
                  <option value="Y">Y</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          <span className="text-cyan-400">提示:</span> 从左侧门库拖拽量子门到电路中，点击已放置的门可移除
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-slate-700 rounded text-xs text-slate-300">
            量子位: {currentCircuit.qubits}
          </span>
          <span className="px-3 py-1 bg-slate-700 rounded text-xs text-slate-300">
            门槽: {currentCircuit.slots}
          </span>
        </div>
      </div>
    </div>
  );
};

export const GateLibrary = () => {
  const { currentLevel } = useGameStore();
  const [selectedGate, setSelectedGate] = useState<GateType | null>(null);

  if (!currentLevel) return null;

  const handleGateClick = (gateType: GateType) => {
    setSelectedGate(gateType);
  };

  const availableGates = currentLevel.availableGates;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">量子门库</h3>

      <div className="grid grid-cols-2 gap-3">
        {availableGates.map((gateType, index) => {
          const gateInfo = getGateInfo(gateType);
          const draggableId = `gate-${gateType}-${index}`;

          return (
            <div
              key={gateType}
              onClick={() => handleGateClick(gateType)}
              className={cn(
                'p-3 rounded-lg transition-all duration-200',
                'bg-slate-700/50 hover:bg-slate-700 border border-transparent',
                'hover:border-cyan-400/50',
                selectedGate === gateType && 'border-cyan-400 bg-cyan-400/10'
              )}
            >
              <div className="flex items-center gap-3">
                <DraggableGate gateType={gateType} id={draggableId} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm truncate">
                    {gateInfo.name}
                  </div>
                  <div className="text-slate-400 text-xs truncate">{gateInfo.symbol}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500 line-clamp-2">
                {gateInfo.description}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
        <div className="text-xs text-slate-400 mb-2">拖拽说明</div>
        <div className="text-xs text-slate-500">
          拖动量子门到电路的空白槽位上释放即可放置
        </div>
      </div>
    </div>
  );
};

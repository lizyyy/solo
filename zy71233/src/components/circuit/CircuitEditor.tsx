import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { GateType, MeasurementBasis } from '@/types';
import { useGameStore } from '@/store/gameStore';
import { QuantumGate, GateSlot, NoiseCardComponent } from '@/components/gates/QuantumGate';
import { getGateInfo } from '@/utils/quantum/quantumEngine';
import { cn } from '@/lib/utils';

export const CircuitEditor = () => {
  const { currentLevel, currentCircuit, addGate, removeGate, setMeasurementBasis } =
    useGameStore();
  const [activeGate, setActiveGate] = useState<GateType | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ qubit: number; slot: number } | null>(null);

  if (!currentLevel || !currentCircuit) return null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveGate(event.active.id as GateType);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveGate(null);
    setHoveredSlot(null);

    const { over, active } = event;
    if (!over) return;

    const overId = over.id as string;
    if (overId.startsWith('slot-')) {
      const [, qubitStr, slotStr] = overId.split('-');
      const qubit = parseInt(qubitStr);
      const slot = parseInt(slotStr);

      const gateType = active.id as GateType;
      const gateId = Math.random().toString(36).substring(2, 11);

      addGate({
        id: gateId,
        type: gateType,
        position: { qubit, slot },
      });
    }
  };

  const handleSlotClick = (qubit: number, slot: number) => {
    const existingGate = currentCircuit.gates.find(
      (g) => g.position.qubit === qubit && g.position.slot === slot
    );
    if (existingGate) {
      removeGate(existingGate.id);
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
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                        {!noise && !gate && (
                          <GateSlot
                            isHighlighted={
                              hoveredSlot?.qubit === qubitIndex &&
                              hoveredSlot?.slot === slotIndex
                            }
                            isError={isError}
                            onClick={() => handleSlotClick(qubitIndex, slotIndex)}
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

      <DragOverlay>
        {activeGate && (
          <div className="opacity-80">
            <QuantumGate type={activeGate} size="md" showLabel={false} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export const GateLibrary = () => {
  const { currentLevel, addGate } = useGameStore();
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
        {availableGates.map((gateType) => {
          const gateInfo = getGateInfo(gateType);
          return (
            <div
              key={gateType}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('gateType', gateType);
                handleGateClick(gateType);
              }}
              onClick={() => handleGateClick(gateType)}
              className={cn(
                'p-3 rounded-lg cursor-pointer transition-all duration-200',
                'bg-slate-700/50 hover:bg-slate-700 border border-transparent',
                'hover:border-cyan-400/50 active:scale-95'
              )}
            >
              <div className="flex items-center gap-3">
                <QuantumGate type={gateType} size="sm" showLabel={false} />
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

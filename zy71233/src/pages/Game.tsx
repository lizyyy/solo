import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useGameStore } from '@/store/gameStore';
import { CircuitEditor, GateLibrary } from '@/components/circuit/CircuitEditor';
import { ProbabilityDisplay, ValidationResultPanel } from '@/components/circuit/ProbabilityDisplay';
import { QuantumGate } from '@/components/gates/QuantumGate';
import { ArrowLeft, RotateCcw, Send, Lightbulb, Download } from 'lucide-react';
import { GateType } from '@/types';
import { cn } from '@/lib/utils';

export default function Game() {
  const navigate = useNavigate();
  const { levelId } = useParams<{ levelId: string }>();
  const {
    currentLevel,
    currentCircuit,
    validationResult,
    setCurrentLevel,
    submitAnswer,
    resetCircuit,
    exportReport,
    clearValidationResult,
    addGate,
  } = useGameStore();
  const [showHints, setShowHints] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [activeGateType, setActiveGateType] = useState<GateType | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const gateType = event.active.data.current?.gateType as GateType;
    setActiveGateType(gateType);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveGateType(null);

    const { over, active } = event;
    if (!over) return;

    const overId = over.id as string;
    if (overId.startsWith('slot-')) {
      const [, qubitStr, slotStr] = overId.split('-');
      const qubit = parseInt(qubitStr);
      const slot = parseInt(slotStr);

      const gateType = active.data.current?.gateType as GateType;
      if (gateType && currentLevel) {
        const gateId = Math.random().toString(36).substring(2, 11);

        const existingGate = currentCircuit?.gates.find(
          (g) => g.position.qubit === qubit && g.position.slot === slot
        );
        if (!existingGate) {
          const controlQubit =
            gateType === 'CNOT'
              ? qubit > 0
                ? qubit - 1
                : 1
              : undefined;

          addGate({
            id: gateId,
            type: gateType,
            position: { qubit, slot },
            controlQubit,
          });
        }
      }
    }
  };

  useEffect(() => {
    if (levelId) {
      setCurrentLevel(levelId);
    }
  }, [levelId, setCurrentLevel]);

  useEffect(() => {
    setCurrentHintIndex(0);
    setShowHints(false);
    clearValidationResult();
  }, [levelId, clearValidationResult]);

  if (!currentLevel || !currentCircuit) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    );
  }

  const handleBack = () => {
    navigate('/');
  };

  const handleSubmit = () => {
    submitAnswer();
  };

  const handleExport = () => {
    const report = exportReport();
    if (report) {
      const blob = new Blob([report], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quantum-report-${levelId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleNextHint = () => {
    if (currentLevel.hints.length > 0) {
      setCurrentHintIndex((prev) => (prev + 1) % currentLevel.hints.length);
    }
  };

  const difficultyColors = {
    easy: 'bg-green-500',
    medium: 'bg-yellow-500',
    hard: 'bg-red-500',
  };

  const difficultyLabels = {
    easy: '入门',
    medium: '进阶',
    hard: '专家',
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBack}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    {currentLevel.name}
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-xs text-white',
                        difficultyColors[currentLevel.difficulty]
                      )}
                    >
                      {difficultyLabels[currentLevel.difficulty]}
                    </span>
                  </h1>
                  <p className="text-sm text-slate-400">{currentLevel.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowHints(!showHints)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                >
                  <Lightbulb className="w-4 h-4" />
                  提示 ({currentLevel.hints.length})
                </button>
                <button
                  onClick={resetCircuit}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置
                </button>
                {validationResult && (
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    导出报告
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!!validationResult}
                  className={cn(
                    'flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all',
                    validationResult
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/25'
                  )}
                >
                  <Send className="w-4 h-4" />
                  {validationResult ? '已提交' : '提交答案'}
                </button>
              </div>
            </div>

            {showHints && currentLevel.hints.length > 0 && (
              <div className="mt-4 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-yellow-100">
                      提示 {currentHintIndex + 1}/{currentLevel.hints.length}:{' '}
                      {currentLevel.hints[currentHintIndex]}
                    </p>
                    {currentLevel.hints.length > 1 && (
                      <button
                        onClick={handleNextHint}
                        className="mt-2 text-sm text-yellow-400 hover:text-yellow-300"
                      >
                        下一条提示 →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-3">
              <GateLibrary />
            </div>

            <div className="col-span-12 lg:col-span-6 space-y-6">
              <CircuitEditor activeGateType={activeGateType} />

              {validationResult && (
                <div className="animate-fadeIn">
                  <ValidationResultPanel />
                </div>
              )}
            </div>

            <div className="col-span-12 lg:col-span-3 space-y-6">
              <ProbabilityDisplay />

              <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-4">目标概率</h3>
                <div className="space-y-2">
                  {Object.entries(currentLevel.targetProbabilities).map(([state, prob]) => (
                    <div key={state} className="flex items-center justify-between">
                      <span className="text-slate-300">|{state}⟩:</span>
                      <span className="font-mono text-cyan-400">{(prob * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                {currentLevel.requiredNoise && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="text-sm text-red-400 mb-2">⚠️ 本关包含噪声</div>
                    <div className="text-xs text-slate-400">
                      系统会自动添加噪声，请添加对应的抵消门
                    </div>
                  </div>
                )}
              </div>

              {validationResult && (
                <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-4">操作记录</h3>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {useGameStore
                      .getState()
                      .currentSession?.operations.slice(-10)
                      .map((op, index) => (
                        <div key={index} className="text-xs text-slate-400 flex items-center gap-2">
                          <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                          <span className="text-slate-500">
                            {new Date(op.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="text-slate-300">{op.type}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <DragOverlay>
          {activeGateType && (
            <div className="opacity-80 scale-110">
              <QuantumGate type={activeGateType} size="md" showLabel={false} isDragging />
            </div>
          )}
        </DragOverlay>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
        `}</style>
      </div>
    </DndContext>
  );
}

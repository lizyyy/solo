import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SimulationCanvas } from '@/components/game/SimulationCanvas';
import { ControlPanel } from '@/components/game/ControlPanel';
import { EnergyBar } from '@/components/game/EnergyBar';
import { StatusBar } from '@/components/game/StatusBar';
import { SettlementModal } from '@/components/game/SettlementModal';
import { useGameLoop } from '@/hooks/useGameLoop';
import { usePhysicsEngine } from '@/hooks/usePhysicsEngine';
import { useOrbitDetection } from '@/hooks/useOrbitDetection';
import { useGameStore } from '@/store/useGameStore';
import { useRecordStore, createExperimentRecord } from '@/store/useRecordStore';
import { calculateEnergyState } from '@/utils/physics/energy';
import type { EnergyState, ErrorMark } from '@/types';
import { DEFAULT_MARBLE } from '@/types';

interface SettlementData {
  result: 'escape' | 'collide' | 'orbit' | 'chaos' | 'timeout';
  duration: number;
  finalEnergy: EnergyState;
  errorMarks: ErrorMark[];
  summary: string;
  collisionBodyId?: string;
  orbitPeriod?: number;
  escapeDistance?: number;
}

export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const gameStore = useGameStore();
  const recordStore = useRecordStore();
  const physicsEngine = usePhysicsEngine();
  const orbitDetection = useOrbitDetection();

  const [showSettlement, setShowSettlement] = useState(false);
  const [settlementData, setSettlementData] = useState<SettlementData | null>(null);
  const [lastSavedRecordId, setLastSavedRecordId] = useState<string | null>(null);

  const {
    status,
    bodies,
    marble,
    physicsParams,
    launchAngle,
    launchSpeed,
    energyHistory,
    currentFrame,
    simulationTime,
    errorMarks,
    trajectoryBuffer,
  } = gameStore;

  const handleSettle = useCallback(
    (
      result: 'escape' | 'collide' | 'orbit' | 'chaos' | 'timeout',
      extra: { collisionBodyId?: string; orbitPeriod?: number; escapeDistance?: number } = {}
    ) => {
      const finalEnergy = calculateEnergyState(
        marble,
        bodies,
        physicsParams.gravitationalConstant
      );

      const summaryTemplates: Record<string, string> = {
        escape: `弹珠成功逃逸引力场！总能量 ${finalEnergy.total.toFixed(2)} > 0，达到逃逸条件。初速度 ${launchSpeed.toFixed(1)} px/s，角度 ${launchAngle.toFixed(1)}°，模拟时长 ${simulationTime.toFixed(3)} 秒。`,
        collide: `弹珠与星体碰撞失败。初速度 ${launchSpeed.toFixed(1)} px/s，角度 ${launchAngle.toFixed(1)}°，模拟时长 ${simulationTime.toFixed(3)} 秒。建议调整发射角度或降低初速度以避免碰撞。`,
        orbit: `弹珠进入稳定环绕轨道！轨道周期约 ${extra.orbitPeriod?.toFixed(3)} 秒。初速度 ${launchSpeed.toFixed(1)} px/s，角度 ${launchAngle.toFixed(1)}°，总能量 ${finalEnergy.total.toFixed(2)}。`,
        chaos: `弹珠进入混沌轨道，表现出三体系统的不可预测性。初速度 ${launchSpeed.toFixed(1)} px/s，角度 ${launchAngle.toFixed(1)}°，模拟时长 ${simulationTime.toFixed(3)} 秒。微小的初始条件变化会导致截然不同的结果。`,
        timeout: `模拟超时，弹珠仍在系统中运动。初速度 ${launchSpeed.toFixed(1)} px/s，角度 ${launchAngle.toFixed(1)}°，总能量 ${finalEnergy.total.toFixed(2)}。三体系统的长期行为具有不确定性。`,
      };

      const data: SettlementData = {
        result,
        duration: simulationTime,
        finalEnergy,
        errorMarks: [...errorMarks],
        summary: summaryTemplates[result],
        ...extra,
      };

      setSettlementData(data);
      setShowSettlement(true);
      gameStore.setStatus('settled');

      const record = createExperimentRecord({
        raw: {
          initialVelocity: {
            x: Math.cos((launchAngle * Math.PI) / 180) * launchSpeed,
            y: Math.sin((launchAngle * Math.PI) / 180) * launchSpeed,
          },
          initialPosition: { x: DEFAULT_MARBLE.x, y: DEFAULT_MARBLE.y },
          bodies: JSON.parse(JSON.stringify(bodies)),
          physicsParams: { ...physicsParams },
          launchAngle,
          launchSpeed,
        },
        conclusion: {
          result: data.result,
          duration: data.duration,
          finalEnergy: data.finalEnergy,
          collisionBodyId: data.collisionBodyId,
          orbitPeriod: data.orbitPeriod,
          escapeDistance: data.escapeDistance,
          errorMarks: data.errorMarks,
          summary: data.summary,
        },
        trajectory: {
          positions: [...trajectoryBuffer.positions],
          energies: [...trajectoryBuffer.energies],
          timestamps: [...trajectoryBuffer.timestamps],
        },
      });

      recordStore.saveRecord(record);
      setLastSavedRecordId(record.id);
    },
    [
      marble,
      bodies,
      physicsParams,
      launchAngle,
      launchSpeed,
      simulationTime,
      errorMarks,
      trajectoryBuffer,
      gameStore,
      recordStore,
    ]
  );

  const update = useCallback(
    (deltaTime: number) => {
      const result = physicsEngine.step();

      if (result.result !== 'continue') {
        handleSettle(result.result as 'escape' | 'collide' | 'timeout', {
          collisionBodyId: result.collisionBodyId,
          escapeDistance: result.escapeDistance,
        });
        return;
      }

      const orbitResult = orbitDetection.checkOrbit({ x: marble.x, y: marble.y });
      if (orbitResult.isOrbit) {
        handleSettle('orbit', { orbitPeriod: orbitResult.period });
        return;
      }
    },
    [physicsEngine, orbitDetection, handleSettle, marble.x, marble.y]
  );

  useGameLoop({
    onUpdate: update,
    isRunning: status === 'running',
  });

  const handleLaunch = useCallback(() => {
    gameStore.resetToReady();
    orbitDetection.reset();
    setTimeout(() => {
      gameStore.setStatus('running');
    }, 500);
  }, [gameStore, orbitDetection]);

  const handlePause = useCallback(() => {
    gameStore.setStatus('paused');
  }, [gameStore]);

  const handleResume = useCallback(() => {
    gameStore.setStatus('running');
  }, [gameStore]);

  const handleReset = useCallback(() => {
    gameStore.reset();
    orbitDetection.reset();
    setShowSettlement(false);
    setSettlementData(null);
    setLastSavedRecordId(null);
  }, [gameStore, orbitDetection]);

  const handleRestart = useCallback(() => {
    setShowSettlement(false);
    setSettlementData(null);
    gameStore.reset();
    orbitDetection.reset();
    setTimeout(() => {
      gameStore.resetToReady();
    }, 100);
  }, [gameStore, orbitDetection]);

  const handleViewReport = useCallback(() => {
    if (lastSavedRecordId) {
      recordStore.selectRecord(lastSavedRecordId);
      navigate('/reports');
    }
  }, [lastSavedRecordId, recordStore, navigate]);

  const handleReplay = useCallback(() => {
    setShowSettlement(false);
    alert('轨迹回放功能开发中...');
  }, []);

  const currentEnergy = useMemo(() => {
    if (energyHistory.length > 0) {
      return energyHistory[energyHistory.length - 1];
    }
    return calculateEnergyState(marble, bodies, physicsParams.gravitationalConstant);
  }, [energyHistory, marble, bodies, physicsParams.gravitationalConstant]);

  const energyBounds = useMemo(() => {
    let maxKinetic = 100;
    let minPotential = -100;

    for (const e of energyHistory) {
      if (e.kinetic > maxKinetic) maxKinetic = e.kinetic;
      if (e.potential < minPotential) minPotential = e.potential;
    }

    return { maxKinetic, minPotential };
  }, [energyHistory]);

  useEffect(() => {
    if (status === 'idle') {
      gameStore.setStatus('ready');
    }
  }, [status, gameStore]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-lg shadow-green-500/30">
              <span className="text-xl">🪐</span>
            </div>
            <div>
              <h1 className="text-lg font-bold font-mono tracking-wider text-green-400">
                三体引力弹珠台
              </h1>
              <p className="text-[10px] text-gray-500 font-mono">
                THREE-BODY GRAVITY SIMULATOR
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <button
              onClick={() => navigate('/')}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-mono transition-all',
                'bg-green-500/20 text-green-400 border border-green-500/40'
              )}
            >
              模拟实验
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="px-4 py-2 rounded-lg text-xs font-mono text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-all"
            >
              实验报告
            </button>
            <button
              onClick={() => navigate('/export')}
              className="px-4 py-2 rounded-lg text-xs font-mono text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-all"
            >
              数据导出
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <StatusBar
          status={status}
          simulationTime={simulationTime}
          currentFrame={currentFrame}
          errorCount={errorMarks.length}
        />

        <div className="mt-4 grid grid-cols-12 gap-4">
          <div className="col-span-3 space-y-4">
            <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
              <ControlPanel
                status={status}
                launchSpeed={launchSpeed}
                launchAngle={launchAngle}
                physicsParams={physicsParams}
                onLaunchSpeedChange={gameStore.setLaunchSpeed}
                onLaunchAngleChange={gameStore.setLaunchAngle}
                onPhysicsParamsChange={gameStore.setPhysicsParams}
                onLaunch={handleLaunch}
                onPause={handlePause}
                onResume={handleResume}
                onReset={handleReset}
              />
            </div>
          </div>

          <div className="col-span-6">
            <div className="flex justify-center">
              <SimulationCanvas
                bodies={bodies}
                marble={marble}
                status={status}
                launchAngle={launchAngle}
                launchSpeed={launchSpeed}
              />
            </div>
          </div>

          <div className="col-span-3 space-y-4">
            <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
              <EnergyBar
                energy={currentEnergy}
                maxKinetic={energyBounds.maxKinetic}
                minPotential={energyBounds.minPotential}
              />
            </div>

            <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
              <h4 className="text-xs text-gray-400 font-mono mb-3 tracking-wider">实验说明</h4>
              <div className="space-y-2 text-[11px] text-gray-500 font-mono leading-relaxed">
                <p>📌 <span className="text-gray-400">目标：</span>调整初速度和角度，让弹珠成功逃逸引力场。</p>
                <p>📌 <span className="text-gray-400">判据：</span>总能量 E &gt; 0 时弹珠可逃逸。</p>
                <p>📌 <span className="text-gray-400">注意：</span>三体系统具有混沌特性，微小的初始条件变化会导致截然不同的结果。</p>
                <p>📌 <span className="text-gray-400">异常：</span>系统会自动标记计算过程中的异常，如引力方向错误、速度溢出、碰撞漏判等。</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {settlementData && (
        <SettlementModal
          isOpen={showSettlement}
          result={settlementData.result}
          duration={settlementData.duration}
          finalEnergy={settlementData.finalEnergy}
          errorMarks={settlementData.errorMarks}
          summary={settlementData.summary}
          collisionBodyId={settlementData.collisionBodyId}
          orbitPeriod={settlementData.orbitPeriod}
          escapeDistance={settlementData.escapeDistance}
          onClose={() => setShowSettlement(false)}
          onRestart={handleRestart}
          onViewReport={handleViewReport}
          onReplay={handleReplay}
        />
      )}
    </div>
  );
};

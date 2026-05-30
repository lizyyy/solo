import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSimulationStore } from '@/store/useSimulationStore';
import { useUIStore } from '@/store/useUIStore';
import { generateEnergyConservationExplanation } from '@/utils/explanation/generator';
import ReactMarkdown from 'react-markdown';
import { Play, Pause, SkipBack, SkipForward, X, AlertTriangle, Edit3 } from 'lucide-react';
import type { DataPoint } from '@/types/simulation';

function RampMesh({ angle, length }: { angle: number; length: number }) {
  const angleRad = (angle * Math.PI) / 180;
  const height = length * Math.sin(angleRad);
  const base = length * Math.cos(angleRad);

  return (
    <group>
      <mesh position={[base / 2 - 2, height / 2, 0]} rotation={[0, 0, -angleRad]}>
        <boxGeometry args={[length, 0.1, 2]} />
        <meshStandardMaterial color="#4273c4" transparent opacity={0.85} />
      </mesh>
      <mesh position={[-2, height / 2, 0]}>
        <boxGeometry args={[0.1, height, 2]} />
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
      <mesh position={[base / 2 - 2, 0, 0]}>
        <boxGeometry args={[base + 0.1, 0.1, 2]} />
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
    </group>
  );
}

function SkateboardMesh({ position, angle }: { position: number; angle: number }) {
  const angleRad = (angle * Math.PI) / 180;
  const rampLength = 10;
  const effectivePos = Math.min(Math.max(position, 0), rampLength);
  const x = effectivePos * Math.cos(angleRad) - 2;
  const y = (rampLength - effectivePos) * Math.sin(angleRad) + 0.15;

  return (
    <mesh position={[x, y, 0]}>
      <boxGeometry args={[0.6, 0.08, 0.6]} />
      <meshStandardMaterial color="#ff8f42" />
    </mesh>
  );
}

function SceneContent() {
  const { currentSimulation, currentTime } = useSimulationStore();

  if (!currentSimulation) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
    );
  }

  const angle = currentSimulation.physicsParams.rampAngle;
  const length = currentSimulation.physicsParams.rampLength;
  const dataPoint = currentSimulation.dataPoints.find(
    (d: DataPoint) => Math.abs(d.timestamp - currentTime) < 0.02
  );
  const pos = dataPoint?.position ?? 0;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <RampMesh angle={angle} length={length} />
      <SkateboardMesh position={pos} angle={angle} />
      <gridHelper args={[20, 20, '#1e3a5f', '#0e203a']} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
    </>
  );
}

function ExplanationPanel() {
  const { currentSimulation } = useSimulationStore();
  const { setShowExplanation } = useUIStore();

  if (!currentSimulation) return null;

  const explanation = generateEnergyConservationExplanation(
    currentSimulation.dataPoints,
    currentSimulation.physicsParams
  );

  return (
    <div className="flex h-full w-96 flex-col border-l border-primary-700/30 bg-primary-900">
      <div className="flex items-center justify-between border-b border-primary-700/30 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">物理解释</h3>
        <button onClick={() => setShowExplanation(false)} className="text-primary-300 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm text-primary-200 prose prose-invert prose-sm max-w-none">
        <ReactMarkdown>{explanation}</ReactMarkdown>
      </div>
    </div>
  );
}

function Timeline() {
  const { currentSimulation, currentTime, setCurrentTime, isPlaying, togglePlay, playbackSpeed, setPlaybackSpeed } = useSimulationStore();
  const { PLAYBACK_SPEEDS } = { PLAYBACK_SPEEDS: [0.25, 0.5, 1, 2, 4] };
  const maxTime = currentSimulation
    ? currentSimulation.dataPoints[currentSimulation.dataPoints.length - 1]?.timestamp ?? 0
    : 0;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(parseFloat(e.target.value));
  };

  return (
    <div className="flex h-20 items-center gap-4 border-t border-primary-700/30 bg-primary-900 px-4">
      <button
        onClick={togglePlay}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-500 transition-colors"
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        onClick={() => setCurrentTime(Math.max(0, currentTime - 0.5))}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-800 text-primary-200 hover:text-white transition-colors"
      >
        <SkipBack size={14} />
      </button>
      <button
        onClick={() => setCurrentTime(Math.min(maxTime, currentTime + 0.5))}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-800 text-primary-200 hover:text-white transition-colors"
      >
        <SkipForward size={14} />
      </button>

      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs font-mono text-primary-300 w-14 text-right">{currentTime.toFixed(2)}s</span>
        <input
          type="range"
          min={0}
          max={maxTime}
          step={0.01}
          value={currentTime}
          onChange={handleSliderChange}
          className="flex-1 h-1 appearance-none bg-primary-700 rounded-full accent-accent-400 cursor-pointer"
        />
        <span className="text-xs font-mono text-primary-300 w-14">{maxTime.toFixed(2)}s</span>
      </div>

      <select
        value={playbackSpeed}
        onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
        className="input-field text-xs py-1 px-2 w-20"
      >
        {PLAYBACK_SPEEDS.map((s) => (
          <option key={s} value={s}>{s}x</option>
        ))}
      </select>
    </div>
  );
}

function AnomalyPanel() {
  const { currentSimulation, confirmAnomaly } = useSimulationStore();
  const { setShowAnomalyPanel } = useUIStore();

  if (!currentSimulation) return null;

  const unconfirmed = currentSimulation.anomalies.filter((a) => !a.isConfirmed);

  return (
    <div className="absolute top-4 right-4 w-80 card p-4 z-10 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">异常检测</h3>
        <button onClick={() => setShowAnomalyPanel(false)} className="text-primary-300 hover:text-white">
          <X size={16} />
        </button>
      </div>
      {unconfirmed.length === 0 ? (
        <p className="text-xs text-primary-300">无待确认异常</p>
      ) : (
        <div className="space-y-2">
          {unconfirmed.map((a) => (
            <div key={a.id} className="rounded-lg bg-primary-800/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className={
                  a.severity === 'critical' ? 'text-danger-400' :
                  a.severity === 'high' ? 'text-warning-400' :
                  a.severity === 'medium' ? 'text-accent-400' : 'text-primary-300'
                } />
                <span className={`badge-anomaly-${a.severity}`}>{a.severity}</span>
              </div>
              <p className="text-xs text-primary-200 mb-2">{a.description}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => confirmAnomaly(a.id, true, '当前用户')}
                  className="text-xs bg-success-500/20 text-success-400 px-2 py-1 rounded hover:bg-success-500/30"
                >
                  确认
                </button>
                <button
                  onClick={() => confirmAnomaly(a.id, false, '当前用户')}
                  className="text-xs bg-primary-600/20 text-primary-200 px-2 py-1 rounded hover:bg-primary-600/30"
                >
                  否决
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SupplementModal() {
  const { currentSimulation, supplementData } = useSimulationStore();
  const { showSupplementModal, supplementPointId, setShowSupplementModal } = useUIStore();
  const velocityRef = useRef<HTMLInputElement>(null);
  const positionRef = useRef<HTMLInputElement>(null);

  if (!showSupplementModal || !supplementPointId || !currentSimulation) return null;

  const point = currentSimulation.dataPoints.find((d) => d.id === supplementPointId);
  if (!point) return null;

  const handleSubmit = () => {
    const velocity = velocityRef.current ? parseFloat(velocityRef.current.value) : undefined;
    const position = positionRef.current ? parseFloat(positionRef.current.value) : undefined;
    const data: Partial<DataPoint> = {};
    if (velocity !== undefined && !isNaN(velocity)) data.velocity = velocity;
    if (position !== undefined && !isNaN(position)) data.position = position;
    supplementData(supplementPointId, data);
    setShowSupplementModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card w-96 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">数据补录</h3>
          <button onClick={() => setShowSupplementModal(false)} className="text-primary-300 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-primary-300 mb-4">时间: {point.timestamp.toFixed(2)}s</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-primary-200 mb-1 block">位置 (m)</label>
            <input
              ref={positionRef}
              type="number"
              defaultValue={point.position}
              className="input-field w-full text-sm"
              step={0.01}
            />
          </div>
          <div>
            <label className="text-xs text-primary-200 mb-1 block">速度 (m/s)</label>
            <input
              ref={velocityRef}
              type="number"
              defaultValue={point.velocity}
              className="input-field w-full text-sm"
              step={0.01}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleSubmit} className="btn-primary text-sm flex-1">
            保存补录
          </button>
          <button onClick={() => setShowSupplementModal(false)} className="bg-primary-700 text-primary-200 px-4 py-2 rounded-lg text-sm hover:text-white transition-colors">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Scene3D() {
  const { currentSimulation } = useSimulationStore();
  const { showExplanation, showAnomalyPanel, showSupplementModal, setShowAnomalyPanel, setShowSupplementModal } = useUIStore();

  const handleCanvasClick = () => {
    if (currentSimulation && currentSimulation.anomalies.some((a) => !a.isConfirmed)) {
      setShowAnomalyPanel(!showAnomalyPanel);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1" onClick={handleCanvasClick}>
          <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
            <SceneContent />
          </Canvas>

          {!currentSimulation && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary-900/80">
              <div className="text-center">
                <p className="text-lg text-primary-200 mb-2">尚未创建模拟</p>
                <p className="text-sm text-primary-400">请在左侧导航栏点击"新建模拟"开始</p>
              </div>
            </div>
          )}

          {showAnomalyPanel && <AnomalyPanel />}

          {currentSimulation && currentSimulation.dataPoints.length > 0 && (
            <div className="absolute bottom-2 left-2 flex gap-1">
              <button
                onClick={() => setShowSupplementModal(true, currentSimulation.dataPoints[0]?.id)}
                className="flex items-center gap-1 rounded-lg bg-primary-800/80 px-2 py-1 text-xs text-primary-200 hover:text-white transition-colors"
              >
                <Edit3 size={12} />
                补录
              </button>
            </div>
          )}
        </div>

        {showExplanation && <ExplanationPanel />}
      </div>

      <Timeline />
      {showSupplementModal && <SupplementModal />}
    </div>
  );
}

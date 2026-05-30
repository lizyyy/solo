import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CanvasRenderer } from '../../engine/renderer/canvas';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useEditorStore } from '../../store/useEditorStore';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, FastForward, Eye, EyeOff, BarChart3, Edit3 } from 'lucide-react';

export function SimulationView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const animationRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const {
    currentTrajectory,
    currentRecord,
    currentFrame,
    isRunning,
    isPaused,
    playbackSpeed,
    showVectors,
    simulationResult,
    runSimulationStep,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    seekToFrame,
    setPlaybackSpeed,
    setShowVectors,
    stopSimulation,
  } = useSimulationStore();

  const { trackElements, magneticFields, loadFromRecord } = useEditorStore();

  useEffect(() => {
    if (!currentRecord) {
      navigate('/editor');
      return;
    }

    loadFromRecord({
      trackElements: currentRecord.trackElements,
      magneticFields: currentRecord.magneticFields,
      particleConfig: currentRecord.particleConfig,
      sampleSource: currentRecord.sampleSource,
    });
  }, [currentRecord, navigate, loadFromRecord]);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }

    const renderer = rendererRef.current;
    if (!renderer) return;

    const elementsToRender = currentRecord?.trackElements || trackElements;
    const fieldsToRender = currentRecord?.magneticFields || magneticFields;

    renderer.clear();
    renderer.drawGrid();

    fieldsToRender.forEach((field) => {
      renderer.drawMagneticField(field, false);
    });

    elementsToRender.forEach((el) => {
      renderer.drawTrackElement(el, false);
    });

    if (currentTrajectory.length > 0) {
      const trajectoryToShow = currentTrajectory.slice(0, currentFrame + 1);
      renderer.drawTrajectory(trajectoryToShow, showVectors);

      if (simulationResult?.collisionPoint && currentFrame >= currentTrajectory.length - 1) {
        renderer.drawCollisionPoint(simulationResult.collisionPoint);
      }

      if (simulationResult?.success && currentFrame >= currentTrajectory.length - 1) {
        renderer.drawSuccessPoint(simulationResult.finalPosition);
      }
    }
  }, [currentTrajectory, currentFrame, showVectors, simulationResult, trackElements, magneticFields, currentRecord]);

  useEffect(() => {
    if (isRunning && !isPaused && currentTrajectory.length > 0) {
      const baseInterval = 30;
      const interval = baseInterval / playbackSpeed;

      let lastTime = 0;
      const animate = (time: number) => {
        if (time - lastTime >= interval) {
          runSimulationStep();
          lastTime = time;
        }

        if (currentFrame < currentTrajectory.length - 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          stopSimulation();
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, isPaused, playbackSpeed, currentFrame, currentTrajectory.length, runSimulationStep, stopSimulation]);

  const currentPoint = currentTrajectory[currentFrame];

  const handleGoToAnalysis = useCallback(() => {
    stopSimulation();
    navigate('/analysis');
  }, [stopSimulation, navigate]);

  const handleGoToEditor = useCallback(() => {
    stopSimulation();
    navigate('/editor');
  }, [stopSimulation, navigate]);

  const handleSkipBack = () => {
    seekToFrame(Math.max(0, currentFrame - 50));
  };

  const handleSkipForward = () => {
    seekToFrame(Math.min(currentTrajectory.length - 1, currentFrame + 50));
  };

  const progress = currentTrajectory.length > 1
    ? ((currentFrame) / (currentTrajectory.length - 1)) * 100
    : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="bg-space-deep rounded-xl border-2 border-tech-gray/30"
          />

          {simulationResult && currentFrame >= currentTrajectory.length - 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`absolute top-4 right-4 p-4 rounded-xl border-2 ${
                simulationResult.success
                  ? 'bg-neon-green/20 border-neon-green'
                  : 'bg-energy-red/20 border-energy-red'
              }`}
            >
              <div className="font-display font-bold text-xl">
                {simulationResult.success ? (
                  <span className="text-neon-green">✓ 成功！</span>
                ) : (
                  <span className="text-energy-red">✗ 失败</span>
                )}
              </div>
              {simulationResult.failureReason && (
                <div className="font-mono text-sm text-tech-light mt-1">
                  {simulationResult.failureReason}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <div className="bg-space-dark/90 backdrop-blur-md border-t border-tech-gray/30 p-4">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleSkipBack}
                className="p-2 rounded-lg bg-space-medium text-tech-light hover:text-white hover:bg-tech-gray transition-all"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                disabled={currentFrame === 0}
              >
                <SkipBack className="w-5 h-5" />
              </motion.button>

              <motion.button
                onClick={() => isPaused ? resumeSimulation() : pauseSimulation()}
                className="p-3 rounded-lg bg-plasma-blue text-space-deep hover:bg-plasma-cyan transition-all"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
              </motion.button>

              <motion.button
                onClick={handleSkipForward}
                className="p-2 rounded-lg bg-space-medium text-tech-light hover:text-white hover:bg-tech-gray transition-all"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                disabled={currentFrame >= currentTrajectory.length - 1}
              >
                <SkipForward className="w-5 h-5" />
              </motion.button>

              <motion.button
                onClick={resetSimulation}
                className="p-2 rounded-lg bg-space-medium text-tech-light hover:text-white hover:bg-tech-gray transition-all"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <RotateCcw className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={Math.max(0, currentTrajectory.length - 1)}
                value={currentFrame}
                onChange={(e) => seekToFrame(parseInt(e.target.value))}
                className="slider w-full"
              />
              <div className="flex justify-between text-xs font-mono text-tech-light mt-1">
                <span>帧: {currentFrame}</span>
                <span>总帧数: {currentTrajectory.length}</span>
                <span>进度: {progress.toFixed(1)}%</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <FastForward className="w-4 h-4 text-tech-light" />
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="input-field text-sm w-20 py-1"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                </select>
              </div>

              <motion.button
                onClick={() => setShowVectors(!showVectors)}
                className={`p-2 rounded-lg transition-all ${
                  showVectors
                    ? 'bg-plasma-blue/20 text-plasma-blue border border-plasma-blue/50'
                    : 'bg-space-medium text-tech-light hover:text-white'
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title={showVectors ? '隐藏矢量' : '显示矢量'}
              >
                {showVectors ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </motion.button>
            </div>
          </div>

          {currentPoint && (
            <div className="grid grid-cols-5 gap-3">
              <div className="bg-space-medium rounded-lg p-3">
                <div className="text-xs font-mono text-tech-light">位置</div>
                <div className="font-mono text-sm text-plasma-blue">
                  ({currentPoint.position.x.toFixed(1)}, {currentPoint.position.y.toFixed(1)})
                </div>
              </div>
              <div className="bg-space-medium rounded-lg p-3">
                <div className="text-xs font-mono text-tech-light">速度</div>
                <div className="font-mono text-sm text-neon-green">
                  ({currentPoint.velocity.x.toExponential(2)}, {currentPoint.velocity.y.toExponential(2)})
                </div>
              </div>
              <div className="bg-space-medium rounded-lg p-3">
                <div className="text-xs font-mono text-tech-light">受力</div>
                <div className="font-mono text-sm text-energy-red">
                  ({currentPoint.force.x.toExponential(2)}, {currentPoint.force.y.toExponential(2)})
                </div>
              </div>
              <div className="bg-space-medium rounded-lg p-3">
                <div className="text-xs font-mono text-tech-light">磁场</div>
                <div className="font-mono text-sm text-magnetic-purple">
                  {currentPoint.magneticField
                    ? `${currentPoint.magneticField.strength.toFixed(1)} T, ${currentPoint.magneticField.direction}`
                    : '无'}
                </div>
              </div>
              <div className="bg-space-medium rounded-lg p-3">
                <div className="text-xs font-mono text-tech-light">轨道内</div>
                <div className={`font-mono text-sm ${currentPoint.inTrack ? 'text-neon-green' : 'text-energy-red'}`}>
                  {currentPoint.inTrack ? '是' : '否'}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <motion.button
              onClick={handleGoToEditor}
              className="btn-secondary flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Edit3 className="w-4 h-4" />
              返回编辑
            </motion.button>
            <motion.button
              onClick={handleGoToAnalysis}
              className="btn-primary flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <BarChart3 className="w-4 h-4" />
              查看分析
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CanvasRenderer } from '../engine/renderer/canvas';
import { useSimulationStore } from '../store/useSimulationStore';
import { useEditorStore } from '../store/useEditorStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { diagnoseFailure } from '../utils/diagnosis';
import { DiagnosisCard } from '../components/analysis/DiagnosisCard';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, FastForward, Eye, EyeOff, Edit3, Download, Clock, BookOpen } from 'lucide-react';
import { exportToJSON, downloadFile, generateExportFilename } from '../utils/importExport';

export function ReplayView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const animationRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const {
    currentRecord,
    currentTrajectory,
    currentFrame,
    isRunning,
    isPaused,
    playbackSpeed,
    showVectors,
    simulationResult,
    setCurrentRecord,
    setCurrentTrajectory,
    setSimulationResult,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    seekToFrame,
    setPlaybackSpeed,
    setShowVectors,
    stopSimulation,
    clear: clearSimulation,
  } = useSimulationStore();

  const { loadFromRecord, clear: clearEditor } = useEditorStore();
  const { getRecord } = useHistoryStore();

  const diagnosis = useMemo(() => {
    if (!simulationResult || !currentRecord || currentTrajectory.length === 0) return null;
    return diagnoseFailure(
      simulationResult,
      currentTrajectory,
      currentRecord.trackElements,
      currentRecord.magneticFields,
      currentRecord.particleConfig
    );
  }, [simulationResult, currentTrajectory, currentRecord]);

  useEffect(() => {
    if (!currentRecord) {
      const params = new URLSearchParams(window.location.search);
      const recordId = params.get('id');
      if (recordId) {
        const record = getRecord(recordId);
        if (record) {
          setCurrentRecord(record);
          setCurrentTrajectory(record.trajectory);
          setSimulationResult(record.result);
        }
      }
    }

    if (!currentRecord) {
      navigate('/history');
      return;
    }

    loadFromRecord({
      trackElements: currentRecord.trackElements,
      magneticFields: currentRecord.magneticFields,
      particleConfig: currentRecord.particleConfig,
      sampleSource: currentRecord.sampleSource,
    });
  }, [currentRecord, navigate, loadFromRecord, getRecord, setCurrentRecord, setCurrentTrajectory, setSimulationResult]);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }

    const renderer = rendererRef.current;
    if (!renderer || !currentRecord) return;

    renderer.clear();
    renderer.drawGrid();

    currentRecord.magneticFields.forEach((field) => {
      renderer.drawMagneticField(field, false);
    });

    currentRecord.trackElements.forEach((el) => {
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
  }, [currentTrajectory, currentFrame, showVectors, simulationResult, currentRecord]);

  useEffect(() => {
    if (isRunning && !isPaused && currentTrajectory.length > 0) {
      const baseInterval = 30;
      const interval = baseInterval / playbackSpeed;

      let lastTime = 0;
      const animate = (time: number) => {
        if (time - lastTime >= interval) {
          if (currentFrame < currentTrajectory.length - 1) {
            seekToFrame(currentFrame + 1);
          } else {
            stopSimulation();
          }
          lastTime = time;
        }

        if (currentFrame < currentTrajectory.length - 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, isPaused, playbackSpeed, currentFrame, currentTrajectory.length, seekToFrame, stopSimulation]);

  const currentPoint = currentTrajectory[currentFrame];

  const handleGoToEditor = useCallback(() => {
    stopSimulation();
    if (currentRecord) {
      clearEditor();
      loadFromRecord({
        trackElements: currentRecord.trackElements,
        magneticFields: currentRecord.magneticFields,
        particleConfig: currentRecord.particleConfig,
        sampleSource: currentRecord.sampleSource,
      });
    }
    navigate('/editor');
  }, [stopSimulation, currentRecord, navigate, clearEditor, loadFromRecord]);

  const handleExport = () => {
    if (!currentRecord) return;
    const json = exportToJSON(currentRecord);
    const filename = generateExportFilename(currentRecord);
    downloadFile(json, filename);
  };

  const handleSkipBack = () => {
    seekToFrame(Math.max(0, currentFrame - 50));
  };

  const handleSkipForward = () => {
    seekToFrame(Math.min(currentTrajectory.length - 1, currentFrame + 50));
  };

  const progress = currentTrajectory.length > 1
    ? ((currentFrame) / (currentTrajectory.length - 1)) * 100
    : 0;

  if (!currentRecord || !simulationResult) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="text-tech-light font-mono">加载中...</div>
      </div>
    );
  }

  const dateStr = new Date(currentRecord.timestamp).toLocaleString('zh-CN');

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <div className="bg-space-dark/80 backdrop-blur-sm border-b border-tech-gray/30 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-white">
              复盘回放
            </h1>
            <div className="flex items-center gap-4 font-mono text-xs text-tech-light">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dateStr}
              </span>
              <span>{currentRecord.name}</span>
              {currentRecord.sampleSource && (
                <span className="text-plasma-blue">
                  来源: {currentRecord.sampleSource.replace('sample-', '')}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={handleExport}
              className="btn-secondary flex items-center gap-2 text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Download className="w-4 h-4" />
              导出
            </motion.button>
            <motion.button
              onClick={handleGoToEditor}
              className="btn-primary flex items-center gap-2 text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Edit3 className="w-4 h-4" />
              修改轨道
            </motion.button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
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

            {currentPoint && (
              <div className="absolute bottom-4 left-4 right-4 bg-space-dark/90 backdrop-blur-sm rounded-xl p-3 border border-tech-gray/30">
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <div className="text-xs font-mono text-tech-light">位置</div>
                    <div className="font-mono text-sm text-plasma-blue">
                      ({currentPoint.position.x.toFixed(1)}, {currentPoint.position.y.toFixed(1)})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-tech-light">速度</div>
                    <div className="font-mono text-sm text-neon-green">
                      ({currentPoint.velocity.x.toExponential(2)}, {currentPoint.velocity.y.toExponential(2)})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-tech-light">受力</div>
                    <div className="font-mono text-sm text-energy-red">
                      ({currentPoint.force.x.toExponential(2)}, {currentPoint.force.y.toExponential(2)})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-tech-light">磁场</div>
                    <div className="font-mono text-sm text-magnetic-purple">
                      {currentPoint.magneticField
                        ? `${currentPoint.magneticField.strength.toFixed(1)} T`
                        : '无'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-mono text-tech-light">轨道内</div>
                    <div className={`font-mono text-sm ${currentPoint.inTrack ? 'text-neon-green' : 'text-energy-red'}`}>
                      {currentPoint.inTrack ? '是' : '否'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-96 bg-space-dark/80 backdrop-blur-sm border-l border-tech-gray/30 p-4 overflow-y-auto">
          {diagnosis && (
            <div className="mb-4">
              <DiagnosisCard diagnosis={diagnosis} />
            </div>
          )}

          <div className="card mb-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-plasma-blue" />
              <h3 className="font-display font-bold text-white">复盘要点</h3>
            </div>
            <ul className="font-mono text-xs text-tech-light space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-plasma-blue">•</span>
                观察粒子在磁场中的偏转方向是否符合左手定则
              </li>
              <li className="flex items-start gap-2">
                <span className="text-plasma-blue">•</span>
                注意轨迹偏离轨道的具体位置和原因
              </li>
              <li className="flex items-start gap-2">
                <span className="text-plasma-blue">•</span>
                分析能量和磁场强度对偏转半径的影响
              </li>
              <li className="flex items-start gap-2">
                <span className="text-plasma-blue">•</span>
                检查轨道连接处是否存在间隙
              </li>
              <li className="flex items-start gap-2">
                <span className="text-plasma-blue">•</span>
                思考如何调整参数使粒子成功通过
              </li>
            </ul>
          </div>

          <div className="card">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-space-medium rounded-lg p-3">
                <div className="text-xs font-mono text-tech-light">模拟时间</div>
                <div className="font-mono text-sm text-plasma-blue">
                  {(simulationResult.totalTime * 1e6).toFixed(2)} μs
                </div>
              </div>
              <div className="bg-space-medium rounded-lg p-3">
                <div className="text-xs font-mono text-tech-light">总帧数</div>
                <div className="font-mono text-sm text-plasma-blue">
                  {simulationResult.totalFrames}
                </div>
              </div>
              <div className="bg-space-medium rounded-lg p-3">
                <div className="text-xs font-mono text-tech-light">初始能量</div>
                <div className="font-mono text-sm text-neon-green">
                  {(currentRecord.particleConfig.initialEnergy / 1e-15).toFixed(2)} × 10⁻¹⁵ J
                </div>
              </div>
              <div className="bg-space-medium rounded-lg p-3">
                <div className="text-xs font-mono text-tech-light">最终能量</div>
                <div className="font-mono text-sm text-neon-green">
                  {(simulationResult.finalEnergy / 1e-15).toFixed(2)} × 10⁻¹⁵ J
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-space-dark/90 backdrop-blur-md border-t border-tech-gray/30 p-4">
        <div className="max-w-5xl mx-auto">
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
        </div>
      </div>
    </div>
  );
}

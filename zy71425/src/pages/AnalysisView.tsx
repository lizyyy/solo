import { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSimulationStore } from '../store/useSimulationStore';
import { useEditorStore } from '../store/useEditorStore';
import { CanvasRenderer } from '../engine/renderer/canvas';
import { DiagnosisCard } from '../components/analysis/DiagnosisCard';
import { diagnoseFailure } from '../utils/diagnosis';
import { Download, Edit3, RotateCcw, BookOpen, CheckCircle, XCircle } from 'lucide-react';
import { exportToJSON, downloadFile, generateExportFilename } from '../utils/importExport';

export function AnalysisView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const navigate = useNavigate();

  const { currentRecord, simulationResult, currentTrajectory } = useSimulationStore();
  const { loadFromRecord, clear } = useEditorStore();

  const diagnosis = useMemo(() => {
    if (!simulationResult || !currentRecord) return null;
    return diagnoseFailure(
      simulationResult,
      currentTrajectory,
      currentRecord.trackElements,
      currentRecord.magneticFields,
      currentRecord.particleConfig
    );
  }, [simulationResult, currentTrajectory, currentRecord]);

  useEffect(() => {
    if (!currentRecord || !simulationResult) {
      navigate('/editor');
      return;
    }

    loadFromRecord({
      trackElements: currentRecord.trackElements,
      magneticFields: currentRecord.magneticFields,
      particleConfig: currentRecord.particleConfig,
      sampleSource: currentRecord.sampleSource,
    });
  }, [currentRecord, simulationResult, navigate, loadFromRecord]);

  useEffect(() => {
    if (!canvasRef.current || !currentRecord) return;

    if (!rendererRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }

    const renderer = rendererRef.current;
    renderer.clear();
    renderer.drawGrid();

    currentRecord.magneticFields.forEach((field) => {
      renderer.drawMagneticField(field, false);
    });

    currentRecord.trackElements.forEach((el) => {
      renderer.drawTrackElement(el, false);
    });

    if (currentTrajectory.length > 0) {
      renderer.drawTrajectory(currentTrajectory, false);

      if (simulationResult?.collisionPoint) {
        renderer.drawCollisionPoint(simulationResult.collisionPoint);
      }

      if (simulationResult?.success) {
        renderer.drawSuccessPoint(simulationResult.finalPosition);
      }
    }
  }, [currentRecord, currentTrajectory, simulationResult]);

  const handleExport = () => {
    if (!currentRecord) return;
    const json = exportToJSON(currentRecord);
    const filename = generateExportFilename(currentRecord);
    downloadFile(json, filename);
  };

  const handleGoToReplay = () => {
    navigate('/replay');
  };

  const handleGoToEditor = () => {
    if (currentRecord) {
      clear();
      loadFromRecord({
        trackElements: currentRecord.trackElements,
        magneticFields: currentRecord.magneticFields,
        particleConfig: currentRecord.particleConfig,
        sampleSource: currentRecord.sampleSource,
      });
    }
    navigate('/editor');
  };

  const handleNewDesign = () => {
    clear();
    useEditorStore.getState().clearAll();
    navigate('/editor');
  };

  if (!currentRecord || !simulationResult || !diagnosis) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="text-tech-light font-mono">加载中...</div>
      </div>
    );
  }

  const dateStr = new Date(currentRecord.timestamp).toLocaleString('zh-CN');

  return (
    <div className="min-h-[calc(100vh-80px)] p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-white mb-1">
                结果分析
              </h1>
              <p className="font-mono text-sm text-tech-light">
                {currentRecord.name} · {dateStr}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                onClick={handleExport}
                className="btn-secondary flex items-center gap-2 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-4 h-4" />
                导出数据
              </motion.button>
              <motion.button
                onClick={handleGoToEditor}
                className="btn-secondary flex items-center gap-2 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Edit3 className="w-4 h-4" />
                修改轨道
              </motion.button>
              <motion.button
                onClick={handleNewDesign}
                className="btn-primary flex items-center gap-2 text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RotateCcw className="w-4 h-4" />
                新建设计
              </motion.button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="card flex items-center gap-4"
          >
            <div className={`p-3 rounded-xl ${simulationResult.success ? 'bg-neon-green/20' : 'bg-energy-red/20'}`}>
              {simulationResult.success ? (
                <CheckCircle className="w-8 h-8 text-neon-green" />
              ) : (
                <XCircle className="w-8 h-8 text-energy-red" />
              )}
            </div>
            <div>
              <div className="font-mono text-xs text-tech-light">模拟结果</div>
              <div className={`font-display text-2xl font-bold ${simulationResult.success ? 'text-neon-green' : 'text-energy-red'}`}>
                {simulationResult.success ? '成功' : '失败'}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="font-mono text-xs text-tech-light mb-1">模拟时间</div>
            <div className="font-display text-2xl font-bold text-plasma-blue">
              {(simulationResult.totalTime * 1e6).toFixed(2)} μs
            </div>
            <div className="font-mono text-xs text-tech-light mt-1">
              共 {simulationResult.totalFrames} 帧
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="font-mono text-xs text-tech-light mb-1">最终能量</div>
            <div className="font-display text-2xl font-bold text-magnetic-purple">
              {(simulationResult.finalEnergy / 1e-15).toFixed(2)} × 10⁻¹⁵ J
            </div>
            <div className="font-mono text-xs text-tech-light mt-1">
              初始: {(currentRecord.particleConfig.initialEnergy / 1e-15).toFixed(2)} × 10⁻¹⁵ J
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <h3 className="font-display font-bold text-white mb-4">轨迹全貌</h3>
            <div className="flex items-center justify-center bg-space-deep rounded-xl p-4">
              <canvas
                ref={canvasRef}
                width={500}
                height={375}
                className="rounded-lg border border-tech-gray/30"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-space-medium rounded-lg p-3 text-center">
                <div className="font-mono text-xs text-tech-light">轨道元素</div>
                <div className="font-mono text-lg text-plasma-blue">
                  {currentRecord.trackElements.length}
                </div>
              </div>
              <div className="bg-space-medium rounded-lg p-3 text-center">
                <div className="font-mono text-xs text-tech-light">磁场块</div>
                <div className="font-mono text-lg text-magnetic-purple">
                  {currentRecord.magneticFields.length}
                </div>
              </div>
              <div className="bg-space-medium rounded-lg p-3 text-center">
                <div className="font-mono text-xs text-tech-light">轨迹点数</div>
                <div className="font-mono text-lg text-neon-green">
                  {currentTrajectory.length}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-4"
          >
            <DiagnosisCard diagnosis={diagnosis} onGoToReplay={handleGoToReplay} />

            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-plasma-blue" />
                <h3 className="font-display font-bold text-white">粒子配置</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-space-medium rounded-lg p-3">
                  <div className="font-mono text-xs text-tech-light">粒子类型</div>
                  <div className="font-mono text-sm text-white">
                    {currentRecord.particleConfig.name}
                  </div>
                </div>
                <div className="bg-space-medium rounded-lg p-3">
                  <div className="font-mono text-xs text-tech-light">电荷</div>
                  <div className="font-mono text-sm text-plasma-blue">
                    {currentRecord.particleConfig.charge.toExponential(2)} C
                  </div>
                </div>
                <div className="bg-space-medium rounded-lg p-3">
                  <div className="font-mono text-xs text-tech-light">质量</div>
                  <div className="font-mono text-sm text-plasma-blue">
                    {currentRecord.particleConfig.mass.toExponential(2)} kg
                  </div>
                </div>
                <div className="bg-space-medium rounded-lg p-3">
                  <div className="font-mono text-xs text-tech-light">初始速度</div>
                  <div className="font-mono text-sm text-neon-green">
                    {currentRecord.particleConfig.initialVelocity.x.toExponential(2)} m/s
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

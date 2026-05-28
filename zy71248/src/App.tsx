
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ColorParams, ScoreResult, GradingReport, Level, LevelProgress } from './types';
import { LEVELS } from './data/levels';
import { useColorGrading } from './hooks/useColorGrading';
import { useHistory } from './hooks/useHistory';
import { calculateScore } from './utils/scoring';
import { detectIssues, generateId } from './utils/colorMath';
import {
  saveReport,
  exportReportAsPDF,
  captureComparisonScreenshot,
  downloadScreenshot,
} from './utils/reportGenerator';
import { CanvasPreview } from './components/CanvasPreview';
import { ParameterSlider } from './components/ParameterSlider';
import { ScorePanel } from './components/ScorePanel';
import { HistoryTimeline } from './components/HistoryTimeline';
import { LUTSelector } from './components/LUTSelector';
import { ReportModal } from './components/ReportModal';
import { LevelSelect } from './components/LevelSelect';
import { Camera, RotateCcw, Send, BarChart3, Sparkles } from 'lucide-react';

const INITIAL_PARAMS: ColorParams = {
  exposure: 0,
  temperature: 6500,
  lutId: null,
  lutIntensity: 50,
};

const PROGRESS_KEY = 'color_challenge_progress';

function App() {
  const [currentLevel, setCurrentLevel] = useState<Level>(LEVELS[0]);
  const [params, setParams] = useState<ColorParams>(INITIAL_PARAMS);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [currentReport, setCurrentReport] = useState<GradingReport | null>(null);
  const [completedLevels, setCompletedLevels] = useState<Record<string, LevelProgress>>({});

  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const targetImageRef = useRef<HTMLImageElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const sourceImageLoadedRef = useRef(false);

  const { processImage } = useColorGrading();
  const history = useHistory(INITIAL_PARAMS);

  useEffect(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    if (saved) {
      setCompletedLevels(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (!sourceImageLoadedRef.current || !sourceCanvasRef.current) return;

    const timer = setTimeout(() => {
      applyColorGradingToCanvas();
    }, 50);

    return () => clearTimeout(timer);
  }, [params]);

  const applyColorGradingToCanvas = useCallback(() => {
    if (!sourceImageRef.current || !sourceCanvasRef.current) return;

    const processedData = processImage(
      sourceImageRef.current,
      params,
      sourceCanvasRef.current
    );

    if (processedData && targetImageRef.current) {
      setIsCalculating(true);

      setTimeout(() => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetImageRef.current.naturalWidth;
        tempCanvas.height = targetImageRef.current.naturalHeight;
        const tempCtx = tempCanvas.getContext('2d');

        if (tempCtx) {
          tempCtx.drawImage(targetImageRef.current, 0, 0);
          const targetData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

          const newScore = calculateScore(processedData, targetData);
          const issues = detectIssues(processedData, params);
          newScore.issues = issues;

          setScore(newScore);
        }
        setIsCalculating(false);
      }, 100);
    }
  }, [params, processImage]);

  const handleSourceCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    if (!sourceImageRef.current) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        sourceImageRef.current = img;
        sourceImageLoadedRef.current = true;
        applyColorGradingToCanvas();
      };
      img.src = currentLevel.sourceImage;
    }
  }, [currentLevel, applyColorGradingToCanvas]);

  const handleTargetCanvasReady = useCallback(() => {
    if (!targetImageRef.current) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        targetImageRef.current = img;
      };
      img.src = currentLevel.targetImage;
    }
  }, [currentLevel]);

  const handleExposureChange = useCallback((value: number) => {
    const previousParams = { ...params };
    setParams((prev) => ({ ...prev, exposure: value }));
    history.addHistory('exposure', { ...params, exposure: value }, previousParams);
  }, [params, history]);

  const handleTemperatureChange = useCallback((value: number) => {
    const previousParams = { ...params };
    setParams((prev) => ({ ...prev, temperature: value }));
    history.addHistory('temperature', { ...params, temperature: value }, previousParams);
  }, [params, history]);

  const handleLUTChange = useCallback((lutId: string | null) => {
    const previousParams = { ...params };
    setParams((prev) => ({ ...prev, lutId }));
    history.addHistory('lut', { ...params, lutId }, previousParams);
  }, [params, history]);

  const handleLUTIntensityChange = useCallback((value: number) => {
    const previousParams = { ...params };
    setParams((prev) => ({ ...prev, lutIntensity: value }));
    history.addHistory('lut', { ...params, lutIntensity: value }, previousParams);
  }, [params, history]);

  const handleUndo = useCallback(() => {
    const entry = history.undo();
    if (entry) {
      setParams(entry.params);
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    const entry = history.redo();
    if (entry) {
      setParams(entry.params);
    }
  }, [history]);

  const handleRevertTo = useCallback((index: number) => {
    const entry = history.revertTo(index);
    if (entry) {
      setParams(entry.params);
    }
  }, [history]);

  const handleReset = useCallback(() => {
    setParams(INITIAL_PARAMS);
    history.resetHistory();
    sourceImageLoadedRef.current = false;
  }, [history]);

  const handleSelectLevel = useCallback((level: Level) => {
    setCurrentLevel(level);
    setParams(INITIAL_PARAMS);
    setScore(null);
    history.resetHistory();
    sourceImageLoadedRef.current = false;
    sourceImageRef.current = null;
    targetImageRef.current = null;
  }, [history]);

  const handleScreenshot = useCallback(async () => {
    if (!sourceCanvasRef.current || !targetImageRef.current) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetImageRef.current.naturalWidth;
    tempCanvas.height = targetImageRef.current.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(targetImageRef.current, 0, 0);
    }

    const screenshot = await captureComparisonScreenshot(
      tempCanvas,
      sourceCanvasRef.current
    );
    downloadScreenshot(screenshot, `color-grading-${Date.now()}.png`);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!score || !sourceCanvasRef.current || !targetImageRef.current) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetImageRef.current.naturalWidth;
    tempCanvas.height = targetImageRef.current.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(targetImageRef.current, 0, 0);
    }

    const screenshot = await captureComparisonScreenshot(
      tempCanvas,
      sourceCanvasRef.current
    );

    const report: GradingReport = {
      id: generateId(),
      levelId: currentLevel.id,
      timestamp: Date.now(),
      finalParams: { ...params },
      score,
      history: [...history.history],
      comparisonScreenshot: screenshot,
      notes: '',
    };

    saveReport(report);
    setCurrentReport(report);
    setShowReport(true);

    const newProgress = { ...completedLevels };
    const currentProgress = newProgress[currentLevel.id] || {
      bestScore: 0,
      completed: false,
      attempts: 0,
    };

    newProgress[currentLevel.id] = {
      bestScore: Math.max(currentProgress.bestScore, score.overall),
      completed: true,
      attempts: currentProgress.attempts + 1,
    };

    setCompletedLevels(newProgress);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(newProgress));
  }, [score, currentLevel, params, history, completedLevels]);

  const handleExportPDF = useCallback(async () => {
    if (currentReport) {
      await exportReportAsPDF(currentReport);
    }
  }, [currentReport]);

  const handleExportImage = useCallback(() => {
    if (currentReport?.comparisonScreenshot) {
      downloadScreenshot(currentReport.comparisonScreenshot, `report-${currentReport.id}.png`);
    }
  }, [currentReport]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      <div className="fixed inset-0 pointer-events-none opacity-5">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 212, 255, 0.03) 2px, rgba(0, 212, 255, 0.03) 4px)
            `,
          }}
        />
      </div>

      <header className="relative z-10 border-b border-gray-800 bg-[#0a0a0f]/90 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1
                className="text-lg font-bold text-cyan-400"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                COLOR GRADING CHALLENGE
              </h1>
              <p className="text-xs text-gray-500">数字调色挑战</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-gray-800/50 rounded text-sm text-gray-300">
              <span className="text-gray-500">当前关卡:</span>{' '}
              <span className="text-cyan-400">{currentLevel.name}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1800px] mx-auto p-4">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-2 space-y-4">
            <LevelSelect
              levels={LEVELS}
              currentLevelId={currentLevel.id}
              onSelectLevel={handleSelectLevel}
              completedLevels={completedLevels}
            />
          </div>

          <div className="col-span-7">
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <div className="aspect-video">
                <CanvasPreview
                  sourceImage={currentLevel.sourceImage}
                  targetImage={currentLevel.targetImage}
                  onSourceCanvasReady={handleSourceCanvasReady}
                  onTargetCanvasReady={handleTargetCanvasReady}
                  sourceCanvasRef={sourceCanvasRef}
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    重置
                  </button>
                  <button
                    onClick={handleScreenshot}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    截图对比
                  </button>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!score}
                  className={`flex items-center gap-2 px-6 py-2 rounded text-sm font-medium transition-all ${
                    score
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg shadow-cyan-500/25'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  提交关卡
                </button>
              </div>
            </div>

            <div className="mt-4">
              <ScorePanel score={score} isCalculating={isCalculating} />
            </div>
          </div>

          <div className="col-span-3 space-y-4">
            <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-200 mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                调色参数
              </div>
              <ParameterSlider
                label="曝光 Exposure"
                value={params.exposure}
                min={-2}
                max={2}
                step={0.01}
                onChange={handleExposureChange}
                color="#00d4ff"
              />
              <ParameterSlider
                label="色温 Temperature"
                value={params.temperature}
                min={2000}
                max={10000}
                step={50}
                onChange={handleTemperatureChange}
                unit="K"
                color="#ff6b35"
              />
            </div>

            <LUTSelector
              selectedLUT={params.lutId}
              intensity={params.lutIntensity}
              onLUTChange={handleLUTChange}
              onIntensityChange={handleLUTIntensityChange}
            />

            <HistoryTimeline
              history={history.history}
              currentIndex={history.currentIndex}
              onRevert={handleRevertTo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
            />
          </div>
        </div>
      </main>

      <ReportModal
        report={showReport ? currentReport : null}
        onClose={() => setShowReport(false)}
        onExportPDF={handleExportPDF}
        onExportImage={handleExportImage}
      />
    </div>
  );
}

export default App;

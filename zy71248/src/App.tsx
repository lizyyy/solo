
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ColorParams, ScoreResult, GradingReport, Level, LevelProgress, HistoryEntry } from './types';
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
  getOperatorName,
  setOperatorName,
  getManualCorrections,
} from './utils/reportGenerator';
import { CanvasPreview } from './components/CanvasPreview';
import { ParameterSlider } from './components/ParameterSlider';
import { ScorePanel } from './components/ScorePanel';
import { HistoryTimeline } from './components/HistoryTimeline';
import { LUTSelector } from './components/LUTSelector';
import { ReportModal } from './components/ReportModal';
import { LevelSelect } from './components/LevelSelect';
import { Camera, RotateCcw, Send, Sparkles, User, StickyNote, Edit3, Check } from 'lucide-react';

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
  const [operatorName, setOperatorNameState] = useState(getOperatorName());
  const [isEditingOperator, setIsEditingOperator] = useState(false);
  const [tempOperatorName, setTempOperatorName] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [currentNote, setCurrentNote] = useState('');

  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const targetImageRef = useRef<HTMLImageElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const sourceImageLoadedRef = useRef(false);
  const targetImageDataRef = useRef<ImageData | null>(null);

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

    if (processedData) {
      setIsCalculating(true);

      setTimeout(() => {
        if (targetImageDataRef.current) {
          const newScore = calculateScore(processedData, targetImageDataRef.current);
          const issues = detectIssues(processedData, params, targetImageDataRef.current);
          newScore.issues = issues;
          setScore(newScore);
        } else {
          const issues = detectIssues(processedData, params);
          setScore({
            overall: 0,
            brightness: 0,
            color: 0,
            detail: 0,
            grade: 'D' as const,
            issues,
          });
        }
        setIsCalculating(false);
      }, 100);
    }
  }, [params, processImage]);

  const handleSourceImageLoaded = useCallback((img: HTMLImageElement) => {
    sourceImageRef.current = img;
    sourceImageLoadedRef.current = true;
    applyColorGradingToCanvas();
  }, [applyColorGradingToCanvas]);

  const handleTargetImageLoaded = useCallback((img: HTMLImageElement) => {
    targetImageRef.current = img;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.naturalWidth || 800;
    tempCanvas.height = img.naturalHeight || 450;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      try {
        tempCtx.drawImage(img, 0, 0);
        targetImageDataRef.current = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      } catch {
        targetImageDataRef.current = null;
      }
    }
  }, []);

  const addHistoryWithSource = useCallback((
    actionType: 'exposure' | 'temperature' | 'lut' | 'reset' | 'revert' | 'manual_correction' | 'note',
    newParams: ColorParams,
    previousParams: ColorParams,
    source: string,
    isManual: boolean = false,
    note?: string
  ) => {
    history.addHistory(actionType, newParams, previousParams, {
      modificationSource: source,
      isManualCorrection: isManual,
      note: note,
    });
  }, [history]);

  const handleExposureChange = useCallback((value: number) => {
    const previousParams = { ...params };
    const newParams = { ...params, exposure: value };
    setParams(newParams);
    addHistoryWithSource('exposure', newParams, previousParams, '滑块调节');
  }, [params, addHistoryWithSource]);

  const handleTemperatureChange = useCallback((value: number) => {
    const previousParams = { ...params };
    const newParams = { ...params, temperature: value };
    setParams(newParams);
    addHistoryWithSource('temperature', newParams, previousParams, '滑块调节');
  }, [params, addHistoryWithSource]);

  const handleLUTChange = useCallback((lutId: string | null) => {
    const previousParams = { ...params };
    const newParams = { ...params, lutId };
    setParams(newParams);
    addHistoryWithSource('lut', newParams, previousParams, 'LUT选择');
  }, [params, addHistoryWithSource]);

  const handleLUTIntensityChange = useCallback((value: number) => {
    const previousParams = { ...params };
    const newParams = { ...params, lutIntensity: value };
    setParams(newParams);
    addHistoryWithSource('lut', newParams, previousParams, '滑块调节');
  }, [params, addHistoryWithSource]);

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
    setReportNotes('');
    history.resetHistory();
    sourceImageLoadedRef.current = false;
    sourceImageRef.current = null;
    targetImageRef.current = null;
    targetImageDataRef.current = null;
  }, [history]);

  const handleOperatorSave = useCallback(() => {
    if (tempOperatorName.trim()) {
      setOperatorName(tempOperatorName.trim());
      setOperatorNameState(tempOperatorName.trim());
    }
    setIsEditingOperator(false);
  }, [tempOperatorName]);

  const handleAddNote = useCallback(() => {
    if (currentNote.trim()) {
      const previousParams = { ...params };
      addHistoryWithSource('note', previousParams, previousParams, '备注添加', false, currentNote.trim());
      setCurrentNote('');
      setShowNoteInput(false);
    }
  }, [params, currentNote, addHistoryWithSource]);

  const handleManualCorrection = useCallback(() => {
    const previousParams = { ...params };
    addHistoryWithSource('manual_correction', previousParams, previousParams, '人工更正', true, '人工参数调整确认');
  }, [params, addHistoryWithSource]);

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
      levelName: currentLevel.name,
      timestamp: Date.now(),
      operator: operatorName,
      finalParams: { ...params },
      targetParams: currentLevel.targetParams,
      score,
      history: [...history.history],
      comparisonScreenshot: screenshot,
      sourceImage: currentLevel.sourceImage,
      targetImage: currentLevel.targetImage,
      notes: reportNotes,
      manualCorrections: getManualCorrections(history.history),
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
  }, [score, currentLevel, params, history, completedLevels, operatorName, reportNotes]);

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

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded text-sm">
              <span className="text-gray-500">当前关卡:</span>{' '}
              <span className="text-cyan-400">{currentLevel.name}</span>
            </div>

            <div className="flex items-center gap-2">
              {isEditingOperator ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempOperatorName}
                    onChange={(e) => setTempOperatorName(e.target.value)}
                    placeholder={operatorName}
                    className="w-24 px-2 py-1 bg-gray-800 border border-cyan-500/50 rounded text-sm text-gray-200 focus:outline-none focus:border-cyan-400"
                    autoFocus
                  />
                  <button
                    onClick={handleOperatorSave}
                    className="p-1 bg-cyan-500 hover:bg-cyan-400 rounded text-white"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setTempOperatorName(operatorName);
                    setIsEditingOperator(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 rounded text-sm text-gray-300 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{operatorName}</span>
                </button>
              )}
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
                  onSourceImageLoaded={handleSourceImageLoaded}
                  onTargetImageLoaded={handleTargetImageLoaded}
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
                  <button
                    onClick={handleManualCorrection}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-900/50 hover:bg-purple-800/50 border border-purple-500/30 rounded text-sm text-purple-300 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    标记人工更正
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

            <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  报告备注
                </span>
                <button
                  onClick={() => setShowNoteInput(!showNoteInput)}
                  className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-cyan-400 transition-colors"
                >
                  <StickyNote className="w-4 h-4" />
                </button>
              </div>
              {showNoteInput ? (
                <div className="space-y-2">
                  <textarea
                    value={currentNote}
                    onChange={(e) => setCurrentNote(e.target.value)}
                    placeholder="添加操作备注..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:border-cyan-500 resize-none"
                    rows={3}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowNoteInput(false)}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddNote}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-sm text-white transition-colors"
                    >
                      添加
                    </button>
                  </div>
                </div>
              ) : (
                <textarea
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="输入报告备注（将保存到导出报告中）..."
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 resize-none"
                  rows={3}
                />
              )}
            </div>

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

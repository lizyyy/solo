import { useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, GitCompare, StickyNote } from 'lucide-react';
import { useStore, useCurrentExperiment, useComparisonExperiments } from '../store/useStore';
import { Scene3D } from '../components/Scene3D/Scene3D';
import { SpectrumChart } from '../components/Spectrum/SpectrumChart';
import { PeakList } from '../components/Spectrum/PeakList';
import { ControlPanel } from '../components/Controls/ControlPanel';
import { ExportPanel } from '../components/Controls/ExportPanel';
import { ExperimentList } from '../components/Controls/ExperimentList';
import { ComparisonView } from '../components/Comparison/ComparisonView';
import { createMockExperiment } from '../utils/mockData';
import { FFTAnalyzer } from '../utils/fft';
import { PeakDetector } from '../utils/peakDetection';
import type { Peak, DataStatus } from '../types';

export default function Home() {
  const {
    experiments,
    currentExperimentId,
    comparisonIds,
    isPlaying,
    showComparison,
    setCurrentExperiment,
    addExperiment,
    updateExperiment,
    deleteExperiment,
    duplicateExperiment,
    toggleComparison,
    clearComparison,
    setIsPlaying,
    setShowComparison,
    updatePeakStatus,
    markPeakAsNoise,
    addNote,
  } = useStore();

  const currentExperiment = useCurrentExperiment();
  const comparisonExperiments = useComparisonExperiments();
  const mainContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (experiments.length === 0) {
      const defaultExperiment = createMockExperiment('标准音叉 A4 (440Hz)', 440, 1.8, 0.03);
      addExperiment(defaultExperiment);
    }
  }, [experiments.length, addExperiment]);

  const regenerateSpectrum = useCallback(() => {
    if (!currentExperiment) return;

    const fftAnalyzer = new FFTAnalyzer(
      currentExperiment.sampling.sampleRate,
      currentExperiment.sampling.fftSize
    );
    const peakDetector = new PeakDetector();

    const spectrumData = fftAnalyzer.generateSpectrumFromFrequency(
      currentExperiment.tuningFork.frequency,
      1.5,
      0.05,
      3
    );

    const peaks = peakDetector.detectPeaks(spectrumData);

    updateExperiment(currentExperiment.id, {
      spectrumData,
      peaks,
      status: 'tentative',
    });
  }, [currentExperiment, updateExperiment]);

  const handleAddExperiment = () => {
    const newExperiment = createMockExperiment(
      `新实验 ${experiments.length + 1}`,
      440,
      1.5,
      0.05
    );
    addExperiment(newExperiment);
  };

  const handlePeakClick = (peak: Peak, experimentId: string) => {
    console.log('Peak clicked:', peak, 'Experiment:', experimentId);
  };

  const handleToggleNoise = (peakId: string, isNoise: boolean) => {
    if (currentExperimentId) {
      markPeakAsNoise(currentExperimentId, peakId, isNoise);
    }
  };

  const handleUpdatePeakStatus = (peakId: string, status: DataStatus) => {
    if (currentExperimentId) {
      updatePeakStatus(currentExperimentId, peakId, status);
    }
  };

  const handleUpdateExperiment = (updates: Parameters<typeof updateExperiment>[1]) => {
    if (currentExperimentId) {
      updateExperiment(currentExperimentId, updates);
    }
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const displayExperiments = showComparison && comparisonExperiments.length > 0
    ? comparisonExperiments
    : currentExperiment
    ? [currentExperiment]
    : [];

  return (
    <div className="h-screen flex flex-col bg-dark-500 overflow-hidden">
      <header className="flex-shrink-0 px-4 py-3 border-b border-dark-600 bg-dark-600/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-primary-500 animate-pulse" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-dark-100">
                音叉共鸣频率图
              </h1>
              <p className="text-xs text-dark-400">音乐物理课频谱分析平台</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={regenerateSpectrum}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 text-dark-200 hover:bg-dark-600 transition-colors text-sm"
              title="重新生成频谱"
            >
              <RotateCcw className="w-4 h-4" />
              重新分析
            </button>

            <button
              onClick={handleTogglePlay}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                isPlaying
                  ? 'bg-accent-500 text-dark-900'
                  : 'bg-primary-500 text-dark-900 hover:bg-primary-400'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  暂停
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  播放
                </>
              )}
            </button>

            {comparisonIds.length > 0 && (
              <button
                onClick={() => setShowComparison(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-sm"
              >
                <GitCompare className="w-4 h-4" />
                对比 ({comparisonIds.length})
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 flex-shrink-0 border-r border-dark-600 overflow-y-auto p-4 space-y-4">
          <ExperimentList
            experiments={experiments}
            currentId={currentExperimentId}
            comparisonIds={comparisonIds}
            onSelect={setCurrentExperiment}
            onAdd={handleAddExperiment}
            onDuplicate={duplicateExperiment}
            onDelete={deleteExperiment}
            onToggleComparison={toggleComparison}
          />

          {currentExperiment && (
            <>
              <ControlPanel
                experiment={currentExperiment}
                onUpdate={handleUpdateExperiment}
              />
              <ExportPanel experiment={currentExperiment} targetRef={mainContentRef} />
            </>
          )}
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden" ref={mainContentRef}>
          {currentExperiment ? (
            <>
              <div className="flex-shrink-0 h-1/2 min-h-[300px] relative">
                <Scene3D
                  tuningFork={currentExperiment.tuningFork}
                  resonanceBox={currentExperiment.resonanceBox}
                  microphone={currentExperiment.microphone}
                  isPlaying={isPlaying}
                />
              </div>

              <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-hidden">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-medium text-dark-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary-500" />
                      频谱分析 - {currentExperiment.name}
                    </h2>
                    <span
                      className={`status-badge text-xs ${
                        currentExperiment.status === 'confirmed'
                          ? 'status-confirmed'
                          : 'status-tentative'
                      }`}
                    >
                      {currentExperiment.status === 'confirmed' ? '已确认' : '临时数据'}
                    </span>
                  </div>
                  <SpectrumChart
                    experiments={displayExperiments}
                    showPeaks={true}
                    onPeakClick={handlePeakClick}
                    height={250}
                  />
                </div>

                <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                  <div className="flex-1 overflow-y-auto min-w-0">
                    <h3 className="text-sm font-medium text-dark-200 mb-3 flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-accent-400" />
                      备注信息
                    </h3>
                    <textarea
                      value={currentExperiment.notes}
                      onChange={(e) => addNote(currentExperiment.id, e.target.value)}
                      placeholder="在此输入实验备注..."
                      className="w-full h-32 input-field resize-none text-sm"
                    />
                  </div>

                  <div className="w-80 flex-shrink-0 overflow-y-auto">
                    <PeakList
                      peaks={currentExperiment.peaks}
                      onToggleNoise={handleToggleNoise}
                      onUpdateStatus={handleUpdatePeakStatus}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-700 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-primary-500/30" />
                </div>
                <p className="text-dark-300">选择或创建一个实验开始分析</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {showComparison && comparisonExperiments.length > 0 && (
        <ComparisonView
          experiments={comparisonExperiments}
          onClose={() => setShowComparison(false)}
          onRemoveExperiment={(id) => {
            toggleComparison(id);
            if (comparisonIds.length <= 1) {
              setShowComparison(false);
            }
          }}
        />
      )}
    </div>
  );
}

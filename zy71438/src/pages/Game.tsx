import React, { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, ArrowLeft, Send, AlertTriangle, VolumeX, HelpCircle, Lightbulb } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { LEVELS, getDefaultOscillators } from '../data/levels';
import { audioEngine, calculateSimilarity, generateWaveformData, detectPhaseCancellation, detectVolumePeak } from '../utils/audioEngine';
import { saveAttempt, generateSubmissionBatch, getPlayer } from '../utils/storage';
import { Attempt, Evidence } from '../types';
import WaveformCanvas from '../components/WaveformCanvas';
import OscillatorPanel from '../components/OscillatorPanel';
import SimilarityScore from '../components/SimilarityScore';

const Game: React.FC = () => {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  
  const {
    oscillators,
    currentLevel,
    operationLogs,
    evidences,
    isPlaying,
    isTargetPlaying,
    similarityBreakdown,
    startTime,
    phaseCancellationDetected,
    volumePeakDetected,
    setCurrentLevel,
    setOscillators,
    setPlaying,
    setTargetPlaying,
    setSimilarityBreakdown,
    startGame,
    resetGame,
    addOperationLog,
    addEvidence,
    setPhaseCancellationDetected,
    setVolumePeakDetected,
  } = useGameStore();

  const [showHint, setShowHint] = React.useState(false);

  useEffect(() => {
    const level = LEVELS.find(l => l.id === levelId);
    if (level) {
      setCurrentLevel(level);
      setOscillators(getDefaultOscillators(4));
      startGame();
    }

    return () => {
      audioEngine.stop();
    };
  }, [levelId, setCurrentLevel, setOscillators, startGame]);

  useEffect(() => {
    if (!currentLevel) return;

    const similarity = calculateSimilarity(oscillators, currentLevel.targetOscillators);
    setSimilarityBreakdown(similarity);

    const waveformData = generateWaveformData(oscillators);
    
    const phaseResult = detectPhaseCancellation(oscillators);
    if (phaseResult.detected && !phaseCancellationDetected) {
      setPhaseCancellationDetected(true);
      addOperationLog({
        type: 'phase_cancellation',
        timestamp: Date.now(),
        details: phaseResult.details,
      });
    } else if (!phaseResult.detected && phaseCancellationDetected) {
      setPhaseCancellationDetected(false);
    }

    const peakDetected = detectVolumePeak(waveformData);
    if (peakDetected && !volumePeakDetected) {
      setVolumePeakDetected(true);
      addOperationLog({
        type: 'volume_peak',
        timestamp: Date.now(),
        details: { peak: waveformData.samples.reduce((a, b) => Math.max(a, Math.abs(b)), 0) },
      });
    } else if (!peakDetected && volumePeakDetected) {
      setVolumePeakDetected(false);
    }
  }, [oscillators, currentLevel, setSimilarityBreakdown, phaseCancellationDetected, volumePeakDetected, setPhaseCancellationDetected, setVolumePeakDetected, addOperationLog]);

  const handlePlayUser = useCallback(() => {
    if (isPlaying) {
      audioEngine.stop();
      setPlaying(false);
    } else {
      audioEngine.play(oscillators);
      setPlaying(true);
      addOperationLog({
        type: 'playback',
        timestamp: Date.now(),
        details: { source: 'user' },
      });
      setTimeout(() => {
        audioEngine.stop();
        setPlaying(false);
      }, 2000);
    }
  }, [isPlaying, oscillators, setPlaying, addOperationLog]);

  const handlePlayTarget = useCallback(() => {
    if (!currentLevel) return;
    
    if (isTargetPlaying) {
      audioEngine.stop();
      setTargetPlaying(false);
    } else {
      audioEngine.play(currentLevel.targetOscillators);
      setTargetPlaying(true);
      addOperationLog({
        type: 'playback',
        timestamp: Date.now(),
        details: { source: 'target' },
      });
      setTimeout(() => {
        audioEngine.stop();
        setTargetPlaying(false);
      }, 2000);
    }
  }, [isTargetPlaying, currentLevel, setTargetPlaying, addOperationLog]);

  const handleSubmit = useCallback(() => {
    if (!currentLevel || !startTime) return;

    const player = getPlayer();
    if (!player) return;

    const waveformEvidence: Omit<Evidence, 'id'> = {
      type: 'waveform',
      conclusion: similarityBreakdown.total >= currentLevel.passThreshold ? '匹配成功' : '匹配失败',
      details: {
        score: similarityBreakdown.total,
        threshold: currentLevel.passThreshold,
        breakdown: similarityBreakdown,
      },
      timestamp: Date.now(),
    };
    addEvidence(waveformEvidence);

    const auditionEvidence: Omit<Evidence, 'id'> = {
      type: 'audition',
      conclusion: '用户已试听对比',
      details: {
        userPlayCount: operationLogs.filter(l => l.type === 'playback' && l.details?.source === 'user').length,
        targetPlayCount: operationLogs.filter(l => l.type === 'playback' && l.details?.source === 'target').length,
      },
      timestamp: Date.now(),
      supports: waveformEvidence.conclusion,
    };
    addEvidence(auditionEvidence);

    const passed = similarityBreakdown.total >= currentLevel.passThreshold;

    const attempt: Attempt = {
      id: `attempt_${Date.now()}`,
      levelId: currentLevel.id,
      playerId: player.id,
      playerName: player.nickname,
      oscillators: [...oscillators],
      score: similarityBreakdown.total,
      similarityBreakdown: { ...similarityBreakdown },
      passed,
      startTime,
      endTime: Date.now(),
      operationLogs: [...operationLogs],
      evidences: [
        ...evidences,
        { ...waveformEvidence, id: `evidence_${Date.now()}_1` },
        { ...auditionEvidence, id: `evidence_${Date.now()}_2` },
      ],
      submissionBatch: generateSubmissionBatch(),
      isUpdate: false,
      updatedFields: [],
    };

    saveAttempt(attempt);
    navigate(`/result/${attempt.id}`);
  }, [currentLevel, startTime, oscillators, similarityBreakdown, operationLogs, evidences, addEvidence, navigate]);

  if (!currentLevel) {
    return <div className="min-h-screen flex items-center justify-center text-cyber-primary">加载中...</div>;
  }

  return (
    <div className="min-h-screen cyber-grid p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => { resetGame(); navigate('/'); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyber-muted/30 text-cyber-muted hover:text-cyber-primary hover:border-cyber-primary transition-all"
          >
            <ArrowLeft size={18} />
            <span>返回</span>
          </button>
          
          <div className="text-center">
            <h1 className="text-2xl font-orbitron font-bold text-cyber-primary">
              {currentLevel.name}
            </h1>
            <p className="text-sm text-cyber-muted">{currentLevel.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHint(!showHint)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-cyber-accent/30 text-cyber-accent hover:bg-cyber-accent/10 transition-all"
            >
              <Lightbulb size={18} />
              <span>提示</span>
            </button>
          </div>
        </div>

        {showHint && currentLevel.hint && (
          <div className="mb-4 p-4 rounded-lg bg-cyber-accent/10 border border-cyber-accent/30">
            <div className="flex items-start gap-3">
              <HelpCircle className="text-cyber-accent flex-shrink-0 mt-0.5" size={20} />
              <p className="text-cyber-accent">{currentLevel.hint}</p>
            </div>
          </div>
        )}

        {(phaseCancellationDetected || volumePeakDetected) && (
          <div className="mb-4 flex gap-4">
            {phaseCancellationDetected && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-danger/20 border border-cyber-danger text-cyber-danger animate-pulse">
                <VolumeX size={18} />
                <span className="text-sm">检测到相位抵消！波形相互抵消导致音量降低</span>
              </div>
            )}
            {volumePeakDetected && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-danger/20 border border-cyber-danger text-cyber-danger animate-pulse">
                <AlertTriangle size={18} />
                <span className="text-sm">音量爆峰！音量过大可能导致失真</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="p-4 rounded-xl neon-border bg-cyber-card/50">
              <div className="flex items-center justify-between mb-4">
                <span className="font-orbitron text-cyber-secondary font-bold">目标波形</span>
                <button
                  onClick={handlePlayTarget}
                  className={`cyber-btn flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isTargetPlaying
                      ? 'bg-cyber-secondary text-cyber-bg shadow-neon-pink'
                      : 'border border-cyber-secondary text-cyber-secondary hover:bg-cyber-secondary/20'
                  }`}
                >
                  {isTargetPlaying ? <Pause size={18} /> : <Play size={18} />}
                  <span>{isTargetPlaying ? '播放中...' : '试听目标'}</span>
                </button>
              </div>
              <WaveformCanvas
                oscillators={currentLevel.targetOscillators}
                height={120}
              />
            </div>

            <div className="p-4 rounded-xl neon-border bg-cyber-card/50">
              <div className="flex items-center justify-between mb-4">
                <span className="font-orbitron text-cyber-primary font-bold">你的波形</span>
                <button
                  onClick={handlePlayUser}
                  className={`cyber-btn flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isPlaying
                      ? 'bg-cyber-primary text-cyber-bg shadow-neon-cyan'
                      : 'border border-cyber-primary text-cyber-primary hover:bg-cyber-primary/20'
                  }`}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  <span>{isPlaying ? '播放中...' : '试听你的'}</span>
                </button>
              </div>
              <WaveformCanvas
                oscillators={oscillators}
                targetOscillators={currentLevel.targetOscillators}
                height={120}
              />
              <div className="mt-2 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-1 bg-cyber-primary shadow-neon-cyan" />
                  <span className="text-cyber-muted">你的波形</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-1 bg-cyber-secondary/60" />
                  <span className="text-cyber-muted">目标波形</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {oscillators.map((osc, index) => (
                <OscillatorPanel
                  key={osc.id}
                  oscillator={osc}
                  index={index}
                />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <SimilarityScore
              breakdown={similarityBreakdown}
              passThreshold={currentLevel.passThreshold}
            />

            <button
              onClick={handleSubmit}
              className={`cyber-btn w-full py-4 rounded-xl font-orbitron font-bold text-lg transition-all ${
                similarityBreakdown.total >= currentLevel.passThreshold
                  ? 'bg-cyber-success text-cyber-bg shadow-neon-green hover:scale-105'
                  : 'bg-cyber-primary text-cyber-bg shadow-neon-cyan hover:scale-105'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Send size={20} />
                <span>提交答案</span>
              </div>
            </button>

            <div className="p-4 rounded-xl border border-cyber-muted/30 bg-cyber-card/30">
              <h4 className="text-sm font-orbitron text-cyber-muted mb-3">操作记录</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {operationLogs.slice(-8).reverse().map((log, index) => (
                  <div key={log.id} className="text-xs text-cyber-muted/70">
                    <span className="text-cyber-primary">#{log.sequence}</span>{' '}
                    {log.type === 'parameter_change' && (
                      <span>
                        调节 {log.oscillatorId?.replace('osc-', 'OSC')} {log.parameter}: {log.oldValue} → {log.newValue}
                      </span>
                    )}
                    {log.type === 'oscillator_toggle' && (
                      <span>
                        {log.oscillatorId?.replace('osc-', 'OSC')} {log.newValue ? '启用' : '禁用'}
                      </span>
                    )}
                    {log.type === 'playback' && (
                      <span>
                        试听 {log.details?.source === 'target' ? '目标' : '用户'}
                      </span>
                    )}
                    {log.type === 'phase_cancellation' && (
                      <span className="text-cyber-danger">⚠️ 相位抵消</span>
                    )}
                    {log.type === 'volume_peak' && (
                      <span className="text-cyber-danger">⚠️ 音量爆峰</span>
                    )}
                  </div>
                ))}
                {operationLogs.length === 0 && (
                  <div className="text-xs text-cyber-muted/50">暂无操作记录</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;

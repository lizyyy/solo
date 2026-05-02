import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TrainingPhase, HandActionType, InputEvent, ActionResult, MetronomeBeat, PainRecord } from '../../shared/types';
import { useAppContext } from '../App';
import { TrainingStateMachine } from '../../shared/TrainingStateMachine';
import { KeyboardInputAdapter, InputAdapterManager } from '../../shared/InputAdapter';
import { ACTION_TYPE_TO_LABEL, HAND_ACTIONS, KEYBOARD_MAPPINGS, PAIN_LEVELS } from '../../shared/constants';
import { formatTimestamp } from '../../shared/utils';

const TrainingView: React.FC = () => {
  const { currentPlan, storage, setCurrentView, refreshSessions } = useAppContext();
  
  const [phase, setPhase] = useState<TrainingPhase>('idle');
  const [countdown, setCountdown] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [expectedAction, setExpectedAction] = useState<HandActionType | null>(null);
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalIncorrect, setTotalIncorrect] = useState(0);
  const [totalMissed, setTotalMissed] = useState(0);
  const [showPainModal, setShowPainModal] = useState(false);
  const [selectedPainLevel, setSelectedPainLevel] = useState(0);
  const [beatVisual, setBeatVisual] = useState({ number: 0, isStrong: false, active: false });
  
  const stateMachineRef = useRef<TrainingStateMachine | null>(null);
  const inputManagerRef = useRef<InputAdapterManager | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const getActionEmoji = (actionType: HandActionType | null): string => {
    if (!actionType) return '❓';
    switch (actionType) {
      case 'fist': return '✊';
      case 'palm': return '🖐️';
      case 'pinch': return '🤏';
      default: return '❓';
    }
  };

  const playBeatSound = useCallback((isStrongBeat: boolean) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioCtx = audioContextRef.current;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.frequency.value = isStrongBeat ? 1000 : 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.error('Failed to play sound:', e);
    }
  }, []);

  const handleBeat = useCallback((beat: MetronomeBeat) => {
    setCurrentBeat(beat.beatNumber);
    playBeatSound(beat.isStrongBeat);
    setBeatVisual({ number: beat.beatNumber, isStrong: beat.isStrongBeat, active: true });
    setTimeout(() => {
      setBeatVisual((prev) => ({ ...prev, active: false }));
    }, 100);
  }, [playBeatSound]);

  const handleActionExpected = useCallback((actionType: HandActionType, stepIndex: number) => {
    setExpectedAction(actionType);
    setCurrentStepIndex(stepIndex);
  }, []);

  const handleActionResult = useCallback((result: ActionResult) => {
    setLastResult(result);
    if (result.isCorrect && !result.isMissed) {
      setTotalCorrect((prev) => prev + 1);
    } else if (result.isMissed) {
      setTotalMissed((prev) => prev + 1);
    } else {
      setTotalIncorrect((prev) => prev + 1);
    }
    
    setTimeout(() => {
      setLastResult(null);
    }, 500);
  }, []);

  const handlePhaseChange = useCallback((_oldPhase: TrainingPhase, newPhase: TrainingPhase) => {
    setPhase(newPhase);
  }, []);

  const handleCountdown = useCallback((remaining: number) => {
    setCountdown(remaining);
  }, []);

  const handleComplete = useCallback((session: typeof stateMachineRef.current extends { getSession: () => infer S } ? S : never) => {
    storage.saveSession(session);
    refreshSessions();
  }, [storage, refreshSessions]);

  const initStateMachine = useCallback(() => {
    if (!currentPlan) return;

    const stateMachine = new TrainingStateMachine(currentPlan, {
      onBeat: handleBeat,
      onActionExpected: handleActionExpected,
      onActionResult: handleActionResult,
      onPhaseChange: handlePhaseChange,
      onCountdown: handleCountdown,
      onComplete: handleComplete,
    });

    stateMachineRef.current = stateMachine;

    const keyboardAdapter = new KeyboardInputAdapter();
    const inputManager = new InputAdapterManager();
    inputManager.registerAdapter(keyboardAdapter);
    inputManager.selectAdapter('keyboard');
    
    inputManager.onEvent((event: InputEvent) => {
      if (stateMachineRef.current) {
        stateMachineRef.current.handleInputEvent(event);
      }
    });

    inputManagerRef.current = inputManager;
  }, [currentPlan, handleBeat, handleActionExpected, handleActionResult, handlePhaseChange, handleCountdown, handleComplete]);

  useEffect(() => {
    initStateMachine();
    return () => {
      if (stateMachineRef.current) {
        stateMachineRef.current.stop();
      }
      if (inputManagerRef.current) {
        inputManagerRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [initStateMachine]);

  const handleStart = () => {
    if (!stateMachineRef.current) return;
    
    setTotalCorrect(0);
    setTotalIncorrect(0);
    setTotalMissed(0);
    setLastResult(null);
    setCurrentStepIndex(0);
    setCurrentBeat(0);
    
    inputManagerRef.current?.start();
    stateMachineRef.current.start();
  };

  const handlePause = () => {
    if (!stateMachineRef.current) return;
    stateMachineRef.current.pause();
  };

  const handleResume = () => {
    if (!stateMachineRef.current) return;
    stateMachineRef.current.resume();
  };

  const handleStop = () => {
    if (!stateMachineRef.current) return;
    const session = stateMachineRef.current.stop();
    storage.saveSession(session);
    refreshSessions();
    inputManagerRef.current?.stop();
    setCurrentView('sessions');
  };

  const handleBack = () => {
    if (stateMachineRef.current && stateMachineRef.current.isRunning()) {
      if (confirm('训练进行中，确定要离开吗？训练数据将丢失。')) {
        stateMachineRef.current.stop();
        inputManagerRef.current?.stop();
        setCurrentView('plans');
      }
    } else {
      setCurrentView('plans');
    }
  };

  const handleRecordPain = () => {
    setShowPainModal(true);
    setSelectedPainLevel(0);
  };

  const handleConfirmPain = () => {
    if (!stateMachineRef.current) return;
    stateMachineRef.current.recordPain(selectedPainLevel);
    setShowPainModal(false);
  };

  const getResultColor = (result: ActionResult | null): string => {
    if (!result) return '#303133';
    if (result.isMissed) return '#f56c6c';
    if (result.isCorrect) return '#67c23a';
    return '#e6a23c';
  };

  const getResultText = (result: ActionResult | null): string => {
    if (!result) return '';
    if (result.isMissed) return '遗漏';
    if (result.isCorrect) return '正确';
    return '错误';
  };

  const getKeyMapping = (actionType: HandActionType): string => {
    const entries = Object.entries(KEYBOARD_MAPPINGS);
    const entry = entries.find(([, v]) => v === actionType);
    if (!entry) return '';
    let key = entry[0].replace('Key', '');
    if (entry[0] === 'Space') key = '空格';
    return key;
  };

  if (!currentPlan) {
    return (
      <div style={styles.container}>
        <p>未选择训练方案</p>
        <button onClick={() => setCurrentView('plans')}>返回方案列表</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={handleBack}>
          ← 返回
        </button>
        <div style={styles.planInfo}>
          <h2 style={styles.planName}>{currentPlan.name}</h2>
          <span style={styles.planMeta}>{currentPlan.bpm} BPM | {currentPlan.steps.length} 个动作</span>
        </div>
      </div>

      <div style={styles.mainContent}>
        {phase === 'idle' && (
          <div style={styles.idleView}>
            <div style={styles.idleIcon}>🎯</div>
            <h3 style={styles.idleTitle}>准备开始训练</h3>
            <p style={styles.idleDescription}>
              使用键盘按键进行动作：<br/>
              <strong>F</strong> - 握拳 &nbsp;&nbsp;
              <strong>P</strong> - 张掌 &nbsp;&nbsp;
              <strong>N</strong> - 捏合
            </p>
            <button style={styles.startButton} onClick={handleStart}>
              ▶️ 开始训练
            </button>
          </div>
        )}

        {phase === 'countdown' && (
          <div style={styles.countdownView}>
            <div style={styles.countdownNumber}>{countdown}</div>
            <p style={styles.countdownText}>准备开始...</p>
          </div>
        )}

        {(phase === 'active' || phase === 'paused') && (
          <div style={styles.activeView}>
            <div style={styles.beatDisplay}>
              {Array.from({ length: currentPlan.beatsPerMeasure }, (_, i) => i + 1).map((beat) => (
                <div
                  key={beat}
                  style={{
                    ...styles.beatIndicator,
                    ...(beat === beatVisual.number && beatVisual.active
                      ? (beat === 1 || beatVisual.isStrong ? styles.beatStrongActive : styles.beatActive)
                      : (beat === currentBeat
                          ? (beat === 1 ? styles.beatStrong : styles.beatNormal)
                          : styles.beatInactive)),
                  }}
                >
                  {beat}
                </div>
              ))}
            </div>

            <div style={styles.stepProgress}>
              <span>步骤 {currentStepIndex + 1} / {currentPlan.steps.length}</span>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${((currentStepIndex) / currentPlan.steps.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div style={styles.actionDisplay}>
              <div style={styles.actionEmoji}>
                {getActionEmoji(expectedAction)}
              </div>
              <div style={styles.actionLabel}>
                {expectedAction ? ACTION_TYPE_TO_LABEL[expectedAction] : '准备'}
              </div>
              <div style={styles.keyHint}>
                按键: <strong>{getKeyMapping(expectedAction || 'fist')}</strong>
              </div>
            </div>

            {lastResult && (
              <div style={{ ...styles.resultIndicator, color: getResultColor(lastResult) }}>
                {getResultText(lastResult)}
                {lastResult.timingOffsetMs !== 0 && !lastResult.isMissed && (
                  <span style={styles.timingOffset}>
                    ({lastResult.timingOffsetMs > 0 ? '+' : ''}{lastResult.timingOffsetMs.toFixed(0)}ms)
                  </span>
                )}
              </div>
            )}

            <div style={styles.statsRow}>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>正确</span>
                <span style={{ ...styles.statValue, color: '#67c23a' }}>{totalCorrect}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>错误</span>
                <span style={{ ...styles.statValue, color: '#e6a23c' }}>{totalIncorrect}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>遗漏</span>
                <span style={{ ...styles.statValue, color: '#f56c6c' }}>{totalMissed}</span>
              </div>
            </div>

            <div style={styles.controlRow}>
              {phase === 'active' && (
                <>
                  <button style={styles.pauseButton} onClick={handlePause}>
                    ⏸️ 暂停
                  </button>
                  <button style={styles.painButton} onClick={handleRecordPain}>
                    📝 记录疼痛
                  </button>
                  <button style={styles.stopButton} onClick={handleStop}>
                    ⏹️ 结束
                  </button>
                </>
              )}
              {phase === 'paused' && (
                <>
                  <button style={styles.resumeButton} onClick={handleResume}>
                    ▶️ 继续
                  </button>
                  <button style={styles.painButton} onClick={handleRecordPain}>
                    📝 记录疼痛
                  </button>
                  <button style={styles.stopButton} onClick={handleStop}>
                    ⏹️ 结束
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {phase === 'completed' && (
          <div style={styles.completedView}>
            <div style={styles.completedIcon}>🎉</div>
            <h3 style={styles.completedTitle}>训练完成！</h3>
            
            <div style={styles.completedStats}>
              <div style={styles.completedStat}>
                <span style={styles.completedStatValue}>{totalCorrect}</span>
                <span style={styles.completedStatLabel}>正确动作</span>
              </div>
              <div style={styles.completedStat}>
                <span style={styles.completedStatValue}>{totalIncorrect}</span>
                <span style={styles.completedStatLabel}>错误动作</span>
              </div>
              <div style={styles.completedStat}>
                <span style={styles.completedStatValue}>{totalMissed}</span>
                <span style={styles.completedStatLabel}>遗漏动作</span>
              </div>
            </div>

            <div style={styles.completedActions}>
              <button style={styles.viewDetailButton} onClick={() => setCurrentView('sessions')}>
                📊 查看历史
              </button>
              <button style={styles.restartButton} onClick={handleStart}>
                🔄 再练一次
              </button>
            </div>
          </div>
        )}
      </div>

      {showPainModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>记录疼痛</h3>
            <p style={styles.modalDescription}>请选择当前疼痛强度：</p>
            
            <div style={styles.painLevels}>
              {PAIN_LEVELS.map((level) => (
                <button
                  key={level.value}
                  style={{
                    ...styles.painLevelButton,
                    ...(selectedPainLevel === level.value ? styles.painLevelButtonActive : {}),
                  }}
                  onClick={() => setSelectedPainLevel(level.value)}
                >
                  <span style={styles.painLevelValue}>{level.value}</span>
                  <span style={styles.painLevelLabel}>{level.label}</span>
                </button>
              ))}
            </div>

            <div style={styles.modalActions}>
              <button style={styles.modalCancel} onClick={() => setShowPainModal(false)}>
                取消
              </button>
              <button style={styles.modalConfirm} onClick={handleConfirmPain}>
                确认记录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
  },
  backButton: {
    padding: '8px 16px',
    backgroundColor: '#f5f7fa',
    color: '#606266',
    borderRadius: '6px',
    fontSize: '14px',
    border: '1px solid #dcdfe6',
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#303133',
    margin: 0,
  },
  planMeta: {
    fontSize: '13px',
    color: '#909399',
  },
  mainContent: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '40px 24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
  },
  idleView: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  idleIcon: {
    fontSize: '80px',
  },
  idleTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#303133',
    margin: 0,
  },
  idleDescription: {
    fontSize: '16px',
    color: '#606266',
    textAlign: 'center',
    lineHeight: 1.8,
  },
  startButton: {
    padding: '16px 48px',
    backgroundColor: '#67c23a',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '18px',
    fontWeight: 600,
  },
  countdownView: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  countdownNumber: {
    fontSize: '120px',
    fontWeight: 700,
    color: '#409eff',
  },
  countdownText: {
    fontSize: '20px',
    color: '#606266',
  },
  activeView: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '32px',
  },
  beatDisplay: {
    display: 'flex',
    gap: '12px',
  },
  beatIndicator: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 600,
    transition: 'all 0.1s',
  },
  beatInactive: {
    backgroundColor: '#f5f7fa',
    color: '#c0c4cc',
  },
  beatNormal: {
    backgroundColor: '#ecf5ff',
    color: '#409eff',
  },
  beatStrong: {
    backgroundColor: '#409eff',
    color: '#fff',
  },
  beatActive: {
    backgroundColor: '#409eff',
    color: '#fff',
    transform: 'scale(1.1)',
  },
  beatStrongActive: {
    backgroundColor: '#409eff',
    color: '#fff',
    transform: 'scale(1.2)',
  },
  stepProgress: {
    width: '100%',
    maxWidth: '400px',
  },
  progressBar: {
    height: '8px',
    backgroundColor: '#f5f7fa',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#409eff',
    transition: 'width 0.3s',
  },
  actionDisplay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  actionEmoji: {
    fontSize: '120px',
  },
  actionLabel: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#303133',
  },
  keyHint: {
    fontSize: '16px',
    color: '#909399',
  },
  resultIndicator: {
    fontSize: '24px',
    fontWeight: 600,
    height: '32px',
  },
  timingOffset: {
    fontSize: '16px',
    marginLeft: '8px',
    fontWeight: 400,
  },
  statsRow: {
    display: 'flex',
    gap: '48px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#909399',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 700,
  },
  controlRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
  },
  pauseButton: {
    padding: '12px 24px',
    backgroundColor: '#e6a23c',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
  },
  resumeButton: {
    padding: '12px 24px',
    backgroundColor: '#67c23a',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
  },
  painButton: {
    padding: '12px 24px',
    backgroundColor: '#f56c6c',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
  },
  stopButton: {
    padding: '12px 24px',
    backgroundColor: '#909399',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
  },
  completedView: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  completedIcon: {
    fontSize: '80px',
  },
  completedTitle: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#67c23a',
    margin: 0,
  },
  completedStats: {
    display: 'flex',
    gap: '48px',
  },
  completedStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  completedStatValue: {
    fontSize: '48px',
    fontWeight: 700,
    color: '#409eff',
  },
  completedStatLabel: {
    fontSize: '14px',
    color: '#606266',
  },
  completedActions: {
    display: 'flex',
    gap: '16px',
    marginTop: '16px',
  },
  viewDetailButton: {
    padding: '12px 24px',
    backgroundColor: '#409eff',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
  },
  restartButton: {
    padding: '12px 24px',
    backgroundColor: '#67c23a',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '32px',
    width: '90%',
    maxWidth: '500px',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#303133',
    margin: '0 0 16px 0',
  },
  modalDescription: {
    fontSize: '14px',
    color: '#606266',
    marginBottom: '24px',
  },
  painLevels: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '24px',
  },
  painLevelButton: {
    flex: '1 0 calc(33.333% - 8px)',
    minWidth: '120px',
    padding: '16px',
    backgroundColor: '#f5f7fa',
    border: '2px solid transparent',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  },
  painLevelButtonActive: {
    backgroundColor: '#ecf5ff',
    borderColor: '#409eff',
  },
  painLevelValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#409eff',
  },
  painLevelLabel: {
    fontSize: '13px',
    color: '#606266',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  modalCancel: {
    padding: '10px 24px',
    backgroundColor: '#f5f7fa',
    color: '#606266',
    borderRadius: '6px',
    fontSize: '14px',
    border: '1px solid #dcdfe6',
  },
  modalConfirm: {
    padding: '10px 24px',
    backgroundColor: '#409eff',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
  },
};

export default TrainingView;

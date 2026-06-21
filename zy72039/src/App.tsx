import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, ListOrdered, BarChart3, AlertTriangle, CheckCircle, XCircle, FlaskConical } from 'lucide-react';
import { useGameEngine } from './hooks/useGameEngine';
import { StatusIndicator } from './components/StatusIndicator';
import { GameControls } from './components/GameControls';
import { LoadDisplay } from './components/LoadDisplay';
import { DataInput } from './components/DataInput';
import { RecordList } from './components/RecordList';
import { SettlementPanel } from './components/SettlementPanel';
import { PlaybackPanel } from './components/PlaybackPanel';
import { ConfigPanel } from './components/ConfigPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DEFAULT_CONFIG } from './config/gameConfig';
import { validateConfig } from './utils/configValidator';
import { DIRTY_TEST_SCENARIOS, runDirtyScenario } from './utils/testDataGenerator';
import type { GameConfig, GameRecord } from './types';
import { create } from 'zustand';

type ActivePanel = 'game' | 'config' | 'records' | 'settlement' | 'test';

const useAppStore = create<{
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
  showFailureFlash: boolean;
  setShowFailureFlash: (show: boolean) => void;
  lastFailureReason: string;
  setLastFailureReason: (reason: string) => void;
}>((set) => ({
  activePanel: 'config',
  setActivePanel: (panel) => set({ activePanel: panel }),
  showFailureFlash: false,
  setShowFailureFlash: (show) => set({ showFailureFlash: show }),
  lastFailureReason: '',
  setLastFailureReason: (reason) => set({ lastFailureReason: reason }),
}));

function AppContent() {
  const { state, stats, actions } = useGameEngine();
  const {
    activePanel,
    setActivePanel,
    showFailureFlash,
    setShowFailureFlash,
    lastFailureReason,
    setLastFailureReason,
  } = useAppStore();

  const [savedConfig, setSavedConfig] = useState<GameConfig | null>(null);
  const [configValidation, setConfigValidation] = useState(validateConfig(DEFAULT_CONFIG));
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testProgress, setTestProgress] = useState(0);

  useEffect(() => {
    if (savedConfig) {
      setConfigValidation(validateConfig(savedConfig));
    }
  }, [savedConfig]);

  const prevRecordCount = state.records.length;
  useEffect(() => {
    if (state.records.length > prevRecordCount && state.records.length > 0) {
      const latestRecord = state.records[state.records.length - 1];
      if (!latestRecord.isSuccess) {
        setShowFailureFlash(true);
        setLastFailureReason(latestRecord.failureDetail || '操作失败');
        setTimeout(() => setShowFailureFlash(false), 1500);
      }
    }
  }, [state.records.length, prevRecordCount, state.records, setShowFailureFlash, setLastFailureReason]);

  const handleSaveConfig = useCallback((config: GameConfig) => {
    const validation = validateConfig(config);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors, warnings: validation.warnings };
    }
    setSavedConfig(config);
    setConfigValidation(validation);
    return { success: true, errors: [], warnings: validation.warnings };
  }, []);

  const handleStartGame = useCallback(() => {
    if (!savedConfig) return;
    const result = actions.startGame(savedConfig);
    if (result.success) {
      setActivePanel('game');
    } else {
      alert('无法开始游戏：\n' + result.errors.join('\n'));
    }
  }, [savedConfig, actions, setActivePanel]);

  const handleSubmitInput = useCallback((value: string | number, note: string) => {
    actions.submitInput(value, note);
  }, [actions]);

  const handlePlayback = useCallback(() => {
    actions.startPlayback();
    setActivePanel('game');
  }, [actions, setActivePanel]);

  const handleRunTest = useCallback(async (scenarioIndex: number) => {
    if (!savedConfig) {
      alert('请先保存游戏配置');
      return;
    }

    setIsRunningTest(true);
    setTestProgress(0);

    const scenario = DIRTY_TEST_SCENARIOS[scenarioIndex];
    const tempConfig = { ...savedConfig, totalRounds: scenario.inputs.length };
    
    actions.startGame(tempConfig);
    setActivePanel('game');

    const testRecords: GameRecord[] = [];
    
    await runDirtyScenario(
      scenario,
      tempConfig,
      (record) => {
        testRecords.push(record);
        actions.submitInput(record.rawValue ?? '', record.note, 'test', record.responseTime ?? undefined);
        setTestProgress(testRecords.length / scenario.inputs.length);
      },
      () => {
        actions.endGame();
        setIsRunningTest(false);
        setTestProgress(0);
      }
    );
  }, [savedConfig, actions, setActivePanel]);

  const navItems = [
    { id: 'config' as ActivePanel, label: '配置', icon: Settings },
    { id: 'game' as ActivePanel, label: '游戏', icon: BarChart3 },
    { id: 'records' as ActivePanel, label: '记录', icon: ListOrdered },
    { id: 'test' as ActivePanel, label: '测试', icon: FlaskConical },
  ];

  const canStartGame = savedConfig !== null && configValidation.isValid && state.status === 'idle';
  const isGameActive = state.status === 'playing' || state.status === 'paused';
  const showSettlement = state.status === 'ended' && activePanel === 'game';
  const showPlayback = state.status === 'playback';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AnimatePresence>
        {showFailureFlash && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4"
          >
            <div className="bg-red-900/90 border-2 border-red-500 rounded-lg p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <div className="text-red-400 font-bold">操作失败</div>
                  <div className="text-red-300 text-sm">{lastFailureReason}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg flex items-center justify-center shadow-lg">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">桥梁载荷闯关</h1>
                <p className="text-sm text-gray-400">活动策划阿蓝 · 课堂计分工具</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <StatusIndicator status={state.status} pauseNote={state.pauseNote} />
              
              <nav className="flex gap-1 bg-slate-900/50 rounded-lg p-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActivePanel(item.id)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        activePanel === item.id
                          ? 'bg-amber-600 text-white shadow-lg'
                          : 'text-gray-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {activePanel === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              <ConfigPanel
                currentConfig={savedConfig}
                onSave={handleSaveConfig}
                disabled={isGameActive}
              />
              
              {canStartGame && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 p-4 bg-emerald-900/30 border-2 border-emerald-700 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-emerald-500" />
                      <div>
                        <div className="text-emerald-400 font-bold">配置已就绪</div>
                        <div className="text-emerald-300 text-sm">点击「游戏」选项卡，然后点击「开始」按钮开始游戏</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActivePanel('game')}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all hover:scale-105 active:scale-95"
                    >
                      前往游戏
                    </button>
                  </div>
                </motion.div>
              )}

              {!configValidation.isValid && savedConfig && (
                <div className="mt-6 p-4 bg-red-900/30 border-2 border-red-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                    <div>
                      <div className="text-red-400 font-bold">配置存在错误</div>
                      <div className="text-red-300 text-sm">请修正配置错误后再开始游戏</div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activePanel === 'game' && (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {showPlayback ? (
                <PlaybackPanel
                  state={state}
                  onPrev={actions.playbackPrev}
                  onNext={actions.playbackNext}
                  onGoto={actions.playbackGoto}
                  onStop={actions.stopPlayback}
                />
              ) : showSettlement ? (
                <SettlementPanel state={state} stats={stats} />
              ) : (
                <>
                  <GameControls
                    status={state.status}
                    onStart={handleStartGame}
                    onPause={actions.pauseGame}
                    onResume={actions.resumeGame}
                    onRestart={actions.restartGame}
                    onEnd={actions.endGame}
                    onPlayback={handlePlayback}
                    hasRecords={state.records.length > 0}
                    isConfigValid={canStartGame}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-slate-800/60 rounded-xl border-2 border-slate-700 p-6">
                        <LoadDisplay
                          currentLoad={state.currentLoad}
                          maxLoad={state.maxLoad || 1000}
                          targetLoad={state.targetLoad || 800}
                          currentRound={state.currentRound || 1}
                          totalRounds={state.totalRounds || 10}
                          isFailure={showFailureFlash}
                        />
                      </div>

                      <div className="bg-slate-800/60 rounded-xl border-2 border-slate-700 p-6">
                        <DataInput
                          status={state.status}
                          onSubmit={handleSubmitInput}
                          timeLimit={state.config?.timeLimitPerRound || 5000}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-800/60 rounded-xl border-2 border-slate-700 p-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <ListOrdered className="w-5 h-5 text-amber-500" />
                        操作记录
                        <span className="ml-auto text-sm text-gray-400 font-mono">
                          {state.records.length} 条
                        </span>
                      </h3>
                      <RecordList records={state.records} />
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activePanel === 'records' && (
            <motion.div
              key="records"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="bg-slate-800/60 rounded-xl border-2 border-slate-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <ListOrdered className="w-6 h-6 text-amber-500" />
                  完整记录列表
                  <span className="ml-auto text-sm text-gray-400 font-mono">
                    共 {state.records.length} 条记录
                  </span>
                </h3>
                {state.records.length > 0 ? (
                  <RecordList records={state.records} />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <ListOrdered className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>暂无记录</p>
                    <p className="text-sm mt-1">开始游戏后，提交的数据会显示在这里</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activePanel === 'test' && (
            <motion.div
              key="test"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-slate-800/60 rounded-xl border-2 border-slate-700 p-6">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <FlaskConical className="w-6 h-6 text-amber-500" />
                  脏数据测试套件
                </h3>
                <p className="text-gray-400 mb-6">
                  选择一个测试场景，自动模拟课堂上可能出现的各种异常数据输入，验证系统的处理能力。
                </p>

                {isRunningTest && (
                  <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-blue-400 font-medium">正在运行测试...</span>
                      <span className="text-blue-400 font-mono">{Math.round(testProgress * 100)}%</span>
                    </div>
                    <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${testProgress * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {DIRTY_TEST_SCENARIOS.map((scenario, index) => (
                    <div
                      key={index}
                      className="p-4 bg-slate-900/50 rounded-lg border-2 border-slate-700 hover:border-amber-600 transition-colors"
                    >
                      <h4 className="font-bold text-white mb-1">{scenario.name}</h4>
                      <p className="text-sm text-gray-400 mb-3">{scenario.description}</p>
                      <div className="text-xs text-gray-500 mb-3">
                        包含 {scenario.inputs.length} 条测试用例
                      </div>
                      <button
                        onClick={() => handleRunTest(index)}
                        disabled={isRunningTest || !savedConfig}
                        className={`w-full py-2 rounded font-medium text-sm transition-all ${
                          isRunningTest || !savedConfig
                            ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                            : 'bg-amber-600 hover:bg-amber-500 text-white hover:scale-105 active:scale-95'
                        }`}
                      >
                        {!savedConfig ? '请先保存配置' : isRunningTest ? '测试进行中...' : '运行测试'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-900/20 border-2 border-amber-700 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-amber-400 font-bold mb-2">测试说明</h4>
                    <ul className="text-amber-200 text-sm space-y-1">
                      <li>• 测试数据会自动标记为「测试」来源，与真实课堂数据区分</li>
                      <li>• 每个测试场景包含不同类型的脏数据：空值、重复项、边界值、误操作等</li>
                      <li>• 测试完成后会自动进入结算页面，可导出结果检查</li>
                      <li>• 导出的CSV文件会包含所有原始数据和处理说明，方便交接给阿蓝</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div>桥梁载荷闯关 · 课堂计分工具 · 给活动策划阿蓝交接用</div>
            <div className="flex items-center gap-4">
              <span>配置版本: v1.0</span>
              <span>·</span>
              <span>操作人: 课堂组织者</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;

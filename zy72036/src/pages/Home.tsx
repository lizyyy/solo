import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { StatusDashboard } from '../components/StatusDashboard';
import { SkatePark } from '../components/SkatePark';
import { OperationTimeline } from '../components/OperationTimeline';
import { NotesPanel } from '../components/NotesPanel';
import { LevelSelector } from '../components/LevelSelector';
import { formatTimestamp } from '../utils/gameEngine';
import { Play, Square, RotateCcw, AlertCircle, User } from 'lucide-react';

export default function Home() {
  const {
    currentLevel,
    currentLevelId,
    levels,
    currentSession,
    currentState,
    records,
    notes,
    error,
    operatorName,
    setCurrentLevel,
    startNewSession,
    endCurrentSession,
    handleElementDrop,
    handleElementClick,
    addSupplementaryNote,
    updateNote,
    resetCurrentState,
    exportLevel,
    importLevel,
    setOperatorName,
    init,
  } = useGameStore();

  const [previousState, setPreviousState] = useState(currentState);
  const [showOperatorInput, setShowOperatorInput] = useState(false);
  const [operatorInput, setOperatorInput] = useState(operatorName);
  const prevStateRef = useRef(currentState);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (
      prevStateRef.current.resources !== currentState.resources ||
      prevStateRef.current.score !== currentState.score ||
      prevStateRef.current.risk !== currentState.risk
    ) {
      setPreviousState(prevStateRef.current);
      prevStateRef.current = currentState;
    }
  }, [currentState]);

  const handleOperatorSave = () => {
    if (operatorInput.trim()) {
      setOperatorName(operatorInput.trim());
      setShowOperatorInput(false);
    }
  };

  if (!currentLevel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🛹</div>
          <div className="font-hand text-3xl text-chalk mb-2">微积分滑板公园</div>
          <div className="text-chalk-muted font-mono">正在加载...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="font-hand text-4xl text-chalk chalk-text">
            🛹 微积分滑板公园
          </h1>
          <p className="text-chalk-muted font-mono text-sm mt-1">
            让课堂计分表里的乱材料能对得上
          </p>
        </div>
        <div className="flex items-center gap-3">
          {showOperatorInput ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={operatorInput}
                onChange={(e) => setOperatorInput(e.target.value)}
                className="px-3 py-1 bg-chalkboard border border-chalk/30 rounded text-chalk font-mono text-sm w-32"
                placeholder="操作人姓名"
                autoFocus
              />
              <button
                onClick={handleOperatorSave}
                className="chalk-button text-xs py-1 px-3 border-skate-teal text-skate-teal"
              >
                确定
              </button>
              <button
                onClick={() => {
                  setShowOperatorInput(false);
                  setOperatorInput(operatorName);
                }}
                className="chalk-button text-xs py-1 px-3 border-chalk-muted text-chalk-muted"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowOperatorInput(true)}
              className="flex items-center gap-2 px-3 py-2 bg-chalkboard-light rounded-lg border border-chalk/20 hover:border-chalk/40 transition-colors"
            >
              <User size={16} className="text-skate-orange" />
              <span className="font-mono text-sm text-chalk">{operatorName}</span>
            </button>
          )}
          {currentSession && (
            <div className="text-xs text-chalk-muted font-mono bg-chalkboard-light px-3 py-2 rounded-lg">
              开始时间: {formatTimestamp(currentSession.startTime)}
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-skate-red/20 border-2 border-skate-red rounded-lg flex items-center gap-3"
          >
            <AlertCircle className="text-skate-red flex-shrink-0" size={20} />
            <span className="text-chalk font-mono text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <LevelSelector
        levels={levels}
        currentLevelId={currentLevelId}
        onSelectLevel={setCurrentLevel}
        onExportLevel={exportLevel}
        onImportLevel={importLevel}
      />

      <div className="flex gap-3 mb-4">
        {!currentSession ? (
          <button
            onClick={startNewSession}
            className="chalk-button flex items-center gap-2 border-skate-teal text-skate-teal"
          >
            <Play size={18} />
            开始新对局
          </button>
        ) : (
          <>
            <button
              onClick={endCurrentSession}
              className="chalk-button flex items-center gap-2 border-skate-red text-skate-red"
            >
              <Square size={18} />
              结束本局
            </button>
            <button
              onClick={resetCurrentState}
              className="chalk-button flex items-center gap-2 border-skate-orange text-skate-orange"
            >
              <RotateCcw size={18} />
              重置状态
            </button>
          </>
        )}
      </div>

      <StatusDashboard currentState={currentState} previousState={previousState} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SkatePark
            zones={currentLevel.zones}
            elements={currentLevel.elements}
            currentState={currentState}
            onDrop={handleElementDrop}
            onClick={handleElementClick}
            disabled={!currentSession}
          />

          <div className="bg-chalkboard-light rounded-lg p-4 border border-chalk/20">
            <OperationTimeline records={records} />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-chalkboard-light rounded-lg p-4 border border-chalk/20 sticky top-6">
            <NotesPanel
              notes={notes}
              onAddNote={addSupplementaryNote}
              onUpdateNote={updateNote}
              disabled={!currentSession}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-chalkboard-light/50 rounded-lg border border-chalk/10">
        <div className="text-xs text-chalk-muted font-mono">
          <div className="font-bold text-skate-orange mb-2">📌 数据追溯说明</div>
          <ul className="space-y-1 list-disc list-inside columns-2">
            <li>每条操作记录都包含：操作ID、时间戳、计算过程、前后状态</li>
            <li>原始备注完整保留，不做任何清洗或修改</li>
            <li>补录备注每次修改都记录差异对比、修改人、修改时间</li>
            <li>资源负数时明确提示，禁止继续操作</li>
            <li>所有数据保存在本地LocalStorage，支持导出关卡配置</li>
            <li>结束对局后自动保存到历史记录，可在历史页面查看</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

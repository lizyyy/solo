import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/common/Navbar';
import { ErrorToast } from '@/components/common/ErrorToast';
import { ControlBar } from '@/components/game/ControlBar';
import { ResourcePanel } from '@/components/game/ResourcePanel';
import { MazeMap } from '@/components/game/MazeMap';
import { DecisionPanel } from '@/components/game/DecisionPanel';
import { ResultPanel } from '@/components/game/ResultPanel';
import { StartGameModal } from '@/components/game/StartGameModal';
import { SupplementModal } from '@/components/game/SupplementModal';
import { useGameStore } from '@/stores/useGameStore';
import { useInitData } from '@/hooks/useInitData';
import { hasNegativeResources } from '@/utils/helpers';
import type { ResourceEffect } from '@/types';

export default function Home() {
  useInitData();
  const navigate = useNavigate();

  const {
    session,
    engine,
    isLoading,
    error,
    initEngine,
    startGame,
    makeDecision,
    supplementMaterials,
    pauseGame,
    resumeGame,
    restartGame,
    endGame,
    setTeacherNotes,
    clearGame,
    setError,
  } = useGameStore();

  const [showStartModal, setShowStartModal] = useState(false);
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [lastDecision, setLastDecision] = useState<string | null>(null);

  useEffect(() => {
    initEngine();
  }, [initEngine]);

  const handleStartGame = useCallback((levelId: string, playerName: string) => {
    startGame(levelId, playerName);
    setShowStartModal(false);
  }, [startGame]);

  const handleMakeDecision = useCallback(async (decisionId: string) => {
    try {
      await makeDecision(decisionId);
      setLastDecision(decisionId);
      
      const currentSession = useGameStore.getState().session;
      if (currentSession?.hasNegativeResources) {
        setShowSupplementModal(true);
      }
    } catch (e) {
      console.error('Failed to make decision:', e);
    }
  }, [makeDecision]);

  const handleSupplementMaterials = useCallback(async (effects: ResourceEffect[], reason: string) => {
    try {
      await supplementMaterials(effects, reason);
      setShowSupplementModal(false);
    } catch (e) {
      console.error('Failed to supplement materials:', e);
    }
  }, [supplementMaterials]);

  const handleEndGame = useCallback(async () => {
    try {
      await endGame();
    } catch (e) {
      console.error('Failed to end game:', e);
    }
  }, [endGame]);

  const handleRestart = useCallback(async () => {
    try {
      await restartGame();
      setLastDecision(null);
    } catch (e) {
      console.error('Failed to restart:', e);
    }
  }, [restartGame]);

  const handleSaveNotes = useCallback(async (notes: string) => {
    await setTeacherNotes(notes);
  }, [setTeacherNotes]);

  const handleViewHistory = useCallback(() => {
    navigate('/history');
  }, [navigate]);

  const currentNode = engine?.getCurrentNode() || null;
  const availableDecisions = engine?.getAvailableDecisions() || [];
  const hasNegative = session ? hasNegativeResources(session.currentResources) : false;
  const isCompleted = session?.status === 'completed';
  const previousResources = session?.stepHistory.length > 1 
    ? session.stepHistory[session.stepHistory.length - 2]?.resourcesAfter 
    : undefined;

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="container mx-auto px-4 pb-8">
        {error && (
          <ErrorToast message={error} onClose={() => setError(null)} />
        )}

        {!session || session.status === 'idle' ? (
          <div className="max-w-2xl mx-auto text-center py-16 animate-fade-in">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
              <svg className="w-12 h-12 text-primary-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4 text-glow">
              央行利率迷宫
            </h1>
            <p className="text-lg text-white/70 mb-8">
              扮演央行行长，通过调整利率和准备金率，
              <br />
              在复杂的经济迷宫中找到平衡之路
            </p>
            <button
              onClick={() => setShowStartModal(true)}
              className="btn-primary text-lg px-8 py-3"
            >
              开始新游戏
            </button>
            
            <div className="mt-12 grid grid-cols-3 gap-6">
              <div className="card text-center">
                <div className="text-3xl font-bold text-accent-400 mb-2">6</div>
                <div className="text-sm text-white/60">经济指标监控</div>
              </div>
              <div className="card text-center">
                <div className="text-3xl font-bold text-accent-400 mb-2">7+</div>
                <div className="text-sm text-white/60">决策节点</div>
              </div>
              <div className="card text-center">
                <div className="text-3xl font-bold text-accent-400 mb-2">100</div>
                <div className="text-sm text-white/60">满分挑战</div>
              </div>
            </div>
          </div>
        ) : isCompleted && session.scoreResult ? (
          <div className="max-w-3xl mx-auto animate-slide-up">
            <ResultPanel
              session={session}
              scoreResult={session.scoreResult}
              onRestart={handleRestart}
              onSaveNotes={handleSaveNotes}
              onViewHistory={handleViewHistory}
            />
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <ControlBar
              session={session}
              onStart={() => setShowStartModal(true)}
              onPause={pauseGame}
              onResume={resumeGame}
              onRestart={handleRestart}
              onEnd={handleEndGame}
              isLoading={isLoading}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <ResourcePanel
                  resources={session.currentResources}
                  hasNegative={hasNegative}
                  showComparison={true}
                  previousResources={previousResources}
                />
              </div>

              <div className="lg:col-span-1">
                {engine?.getLevel() && (
                  <MazeMap
                    level={engine.getLevel()!}
                    currentNodeId={session.currentNodeId}
                    visitedNodeIds={engine.getVisitedNodes()}
                  />
                )}
              </div>

              <div className="lg:col-span-1">
                <DecisionPanel
                  decisions={availableDecisions}
                  onDecision={handleMakeDecision}
                  disabled={!engine?.canMakeDecision() || isLoading}
                  currentNodeDescription={currentNode?.description}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <StartGameModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onStart={handleStartGame}
        isLoading={isLoading}
      />

      {session && (
        <SupplementModal
          isOpen={showSupplementModal}
          onClose={() => setShowSupplementModal(false)}
          onSubmit={handleSupplementMaterials}
          currentResources={session.currentResources}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

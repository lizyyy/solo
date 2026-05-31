import { useEffect } from 'react';
import { Navbar } from '@/components/common/Navbar';
import { ErrorToast } from '@/components/common/ErrorToast';
import { SessionList } from '@/components/history/SessionList';
import { ReplayControls } from '@/components/history/ReplayControls';
import { StepTimeline } from '@/components/history/StepTimeline';
import { ResourcePanel } from '@/components/game/ResourcePanel';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { hasNegativeResources } from '@/utils/helpers';

export default function History() {
  const {
    sessions,
    replayState,
    selectedSessionId,
    isLoading,
    error,
    fetchSessions,
    deleteSession,
    loadReplaySession,
    unloadReplaySession,
    playReplay,
    pauseReplay,
    prevReplayStep,
    nextReplayStep,
    seekReplayTo,
    setReplaySpeed,
    setSelectedSessionId,
    clearError,
  } = useHistoryStore();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handlePlayReplay = async (sessionId: string) => {
    try {
      await loadReplaySession(sessionId);
    } catch (e) {
      console.error('Failed to load replay:', e);
    }
  };

  const handleStopReplay = () => {
    unloadReplaySession();
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const currentStep = replayState?.session?.stepHistory[replayState.currentStepIndex];

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="container mx-auto px-4 pb-8">
        {error && (
          <ErrorToast message={error} onClose={() => clearError()} />
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">历史记录</h1>
          <p className="text-white/60">查看和回放已完成的游戏记录</p>
        </div>

        {replayState?.session ? (
          <div className="space-y-6 animate-fade-in">
            <ReplayControls
              replayState={replayState}
              onPlay={playReplay}
              onPause={pauseReplay}
              onPrevStep={prevReplayStep}
              onNextStep={nextReplayStep}
              onStop={handleStopReplay}
              onSeek={seekReplayTo}
              onSpeedChange={setReplaySpeed}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <ResourcePanel
                  resources={currentStep?.resourcesAfter || replayState.session.currentResources}
                  hasNegative={hasNegativeResources(
                    currentStep?.resourcesAfter || replayState.session.currentResources
                  )}
                  showComparison={true}
                  previousResources={currentStep?.resourcesBefore}
                  title="当前资源状态"
                />
              </div>
              <div>
                <StepTimeline
                  steps={replayState.session.stepHistory}
                  currentStepIndex={replayState.currentStepIndex}
                  onStepClick={seekReplayTo}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <SessionList
                sessions={sessions}
                selectedSessionId={selectedSessionId}
                onSelect={handleSelectSession}
                onDelete={deleteSession}
                onPlay={handlePlayReplay}
                isLoading={isLoading}
              />
            </div>

            <div className="lg:col-span-2">
              {selectedSession ? (
                <div className="space-y-6 animate-slide-in-right">
                  <div className="card">
                    <h3 className="text-lg font-bold text-accent-400 mb-4">
                      {selectedSession.playerName} - {selectedSession.levelName}
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-white/5 rounded-lg text-center">
                        <div className="text-2xl font-bold text-white">
                          {selectedSession.stepHistory.length}
                        </div>
                        <div className="text-xs text-white/60">总步数</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg text-center">
                        <div className="text-2xl font-bold text-white">
                          {selectedSession.stepHistory.filter((s) => s.isSupplement).length}
                        </div>
                        <div className="text-xs text-white/60">补充材料</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg text-center">
                        <div className="text-2xl font-bold text-accent-400">
                          {selectedSession.scoreResult?.totalScore || '-'}
                        </div>
                        <div className="text-xs text-white/60">总得分</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg text-center">
                        <div className="text-2xl font-bold text-white">
                          {selectedSession.conflicts.length}
                        </div>
                        <div className="text-xs text-white/60">数据冲突</div>
                      </div>
                    </div>

                    {selectedSession.teacherNotes && (
                      <div className="p-4 bg-primary-900/30 rounded-lg border border-primary-500/30">
                        <h4 className="text-sm font-medium text-accent-400 mb-2">教师评语</h4>
                        <p className="text-sm text-white/80">{selectedSession.teacherNotes}</p>
                      </div>
                    )}
                  </div>

                  <StepTimeline
                    steps={selectedSession.stepHistory}
                    currentStepIndex={selectedSession.stepHistory.length - 1}
                  />
                </div>
              ) : (
                <div className="card h-64 flex items-center justify-center">
                  <p className="text-white/50">选择左侧记录查看详情</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

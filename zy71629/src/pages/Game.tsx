import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Music, Play, Volume2, Info, ChevronRight, Lightbulb } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, GradeBadge, ErrorTypeBadge } from '@/components/ui/Badge';
import { FeedbackToast } from '@/components/ui/FeedbackToast';
import { Metronome } from '@/components/music/Metronome';
import { StaffDisplay } from '@/components/music/StaffDisplay';
import { PhraseCard } from '@/components/music/PhraseCard';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useMaterialStore } from '@/store/useMaterialStore';
import { getChordById } from '@/data/chords';
import { getChordAtMeasure } from '@/data/progressions';
import { suggestPhrases, analyzeChordChoice } from '@/engine/chordEngine';
import { getGameProgress, isGameComplete } from '@/engine/gameEngine';
import { playPhrase, playChord, resumeAudioContext } from '@/utils/audio';
import { getErrorTypeLabel, getErrorTypeColor } from '@/utils/playback';
import { cn } from '@/lib/utils';
import type { Phrase, Chord, ErrorDetail } from '@/types/music';

const Game: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { role, student } = useUserStore();
  const {
    currentGame,
    currentSession,
    currentContext,
    currentMeasure,
    selectedPhrase,
    usedPhraseIds,
    feedback,
    startGame,
    selectPhrase,
    confirmPhrase,
    completeGame,
    setFeedback,
    clearCurrentGame,
    loadGames,
    loadSessions,
    getSessionsByGame,
  } = useGameStore();
  const { phrases, loadMaterials, getChord: getChordFromStore } = useMaterialStore();

  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  useEffect(() => {
    if (!role || !student) {
      navigate('/');
      return;
    }
    loadGames();
    loadSessions();
    loadMaterials();
  }, [role, student, navigate, loadGames, loadSessions, loadMaterials]);

  useEffect(() => {
    if (gameId && !currentGame && student) {
      const existingSessions = getSessionsByGame(gameId);
      const userSession = existingSessions.find(s => s.studentId === student.id && !s.score);
      
      if (userSession) {
        // 恢复已有会话
        const games = useGameStore.getState().games;
        const game = games.find(g => g.id === gameId);
        if (game) {
          startGame(gameId, student.id, student.name);
        }
      } else {
        startGame(gameId, student.id, student.name);
      }
    }
  }, [gameId, currentGame, student, startGame, getSessionsByGame]);

  const currentChord = useMemo(() => {
    if (!currentContext || !currentMeasure) return null;
    const chordId = getChordAtMeasure(currentContext.progression, currentMeasure);
    return chordId ? (getChordById(chordId) || getChordFromStore(chordId)) : null;
  }, [currentContext, currentMeasure, getChordFromStore]);

  const recommendedPhrases = useMemo(() => {
    if (!currentContext || !currentChord) return [];
    const available = currentContext.availablePhrases.filter(p => !usedPhraseIds.has(p.id));
    return suggestPhrases(available, currentChord, 3);
  }, [currentContext, currentChord, usedPhraseIds]);

  const availablePhrases = useMemo(() => {
    if (!currentContext) return [];
    return currentContext.availablePhrases;
  }, [currentContext]);

  const progress = useMemo(() => {
    if (!currentSession || !currentContext) return 0;
    return getGameProgress(currentSession, currentContext);
  }, [currentSession, currentContext]);

  const completedMoves = useMemo(() => {
    if (!currentSession) return [];
    return currentSession.moves.map(m => ({
      measureNumber: m.measureNumber,
      phrase: m.phrase,
      isCorrect: m.isCorrect,
    }));
  }, [currentSession]);

  const analysis = useMemo(() => {
    if (!selectedPhrase || !currentChord) return null;
    return analyzeChordChoice(selectedPhrase, currentChord, currentMeasure);
  }, [selectedPhrase, currentChord, currentMeasure]);

  const handlePreviewSelected = async () => {
    if (!selectedPhrase || !currentContext) return;
    setIsPreviewPlaying(true);
    await resumeAudioContext();
    await playPhrase(selectedPhrase, currentContext.rhythm);
    setIsPreviewPlaying(false);
  };

  const handlePlayChord = async () => {
    if (!currentChord) return;
    await resumeAudioContext();
    playChord(currentChord.allowedNotes, 4, 0, 1.5, 0.2);
  };

  const handleConfirmPhrase = async () => {
    if (!selectedPhrase) return;
    await resumeAudioContext();
    confirmPhrase();
    setShowAnalysis(false);
  };

  const handleCompleteGame = () => {
    const score = completeGame();
    if (score && currentSession) {
      navigate(`/results/${currentSession.id}`);
    }
  };

  const handleBack = () => {
    clearCurrentGame();
    navigate('/lobby');
  };

  const gameComplete = currentSession && currentContext && isGameComplete(currentSession, currentContext);

  if (!currentGame || !currentContext || !currentChord) {
    return (
      <div className="min-h-screen bg-jazz-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-jazz-gold/20 flex items-center justify-center animate-pulse">
            <Music className="w-8 h-8 text-jazz-gold" />
          </div>
          <p className="text-jazz-textMuted">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jazz-bg">
      <FeedbackToast feedback={feedback} onClose={() => setFeedback(null)} />

      <header className="glass border-b border-jazz-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={handleBack} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>
              <div>
                <h1 className="font-display text-xl font-bold text-jazz-gold">{currentGame.name}</h1>
                <p className="text-xs text-jazz-textMuted">
                  {currentContext.progression.name} · {currentContext.rhythm.bpm} BPM
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Metronome
                bpm={currentContext.rhythm.bpm}
                timeSignature={currentContext.rhythm.timeSignature}
                compact
              />
              <div className="text-right">
                <div className="text-sm text-jazz-textMuted">完成进度</div>
                <div className="font-display text-lg font-bold text-jazz-gold">{progress}%</div>
              </div>
            </div>
          </div>

          <div className="h-2 bg-jazz-bgLight rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-jazz-gold to-jazz-goldLight transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="glass rounded-xl p-2 mb-4">
            <StaffDisplay
              progression={currentContext.progression}
              completedMoves={completedMoves}
              currentMeasure={currentMeasure}
              highlightErrors
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card glass className="mb-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-jazz-gold/20 flex items-center justify-center">
                      <span className="font-display text-2xl font-bold text-jazz-gold">{currentMeasure}</span>
                    </div>
                    <div>
                      <h3 className="font-display text-lg text-jazz-text">当前小节</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="gold" className="text-base px-3 py-1">
                          {currentChord.symbol}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePlayChord}
                          className="gap-1 h-8"
                        >
                          <Volume2 className="w-4 h-4" />
                          听和弦
                        </Button>
                      </div>
                    </div>
                  </div>

                  {gameComplete && (
                    <Button variant="brass" onClick={handleCompleteGame} className="gap-2">
                      <CheckCircle className="w-4 h-4" />
                      完成游戏
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-jazz-green/10">
                    <div className="text-xs text-jazz-textMuted mb-1">和弦内音</div>
                    <div className="font-mono text-sm text-jazz-greenLight">
                      {currentChord.allowedNotes.join(', ')}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <div className="text-xs text-jazz-textMuted mb-1">经过音</div>
                    <div className="font-mono text-sm text-blue-400">
                      {currentChord.passingNotes.join(', ')}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-jazz-bgLight">
                    <div className="text-xs text-jazz-textMuted mb-1">拍号</div>
                    <div className="font-mono text-sm text-jazz-text">
                      {currentContext.rhythm.timeSignature[0]}/{currentContext.rhythm.timeSignature[1]}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-jazz-bgLight">
                    <div className="text-xs text-jazz-textMuted mb-1">速度</div>
                    <div className="font-mono text-sm text-jazz-text">
                      {currentContext.rhythm.bpm} BPM
                    </div>
                  </div>
                </div>

                {selectedPhrase && analysis && (
                  <div className="p-4 rounded-xl bg-jazz-bgLight border border-jazz-border mb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-jazz-gold" />
                        <h4 className="font-display font-semibold text-jazz-text">选择分析</h4>
                      </div>
                      <Badge variant={analysis.isCorrect ? 'success' : 'warning'}>
                        {analysis.isCorrect ? '匹配良好' : '需要调整'}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-jazz-text mb-3">{analysis.explanation}</p>
                    
                    {analysis.strengths.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-jazz-greenLight font-medium mb-1">✓ 优点</div>
                        <ul className="text-sm text-jazz-text space-y-1">
                          {analysis.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-jazz-green">•</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {analysis.improvements.length > 0 && (
                      <div>
                        <div className="text-xs text-jazz-burgundyLight font-medium mb-1">
                          ⚠ 需要改进
                        </div>
                        <ul className="text-sm text-jazz-text space-y-1">
                          {analysis.improvements.map((s, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-jazz-burgundy">•</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {selectedPhrase && (
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={handlePreviewSelected}
                      disabled={isPreviewPlaying}
                      className="gap-2 flex-1"
                    >
                      <Play className="w-4 h-4" />
                      {isPreviewPlaying ? '播放中...' : '试听乐句'}
                    </Button>
                    <Button
                      variant="brass"
                      onClick={handleConfirmPhrase}
                      className="gap-2 flex-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      确认选择
                    </Button>
                  </div>
                )}

                {!selectedPhrase && (
                  <div className="text-center py-6 text-jazz-textMuted">
                    <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>从下方选择一个乐句来完成第 {currentMeasure} 小节</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card glass>
              <CardHeader className="pb-3">
                <h3 className="font-display text-lg text-jazz-text">可用乐句</h3>
                <p className="text-sm text-jazz-textMuted">
                  选择一个与 {currentChord.symbol} 和弦匹配的乐句
                </p>
              </CardHeader>
              <CardContent>
                {recommendedPhrases.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-jazz-green" />
                      <span className="text-sm font-medium text-jazz-greenLight">推荐选择</span>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      {recommendedPhrases.map((phrase) => (
                        <PhraseCard
                          key={phrase.id}
                          phrase={phrase}
                          compatibleChords={phrase.compatibleChords
                            .map(id => getChordById(id) || getChordFromStore(id))
                            .filter((c): c is Chord => c !== undefined)}
                          isSelected={selectedPhrase?.id === phrase.id}
                          isUsed={usedPhraseIds.has(phrase.id)}
                          isRecommended
                          rhythmPattern={currentContext.rhythm}
                          onClick={() => selectPhrase(phrase)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Music className="w-4 h-4 text-jazz-gold" />
                    <span className="text-sm font-medium text-jazz-text">全部乐句</span>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availablePhrases
                      .filter(p => !recommendedPhrases.find(r => r.id === p.id))
                      .map((phrase) => (
                        <PhraseCard
                          key={phrase.id}
                          phrase={phrase}
                          compatibleChords={phrase.compatibleChords
                            .map(id => getChordById(id) || getChordFromStore(id))
                            .filter((c): c is Chord => c !== undefined)}
                          isSelected={selectedPhrase?.id === phrase.id}
                          isUsed={usedPhraseIds.has(phrase.id)}
                          rhythmPattern={currentContext.rhythm}
                          onClick={() => selectPhrase(phrase)}
                        />
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card glass>
              <CardHeader className="pb-3">
                <h3 className="font-display text-lg text-jazz-text">游戏信息</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs text-jazz-textMuted mb-1">学生</div>
                  <div className="text-jazz-text">{student?.name}</div>
                </div>
                <div>
                  <div className="text-xs text-jazz-textMuted mb-1">和弦进行</div>
                  <div className="text-jazz-text">{currentContext.progression.name}</div>
                </div>
                <div>
                  <div className="text-xs text-jazz-textMuted mb-1">节奏模式</div>
                  <div className="text-jazz-text">
                    {currentContext.rhythm.timeSignature[0]}/{currentContext.rhythm.timeSignature[1]} @ {currentContext.rhythm.bpm} BPM
                    {currentContext.rhythm.swingFactor && currentContext.rhythm.swingFactor > 0.3 && (
                      <Badge variant="info" className="ml-2 text-xs">Swing</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-jazz-textMuted mb-1">小节数</div>
                  <div className="text-jazz-text">{currentContext.progression.totalMeasures} 小节</div>
                </div>
              </CardContent>
            </Card>

            {currentSession && currentSession.moves.length > 0 && (
              <Card glass>
                <CardHeader className="pb-3">
                  <h3 className="font-display text-lg text-jazz-text">已完成小节</h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {currentSession.moves
                      .slice()
                      .sort((a, b) => a.measureNumber - b.measureNumber)
                      .map((move) => (
                        <div
                          key={move.id}
                          className={cn(
                            'p-3 rounded-lg border transition-all',
                            move.isCorrect
                              ? 'bg-jazz-green/5 border-jazz-green/30'
                              : 'bg-jazz-burgundy/5 border-jazz-burgundy/30'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-jazz-text">
                              第 {move.measureNumber} 小节
                            </span>
                            {move.isCorrect ? (
                              <CheckCircle className="w-4 h-4 text-jazz-green" />
                            ) : (
                              <XCircle className="w-4 h-4 text-jazz-burgundy" />
                            )}
                          </div>
                          <div className="text-xs text-jazz-textMuted mb-1">
                            {move.phrase.name}
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span className="text-jazz-greenLight">和弦: {move.chordScore}</span>
                            <span className="text-blue-400">节拍: {move.rhythmScore}</span>
                          </div>
                          {move.errors.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {move.errors.slice(0, 2).map((error: ErrorDetail) => (
                                <ErrorTypeBadge key={error.id} type={error.type} className="text-xs" />
                              ))}
                              {move.errors.length > 2 && (
                                <span className="text-xs text-jazz-textMuted">
                                  +{move.errors.length - 2} 更多
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card glass>
              <CardHeader className="pb-3">
                <h3 className="font-display text-lg text-jazz-text">错误类型说明</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <Badge variant="error" className="flex-shrink-0 mt-0.5">数据</Badge>
                  <div>
                    <div className="text-sm text-jazz-text">数据问题</div>
                    <div className="text-xs text-jazz-textMuted">和弦外音、音高错误等</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="warning" className="flex-shrink-0 mt-0.5">规则</Badge>
                  <div>
                    <div className="text-sm text-jazz-text">规则问题</div>
                    <div className="text-xs text-jazz-textMuted">小节超拍、节拍错位等</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="info" className="flex-shrink-0 mt-0.5">材料</Badge>
                  <div>
                    <div className="text-sm text-jazz-text">材料问题</div>
                    <div className="text-xs text-jazz-textMuted">重复乐句、兼容性问题等</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Game;

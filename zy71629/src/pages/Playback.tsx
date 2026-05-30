import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Filter,
  Music,
  AlertTriangle,
  XCircle,
  Lightbulb,
  ChevronRight,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, ErrorTypeBadge } from '@/components/ui/Badge';
import { StaffDisplay } from '@/components/music/StaffDisplay';
import { useGameStore, initializeGameData } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useMaterialStore, initializeMaterialData } from '@/store/useMaterialStore';
import { createGameContext } from '@/engine/gameEngine';
import {
  generatePlaybackTimeline,
  getTotalDuration,
  getPositionAtTime,
  filterErrorsByType,
  getErrorsByMeasure,
  getMoveAtMeasure,
  playMeasureAt,
  getErrorTypeLabel,
  getErrorTypeColor,
  getErrorTypeBg,
  getErrorTypeDescription,
  getErrorTypeIcon,
} from '@/utils/playback';
import { resumeAudioContext, stopAllAudio } from '@/utils/audio';
import { cn } from '@/lib/utils';
import type { ErrorType, GameSession } from '@/types/music';
import type { GameContext } from '@/engine/gameEngine';
import type { PlaybackEvent, PlaybackPosition } from '@/utils/playback';

const Playback: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { role } = useUserStore();
  const { sessions, games, getSessionById, loadGames, loadSessions } = useGameStore();
  const { loadMaterials } = useMaterialStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMeasure, setCurrentMeasure] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [filteredErrorTypes, setFilteredErrorTypes] = useState<ErrorType[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeEvent, setActiveEvent] = useState<PlaybackEvent | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!role) {
      navigate('/');
      return;
    }
    initializeGameData();
    initializeMaterialData();
    loadGames();
    loadSessions();
    loadMaterials();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      stopAllAudio();
    };
  }, [role, navigate, loadGames, loadSessions, loadMaterials]);

  const session = useMemo(() => {
    return sessionId ? getSessionById(sessionId) : undefined;
  }, [sessionId, getSessionById, sessions]);

  const game = useMemo(() => {
    if (!session) return null;
    return games.find((g) => g.id === session.gameId);
  }, [session, games]);

  const context = useMemo((): GameContext | null => {
    if (!game) return null;
    return createGameContext(game);
  }, [game]);

  const filteredSession = useMemo(() => {
    if (!session) return null;
    return filterErrorsByType(session, filteredErrorTypes);
  }, [session, filteredErrorTypes]);

  const timeline = useMemo(() => {
    if (!filteredSession || !context) return [];
    return generatePlaybackTimeline(filteredSession, context);
  }, [filteredSession, context]);

  const totalDuration = useMemo(() => {
    if (!session || !context) return 0;
    return getTotalDuration(session, context);
  }, [session, context]);

  const completedMoves = useMemo(() => {
    if (!filteredSession) return [];
    return filteredSession.moves.map((m) => ({
      measureNumber: m.measureNumber,
      phrase: m.phrase,
      isCorrect: m.isCorrect,
    }));
  }, [filteredSession]);

  const currentErrors = useMemo(() => {
    if (!filteredSession) return [];
    return getErrorsByMeasure(filteredSession, currentMeasure);
  }, [filteredSession, currentMeasure]);

  const currentMove = useMemo(() => {
    if (!session) return null;
    return getMoveAtMeasure(session, currentMeasure);
  }, [session, currentMeasure]);

  const updatePlayback = (timestamp: number) => {
    if (!isPlaying || !context || !session) return;

    const elapsed = (timestamp - startTimeRef.current) * playbackSpeed;
    const newTime = Math.min(elapsed + pausedTimeRef.current, totalDuration);
    setCurrentTime(newTime);

    const position = getPositionAtTime(newTime, session, context);
    if (position.measure !== currentMeasure) {
      setCurrentMeasure(position.measure);
    }

    const event = timeline.find(
      (e) => e.timestamp <= newTime && e.timestamp + 0.05 > newTime
    );
    if (event && event !== activeEvent) {
      setActiveEvent(event);
      if (event.type === 'error') {
        setCurrentMeasure(event.measure);
      }
    }

    if (newTime >= totalDuration) {
      setIsPlaying(false);
      pausedTimeRef.current = 0;
      return;
    }

    animationRef.current = requestAnimationFrame(updatePlayback);
  };

  const handlePlay = async () => {
    if (!session || !context) return;
    await resumeAudioContext();

    if (isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      pausedTimeRef.current = currentTime;
      setIsPlaying(false);
    } else {
      startTimeRef.current = performance.now();
      setIsPlaying(true);
      animationRef.current = requestAnimationFrame(updatePlayback);
    }
  };

  const handleReset = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentMeasure(1);
    pausedTimeRef.current = 0;
    setActiveEvent(null);
    stopAllAudio();
  };

  const handleNextMeasure = () => {
    if (!context) return;
    const next = Math.min(currentMeasure + 1, context.progression.totalMeasures);
    jumpToMeasure(next);
  };

  const handlePrevMeasure = () => {
    const prev = Math.max(currentMeasure - 1, 1);
    jumpToMeasure(prev);
  };

  const jumpToMeasure = async (measure: number) => {
    if (!session || !context) return;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    setCurrentMeasure(measure);
    setIsPlaying(false);

    const beatDuration = 60 / context.rhythm.bpm;
    const beatsPerMeasure = context.rhythm.timeSignature[0];
    const measureDuration = beatDuration * beatsPerMeasure;
    const newTime = (measure - 1) * measureDuration;
    setCurrentTime(newTime);
    pausedTimeRef.current = newTime;
    setActiveEvent(null);

    await playMeasureAt(session, context, measure);
  };

  const handleMeasureClick = (measure: number) => {
    jumpToMeasure(measure);
  };

  const toggleErrorType = (type: ErrorType) => {
    setFilteredErrorTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!session || !context) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * totalDuration;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    setCurrentTime(newTime);
    pausedTimeRef.current = newTime;

    const position = getPositionAtTime(newTime, session, context);
    setCurrentMeasure(position.measure);

    if (isPlaying) {
      startTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(updatePlayback);
    }
  };

  const progressPercentage = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  if (!session || !game || !context) {
    return (
      <div className="min-h-screen bg-jazz-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-jazz-gold/20 flex items-center justify-center animate-pulse">
            <Music className="w-8 h-8 text-jazz-gold" />
          </div>
          <p className="text-jazz-textMuted">加载回放中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jazz-bg">
      <header className="glass border-b border-jazz-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => navigate(`/results/${session.id}`)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回报告
              </Button>
              <div>
                <h1 className="font-display text-xl font-bold text-jazz-gold">错误回放</h1>
                <p className="text-xs text-jazz-textMuted">
                  {session.studentName} · {game.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Button
                  variant="secondary"
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="gap-2"
                >
                  <Filter className="w-4 h-4" />
                  筛选错误
                  {filteredErrorTypes.length > 0 && (
                    <Badge variant="error" className="ml-1">
                      {filteredErrorTypes.length}
                    </Badge>
                  )}
                </Button>

                {showFilterMenu && (
                  <div className="absolute right-0 mt-2 w-64 glass rounded-xl border border-jazz-border overflow-hidden shadow-xl z-50">
                    <div className="p-3 border-b border-jazz-border/50">
                      <div className="text-sm font-medium text-jazz-text mb-2">按错误类型筛选</div>
                      <p className="text-xs text-jazz-textMuted">
                        选择要高亮显示的错误类型
                      </p>
                    </div>
                    {(['data', 'rule', 'material'] as ErrorType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => toggleErrorType(type)}
                        className={cn(
                          'w-full px-4 py-3 flex items-center gap-3 hover:bg-jazz-bgLight transition-colors text-left',
                          filteredErrorTypes.includes(type) && 'bg-jazz-bgLight'
                        )}
                      >
                        <div
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center',
                            filteredErrorTypes.includes(type)
                              ? 'border-jazz-gold bg-jazz-gold'
                              : 'border-jazz-border'
                          )}
                        >
                          {filteredErrorTypes.includes(type) && (
                            <div className="w-2 h-2 rounded-full bg-jazz-bg" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <ErrorTypeBadge type={type} />
                            <span className="text-sm text-jazz-text">{getErrorTypeLabel(type)}</span>
                          </div>
                          <div className="text-xs text-jazz-textMuted mt-0.5">
                            {getErrorTypeDescription(type)}
                          </div>
                        </div>
                      </button>
                    ))}
                    {filteredErrorTypes.length > 0 && (
                      <div className="p-3 border-t border-jazz-border/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFilteredErrorTypes([])}
                          className="w-full"
                        >
                          清除筛选
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                className="bg-jazz-bgLight border border-jazz-border rounded-lg px-3 py-2 text-sm text-jazz-text focus:outline-none focus:ring-2 focus:ring-jazz-gold"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div
                className="h-3 bg-jazz-bgLight rounded-full overflow-hidden cursor-pointer relative group"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-gradient-to-r from-jazz-gold to-jazz-goldLight transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-jazz-gold rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${progressPercentage}% - 10px)` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-jazz-textMuted">
                <span>{currentTime.toFixed(1)}s</span>
                <span>{totalDuration.toFixed(1)}s</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleReset} title="重置">
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handlePrevMeasure} title="上一小节">
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button
                variant="brass"
                size="lg"
                onClick={handlePlay}
                className="w-14 h-14 rounded-full"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-1" />
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNextMeasure} title="下一小节">
                <SkipForward className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => jumpToMeasure(currentMeasure)}
                title="播放当前小节"
              >
                <Volume2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="glass rounded-xl p-2 mb-4">
            <StaffDisplay
              progression={context.progression}
              completedMoves={completedMoves}
              currentMeasure={currentMeasure}
              onMeasureClick={handleMeasureClick}
              highlightErrors={filteredErrorTypes.length === 0 || filteredErrorTypes.length > 0}
            />
          </div>

          {activeEvent && activeEvent.type === 'error' && activeEvent.data?.error && (
            <div
              className={cn(
                'p-4 rounded-xl border-2 animate-pulse',
                getErrorTypeBg(activeEvent.data.error.type)
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getErrorTypeIcon(activeEvent.data.error.type)}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ErrorTypeBadge type={activeEvent.data.error.type} />
                    <span className="text-sm text-jazz-textMuted">
                      第 {activeEvent.measure} 小节第 {activeEvent.beat} 拍
                    </span>
                  </div>
                  <p className="text-jazz-text font-medium">
                    {activeEvent.data.error.description}
                  </p>
                  <p className="text-sm text-jazz-textMuted mt-1">
                    建议: {activeEvent.data.error.suggestion}
                  </p>
                </div>
                <Badge variant="error">-{activeEvent.data.error.deduction} 分</Badge>
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card glass>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music className="w-5 h-5 text-jazz-gold" />
                    <h3 className="font-display text-lg text-jazz-text">
                      第 {currentMeasure} 小节详情
                    </h3>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => jumpToMeasure(currentMeasure)}
                    className="gap-2"
                  >
                    <Volume2 className="w-4 h-4" />
                    播放此小节
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {currentMove ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-jazz-bgLight">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-xs text-jazz-textMuted mb-1">选择的乐句</div>
                          <div className="font-display text-xl text-jazz-text">
                            {currentMove.phrase.name}
                          </div>
                          <div className="text-sm text-jazz-textMuted mt-1">
                            {currentMove.phrase.notes.length} 个音符 · 总时长{' '}
                            {currentMove.phrase.totalDuration} 拍
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex gap-3">
                            <div>
                              <div className="text-xs text-jazz-textMuted">和弦得分</div>
                              <div className="font-display text-2xl font-bold text-jazz-greenLight">
                                {currentMove.chordScore}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-jazz-textMuted">节拍得分</div>
                              <div className="font-display text-2xl font-bold text-blue-400">
                                {currentMove.rhythmScore}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {currentMove.phrase.notes.map((note, idx) => (
                          <div
                            key={idx}
                            className="w-10 h-10 rounded-lg bg-jazz-bg flex items-center justify-center font-mono text-jazz-gold"
                            title={`${note.pitch}${note.accidental !== 'natural' ? note.accidental : ''} - ${note.duration}拍`}
                          >
                            {note.pitch}
                            {note.accidental !== 'natural' && note.accidental}
                          </div>
                        ))}
                      </div>
                    </div>

                    {currentErrors.length > 0 ? (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <XCircle className="w-4 h-4 text-jazz-burgundy" />
                          <span className="text-sm font-medium text-jazz-text">本小节错误</span>
                        </div>
                        <div className="space-y-3">
                          {currentErrors.map((error) => (
                            <div
                              key={error.id}
                              className={cn(
                                'p-3 rounded-lg border',
                                getErrorTypeBg(error.type)
                              )}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <ErrorTypeBadge type={error.type} />
                                  <span className="text-xs text-jazz-textMuted">
                                    第 {error.beat} 拍
                                  </span>
                                </div>
                                <Badge variant="error" className="text-xs">
                                  -{error.deduction} 分
                                </Badge>
                              </div>
                              <p className="text-sm text-jazz-text mb-1">{error.description}</p>
                              <p className="text-xs text-jazz-textMuted flex items-start gap-1">
                                <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-jazz-gold" />
                                {error.suggestion}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-jazz-green/10 border border-jazz-green/30 text-center">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-jazz-greenLight" />
                        <p className="text-jazz-greenLight font-medium">本小节没有错误</p>
                        <p className="text-sm text-jazz-textMuted mt-1">很好，继续保持！</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-jazz-textMuted">
                    <Music className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>第 {currentMeasure} 小节尚未完成</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card glass>
              <CardHeader className="pb-3">
                <h3 className="font-display text-lg text-jazz-text">小节导航</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: context.progression.totalMeasures }, (_, i) => i + 1).map(
                    (measure) => {
                      const move = session.moves.find((m) => m.measureNumber === measure);
                      const hasErrors = move && move.errors.some((e) => e.deduction > 0);
                      const isActive = measure === currentMeasure;

                      return (
                        <button
                          key={measure}
                          onClick={() => jumpToMeasure(measure)}
                          className={cn(
                            'aspect-square rounded-lg flex flex-col items-center justify-center transition-all',
                            isActive
                              ? 'bg-jazz-gold text-jazz-bg ring-2 ring-jazz-gold ring-offset-2 ring-offset-jazz-bg'
                              : move
                              ? hasErrors
                                ? 'bg-jazz-burgundy/20 text-jazz-burgundy hover:bg-jazz-burgundy/30'
                                : 'bg-jazz-green/20 text-jazz-greenLight hover:bg-jazz-green/30'
                              : 'bg-jazz-bgLight text-jazz-textMuted hover:bg-jazz-border/50'
                          )}
                        >
                          <span className="font-display text-lg font-bold">{measure}</span>
                          {move && (
                            <span className="text-xs">
                              {hasErrors ? '✗' : '✓'}
                            </span>
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </CardContent>
            </Card>

            <Card glass>
              <CardHeader className="pb-3">
                <h3 className="font-display text-lg text-jazz-text">错误类型图例</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-jazz-orange/5 border border-jazz-orange/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">⚠️</span>
                    <ErrorTypeBadge type="data" />
                  </div>
                  <p className="text-xs text-jazz-textMuted">
                    数据问题：和弦外音、音高识别等，可能存在识别偏差
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-jazz-burgundy/5 border border-jazz-burgundy/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🚫</span>
                    <ErrorTypeBadge type="rule" />
                  </div>
                  <p className="text-xs text-jazz-textMuted">
                    规则问题：小节超拍、节拍错位等，明确违反规则
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">📦</span>
                    <ErrorTypeBadge type="material" />
                  </div>
                  <p className="text-xs text-jazz-textMuted">
                    材料问题：重复乐句、兼容性等，与材料库相关
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card glass>
              <CardHeader className="pb-3">
                <h3 className="font-display text-lg text-jazz-text">相关链接</h3>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/results/${session.id}`)}
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    查看完整报告
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/lobby')}
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    返回游戏大厅
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Playback;

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileJson,
  FileSpreadsheet,
  FileText,
  Music,
  Trophy,
  Lightbulb,
  Target,
  Clock,
  Users,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, GradeBadge, ErrorTypeBadge } from '@/components/ui/Badge';
import { useGameStore, initializeGameData } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useMaterialStore, initializeMaterialData } from '@/store/useMaterialStore';
import { createGameContext, getErrorTypeSummary, getGradeColor, getGradeBg } from '@/engine/gameEngine';
import { getChordAtMeasure } from '@/data/progressions';
import { getChordById } from '@/data/chords';
import { exportSession, type ExportFormat } from '@/utils/export';
import { cn } from '@/lib/utils';
import type { GameSession, ErrorDetail, Score } from '@/types/music';
import type { GameContext } from '@/engine/gameEngine';

const Results: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { role, teacher } = useUserStore();
  const { sessions, games, getSessionById, updateSession, loadGames, loadSessions } = useGameStore();
  const { loadMaterials } = useMaterialStore();

  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

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

  const score = session?.score;

  const errorSummary = useMemo(() => {
    if (!score) return null;
    return getErrorTypeSummary(score.errors);
  }, [score]);

  const totalDeduction = useMemo(() => {
    if (!score) return 0;
    return score.errors.reduce((sum, e) => sum + e.deduction, 0);
  }, [score]);

  const handleExport = async (format: ExportFormat) => {
    if (!session || !context) return;
    setIsExporting(format);
    try {
      await exportSession(session, context, format);
    } finally {
      setIsExporting(null);
      setShowExportMenu(false);
    }
  };

  const handleConfirm = () => {
    if (!session || !teacher) return;
    const updated: GameSession = {
      ...session,
      confirmed: true,
      confirmedBy: teacher.name,
      confirmedAt: Date.now(),
    };
    updateSession(updated);
  };

  const handlePlayback = () => {
    if (!session) return;
    navigate(`/playback/${session.id}`);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeductionIcon = (type: string) => {
    switch (type) {
      case 'data':
        return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'rule':
        return <XCircle className="w-3.5 h-3.5" />;
      case 'material':
        return <AlertTriangle className="w-3.5 h-3.5" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5" />;
    }
  };

  if (!session || !score || !game || !context) {
    return (
      <div className="min-h-screen bg-jazz-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-jazz-gold/20 flex items-center justify-center animate-pulse">
            <Music className="w-8 h-8 text-jazz-gold" />
          </div>
          <p className="text-jazz-textMuted">加载报告中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jazz-bg">
      <header className="glass border-b border-jazz-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/lobby')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回大厅
              </Button>
              <div>
                <h1 className="font-display text-xl font-bold text-jazz-gold">成绩报告</h1>
                <p className="text-xs text-jazz-textMuted">
                  {session.studentName} · {game.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={handlePlayback} className="gap-2">
                <Play className="w-4 h-4" />
                错误回放
              </Button>

              <div className="relative">
                <Button
                  variant="brass"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  导出报告
                </Button>

                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 glass rounded-xl border border-jazz-border overflow-hidden shadow-xl z-50">
                    <button
                      onClick={() => handleExport('pdf')}
                      disabled={isExporting === 'pdf'}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-jazz-bgLight transition-colors text-left"
                    >
                      <FileText className="w-4 h-4 text-jazz-gold" />
                      <div>
                        <div className="text-sm text-jazz-text">PDF 报告</div>
                        <div className="text-xs text-jazz-textMuted">完整格式，适合打印</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      disabled={isExporting === 'csv'}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-jazz-bgLight transition-colors text-left border-t border-jazz-border/50"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-jazz-green" />
                      <div>
                        <div className="text-sm text-jazz-text">CSV 表格</div>
                        <div className="text-xs text-jazz-textMuted">数据统计，适合分析</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      disabled={isExporting === 'json'}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-jazz-bgLight transition-colors text-left border-t border-jazz-border/50"
                    >
                      <FileJson className="w-4 h-4 text-blue-400" />
                      <div>
                        <div className="text-sm text-jazz-text">JSON 数据</div>
                        <div className="text-xs text-jazz-textMuted">原始数据，适合备份</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {role === 'teacher' && !session.confirmed && (
                <Button variant="primary" onClick={handleConfirm} className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  确认成绩
                </Button>
              )}

              {session.confirmed && (
                <Badge variant="success" className="gap-1 px-3 py-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  已确认 · {session.confirmedBy}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card glass className="overflow-hidden">
              <div className={cn('p-8 text-center', getGradeBg(score.grade), 'text-white')}>
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-80" />
                <div className="font-display text-7xl font-bold mb-2">{score.totalScore}</div>
                <div className="text-2xl font-semibold mb-1">等级 {score.grade}</div>
                <div className="text-sm opacity-80">
                  {score.grade === 'S' && '完美表现！继续保持'}
                  {score.grade === 'A' && '优秀！还有提升空间'}
                  {score.grade === 'B' && '良好，继续努力'}
                  {score.grade === 'C' && '及格，需要加强练习'}
                  {score.grade === 'D' && '需要重点改进'}
                  {score.grade === 'F' && '需要重新练习'}
                </div>
              </div>

              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-xl bg-jazz-green/10">
                    <Target className="w-6 h-6 mx-auto mb-2 text-jazz-greenLight" />
                    <div className="font-display text-3xl font-bold text-jazz-greenLight">
                      {score.chordScore}
                    </div>
                    <div className="text-sm text-jazz-textMuted">和弦得分</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-blue-500/10">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                    <div className="font-display text-3xl font-bold text-blue-400">
                      {score.rhythmScore}
                    </div>
                    <div className="text-sm text-jazz-textMuted">节拍得分</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-jazz-burgundy/10">
                    <XCircle className="w-6 h-6 mx-auto mb-2 text-jazz-burgundyLight" />
                    <div className="font-display text-3xl font-bold text-jazz-burgundyLight">
                      -{totalDeduction}
                    </div>
                    <div className="text-sm text-jazz-textMuted">总扣分</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {errorSummary && (errorSummary.data.count > 0 || errorSummary.rule.count > 0 || errorSummary.material.count > 0) && (
              <Card glass>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-jazz-gold" />
                    <h3 className="font-display text-lg text-jazz-text">错误分类统计</h3>
                  </div>
                  <p className="text-sm text-jazz-textMuted">
                    点击「错误回放」可以逐小节查看错误详情
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border-2 border-jazz-orange/30 bg-jazz-orange/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="warning">数据问题</Badge>
                      </div>
                      <div className="font-display text-2xl font-bold text-jazz-orange mb-1">
                        {errorSummary.data.count} 处
                      </div>
                      <div className="text-sm text-jazz-textMuted">
                        扣 {errorSummary.data.totalDeduction} 分
                      </div>
                      <div className="text-xs text-jazz-textMuted mt-2">
                        和弦外音、音高识别等
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border-2 border-jazz-burgundy/30 bg-jazz-burgundy/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="error">规则问题</Badge>
                      </div>
                      <div className="font-display text-2xl font-bold text-jazz-burgundy mb-1">
                        {errorSummary.rule.count} 处
                      </div>
                      <div className="text-sm text-jazz-textMuted">
                        扣 {errorSummary.rule.totalDeduction} 分
                      </div>
                      <div className="text-xs text-jazz-textMuted mt-2">
                        小节超拍、节拍错位等
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border-2 border-purple-500/30 bg-purple-500/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="info">材料问题</Badge>
                      </div>
                      <div className="font-display text-2xl font-bold text-purple-400 mb-1">
                        {errorSummary.material.count} 处
                      </div>
                      <div className="text-sm text-jazz-textMuted">
                        扣 {errorSummary.material.totalDeduction} 分
                      </div>
                      <div className="text-xs text-jazz-textMuted mt-2">
                        重复乐句、兼容性等
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {score.errors.length > 0 && score.errors.some((e) => e.deduction > 0) && (
              <Card glass>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-jazz-burgundy" />
                    <h3 className="font-display text-lg text-jazz-text">扣分详情</h3>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {score.errors
                      .filter((e) => e.deduction > 0)
                      .map((error: ErrorDetail) => (
                        <div
                          key={error.id}
                          className="p-3 rounded-lg bg-jazz-bgLight border border-jazz-border/50 hover:border-jazz-border transition-colors"
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <ErrorTypeBadge type={error.type} className="gap-1" />
                              <span className="text-sm text-jazz-textMuted">
                                第 {error.measure} 小节第 {error.beat} 拍
                              </span>
                            </div>
                            <span className="text-sm font-medium text-jazz-burgundyLight">
                              -{error.deduction} 分
                            </span>
                          </div>
                          <p className="text-sm text-jazz-text mb-1">{error.description}</p>
                          <p className="text-xs text-jazz-textMuted flex items-start gap-1">
                            <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-jazz-gold" />
                            {error.suggestion}
                          </p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card glass>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-jazz-gold" />
                  <h3 className="font-display text-lg text-jazz-text">关键选择</h3>
                </div>
                <p className="text-sm text-jazz-textMuted">
                  每个小节的乐句选择分析
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {score.keyDecisions.map((decision, index) => {
                    const chordId = getChordAtMeasure(context.progression, decision.measure);
                    const chord = chordId ? getChordById(chordId) : null;
                    const move = session.moves.find((m) => m.measureNumber === decision.measure);

                    return (
                      <div
                        key={index}
                        className={cn(
                          'p-4 rounded-xl border transition-all',
                          decision.isCorrect
                            ? 'bg-jazz-green/5 border-jazz-green/30'
                            : 'bg-jazz-burgundy/5 border-jazz-burgundy/30'
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-jazz-gold/20 flex items-center justify-center flex-shrink-0">
                              <span className="font-display text-lg font-bold text-jazz-gold">
                                {decision.measure}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {decision.isCorrect ? (
                                  <CheckCircle className="w-4 h-4 text-jazz-green" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-jazz-burgundy" />
                                )}
                                <span className="font-medium text-jazz-text">
                                  {decision.choice}
                                </span>
                              </div>
                              <p className="text-sm text-jazz-textMuted">{decision.explanation}</p>
                            </div>
                          </div>

                          {move && (
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm">
                                <span className="text-jazz-greenLight">和 {move.chordScore}</span>
                                <span className="text-jazz-textMuted mx-1">/</span>
                                <span className="text-blue-400">节 {move.rhythmScore}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {move && move.errors.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-jazz-border/30 flex flex-wrap gap-1">
                            {move.errors
                              .filter((e) => e.deduction > 0)
                              .slice(0, 3)
                              .map((error) => (
                                <div
                                  key={error.id}
                                  className={cn(
                                    'text-xs px-2 py-1 rounded flex items-center gap-1',
                                    error.type === 'data' && 'bg-jazz-orange/10 text-jazz-orange',
                                    error.type === 'rule' && 'bg-jazz-burgundy/10 text-jazz-burgundy',
                                    error.type === 'material' && 'bg-purple-500/10 text-purple-400'
                                  )}
                                >
                                  {getDeductionIcon(error.type)}
                                  {error.description.slice(0, 20)}...
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {score.suggestions.length > 0 && (
              <Card glass>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-jazz-gold" />
                    <h3 className="font-display text-lg text-jazz-text">改进建议</h3>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {score.suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-lg bg-jazz-gold/5 border border-jazz-gold/20"
                      >
                        <div className="w-6 h-6 rounded-full bg-jazz-gold flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-jazz-bg">{index + 1}</span>
                        </div>
                        <p className="text-sm text-jazz-text">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card glass>
              <CardHeader className="pb-3">
                <h3 className="font-display text-lg text-jazz-text">基本信息</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-jazz-gold" />
                  <div>
                    <div className="text-xs text-jazz-textMuted">学生</div>
                    <div className="text-jazz-text">{session.studentName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Music className="w-5 h-5 text-jazz-gold" />
                  <div>
                    <div className="text-xs text-jazz-textMuted">游戏</div>
                    <div className="text-jazz-text">{game.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-jazz-gold" />
                  <div>
                    <div className="text-xs text-jazz-textMuted">开始时间</div>
                    <div className="text-jazz-text">{formatTime(session.startTime)}</div>
                  </div>
                </div>
                {session.endTime && (
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-jazz-gold" />
                    <div>
                      <div className="text-xs text-jazz-textMuted">完成时间</div>
                      <div className="text-jazz-text">{formatTime(session.endTime)}</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-jazz-gold" />
                  <div>
                    <div className="text-xs text-jazz-textMuted">和弦进行</div>
                    <div className="text-jazz-text">{context.progression.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-jazz-gold" />
                  <div>
                    <div className="text-xs text-jazz-textMuted">节奏</div>
                    <div className="text-jazz-text">
                      {context.rhythm.timeSignature[0]}/{context.rhythm.timeSignature[1]} @ {context.rhythm.bpm} BPM
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card glass>
              <CardHeader className="pb-3">
                <h3 className="font-display text-lg text-jazz-text">快速操作</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="secondary"
                  onClick={handlePlayback}
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    错误回放
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => navigate('/lobby')}
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    返回游戏大厅
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            <Card glass>
              <CardHeader className="pb-3">
                <h3 className="font-display text-lg text-jazz-text">错误类型说明</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-jazz-orange/5 border border-jazz-orange/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="warning">数据问题</Badge>
                  </div>
                  <p className="text-xs text-jazz-textMuted">
                    音高识别或和弦外音问题，可能存在识别偏差，建议结合听觉判断
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-jazz-burgundy/5 border border-jazz-burgundy/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="error">规则问题</Badge>
                  </div>
                  <p className="text-xs text-jazz-textMuted">
                    违反节拍或时值规则，检查音符时值和小节容量
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="info">材料问题</Badge>
                  </div>
                  <p className="text-xs text-jazz-textMuted">
                    乐句库材料不足或重复，建议扩充材料库或标注更准确的兼容和弦
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Results;

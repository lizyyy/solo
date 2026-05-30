import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Music,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Download,
  Settings,
  Plus,
  Eye,
  FileText,
  Package,
  AlertTriangle,
  ChevronRight,
  Trophy,
  Target,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, GradeBadge } from '@/components/ui/Badge';
import { useGameStore, initializeGameData } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useMaterialStore, initializeMaterialData } from '@/store/useMaterialStore';
import { SAMPLE_CLASS } from '@/data/sample';
import { getErrorTypeSummary, getGradeColor } from '@/engine/gameEngine';
import { exportClassReport } from '@/utils/export';
import { cn } from '@/lib/utils';
import type { GameSession, Game } from '@/types/music';

const TeacherConsole: React.FC = () => {
  const navigate = useNavigate();
  const { role, teacher, classId, logout } = useUserStore();
  const { sessions, games, loadGames, loadSessions, getSessionsByGame, getSessionsByStudent, updateSession } = useGameStore();
  const { loadMaterials } = useMaterialStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'games' | 'students' | 'pending'>('overview');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (role !== 'teacher') {
      navigate('/');
      return;
    }
    initializeGameData();
    initializeMaterialData();
    loadGames();
    loadSessions();
    loadMaterials();
  }, [role, navigate, loadGames, loadSessions, loadMaterials]);

  const classGames = useMemo(() => {
    return games.filter((g) => g.classId === classId);
  }, [games, classId]);

  const classStudents = useMemo(() => {
    return SAMPLE_CLASS.students;
  }, []);

  const completedSessions = useMemo(() => {
    return sessions.filter((s) => s.score && s.gameId && classGames.some((g) => g.id === s.gameId));
  }, [sessions, classGames]);

  const pendingSessions = useMemo(() => {
    return completedSessions.filter((s) => !s.confirmed);
  }, [completedSessions]);

  const stats = useMemo(() => {
    const totalStudents = classStudents.length;
    const totalGames = classGames.length;
    const totalCompleted = completedSessions.length;
    const pendingCount = pendingSessions.length;

    const avgScore =
      completedSessions.length > 0
        ? Math.round(completedSessions.reduce((sum, s) => sum + (s.score?.totalScore || 0), 0) / completedSessions.length)
        : 0;

    const gradeDistribution = {
      S: 0,
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      F: 0,
    };

    completedSessions.forEach((s) => {
      if (s.score?.grade) {
        gradeDistribution[s.score.grade]++;
      }
    });

    return {
      totalStudents,
      totalGames,
      totalCompleted,
      pendingCount,
      avgScore,
      gradeDistribution,
    };
  }, [classStudents, classGames, completedSessions, pendingSessions]);

  const getStudentProgress = (studentId: string) => {
    const studentSessions = getSessionsByStudent(studentId);
    const completed = studentSessions.filter((s) => s.score).length;
    const total = classGames.length;
    const avgScore =
      studentSessions.filter((s) => s.score).length > 0
        ? Math.round(
            studentSessions
              .filter((s) => s.score)
              .reduce((sum, s) => sum + (s.score?.totalScore || 0), 0) / studentSessions.filter((s) => s.score).length
          )
        : 0;

    return { completed, total, avgScore, sessions: studentSessions };
  };

  const getGameProgress = (game: Game) => {
    const gameSessions = getSessionsByGame(game.id);
    const completed = gameSessions.filter((s) => s.score).length;
    const total = classStudents.length;
    const avgScore =
      gameSessions.filter((s) => s.score).length > 0
        ? Math.round(
            gameSessions
              .filter((s) => s.score)
              .reduce((sum, s) => sum + (s.score?.totalScore || 0), 0) / gameSessions.filter((s) => s.score).length
          )
        : 0;

    return { completed, total, avgScore, sessions: gameSessions };
  };

  const handleExportClassReport = () => {
    setIsExporting(true);
    try {
      exportClassReport(completedSessions, SAMPLE_CLASS.name);
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmSession = (session: GameSession) => {
    if (!teacher) return;
    const updated: GameSession = {
      ...session,
      confirmed: true,
      confirmedBy: teacher.name,
      confirmedAt: Date.now(),
    };
    updateSession(updated);
  };

  const handleViewSession = (sessionId: string) => {
    navigate(`/results/${sessionId}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOverdue = (game: Game) => {
    return game.dueDate && game.dueDate < Date.now();
  };

  if (role !== 'teacher') return null;

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
                <h1 className="font-display text-xl font-bold text-jazz-gold">教师控制台</h1>
                <p className="text-xs text-jazz-textMuted">
                  {SAMPLE_CLASS.name} · {teacher?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleExportClassReport}
                disabled={isExporting || completedSessions.length === 0}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                {isExporting ? '导出中...' : '导出班级报告'}
              </Button>
              <Button variant="ghost" onClick={logout} className="gap-2">
                <XCircle className="w-4 h-4" />
                退出
              </Button>
            </div>
          </div>

          <div className="flex gap-1 mt-4 bg-jazz-bgLight p-1 rounded-xl w-fit">
            {([
              { key: 'overview', label: '概览', icon: BarChart3 },
              { key: 'games', label: '游戏管理', icon: Music },
              { key: 'students', label: '学生进度', icon: Users },
              { key: 'pending', label: '待确认', icon: Clock },
            ] as const).map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === item.key
                    ? 'bg-jazz-gold text-jazz-bg'
                    : 'text-jazz-textMuted hover:text-jazz-text'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.key === 'pending' && pendingSessions.length > 0 && (
                  <Badge variant="error" className="ml-1">
                    {pendingSessions.length}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card glass className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-jazz-gold/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-jazz-gold" />
                  </div>
                  <span className="text-sm text-jazz-textMuted">学生人数</span>
                </div>
                <div className="font-display text-3xl font-bold text-jazz-text">
                  {stats.totalStudents}
                </div>
              </Card>

              <Card glass className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Music className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-sm text-jazz-textMuted">游戏数量</span>
                </div>
                <div className="font-display text-3xl font-bold text-jazz-text">
                  {stats.totalGames}
                </div>
              </Card>

              <Card glass className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-jazz-green/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-jazz-greenLight" />
                  </div>
                  <span className="text-sm text-jazz-textMuted">平均分</span>
                </div>
                <div className="font-display text-3xl font-bold text-jazz-greenLight">
                  {stats.avgScore}
                </div>
              </Card>

              <Card glass className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-jazz-burgundy/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-jazz-burgundyLight" />
                  </div>
                  <span className="text-sm text-jazz-textMuted">待确认</span>
                </div>
                <div className="font-display text-3xl font-bold text-jazz-burgundyLight">
                  {stats.pendingCount}
                </div>
              </Card>
            </div>

            <Card glass>
              <CardHeader className="pb-3">
                <h3 className="font-display text-lg text-jazz-text">等级分布</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-3">
                  {(['S', 'A', 'B', 'C', 'D', 'F'] as const).map((grade) => (
                    <div
                      key={grade}
                      className="text-center p-4 rounded-xl bg-jazz-bgLight border border-jazz-border/50"
                    >
                      <div className={cn('font-display text-4xl font-bold mb-1', getGradeColor(grade))}>
                        {grade}
                      </div>
                      <div className="text-2xl font-bold text-jazz-text">
                        {stats.gradeDistribution[grade]}
                      </div>
                      <div className="text-xs text-jazz-textMuted">
                        {stats.totalCompleted > 0
                          ? Math.round((stats.gradeDistribution[grade] / stats.totalCompleted) * 100)
                          : 0}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card glass>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg text-jazz-text">游戏进度</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab('games')}
                      className="gap-1"
                    >
                      查看全部 <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {classGames.slice(0, 3).map((game) => {
                      const progress = getGameProgress(game);
                      const percentage = (progress.completed / progress.total) * 100;

                      return (
                        <div key={game.id} className="p-3 rounded-lg bg-jazz-bgLight">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-jazz-text text-sm">
                              {game.name}
                            </span>
                            <span className="text-xs text-jazz-textMuted">
                              {progress.completed}/{progress.total}
                            </span>
                          </div>
                          <div className="h-2 bg-jazz-bg rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-jazz-gold to-jazz-goldLight transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card glass>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg text-jazz-text">快捷操作</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="secondary"
                    onClick={() => navigate('/reports')}
                    className="w-full justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      报告中心
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate('/materials')}
                    className="w-full justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      材料库管理
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate('/sample-guide')}
                    className="w-full justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      样例引导
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'games' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-jazz-text">游戏管理</h2>
              <Button variant="brass" className="gap-2" disabled>
                <Plus className="w-4 h-4" />
                创建游戏
              </Button>
            </div>

            <div className="space-y-4">
              {classGames.map((game) => {
                const progress = getGameProgress(game);
                const percentage = (progress.completed / progress.total) * 100;
                const overdue = isOverdue(game);

                return (
                  <Card key={game.id} glass hover>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-display text-lg text-jazz-text">{game.name}</h3>
                            {overdue && (
                              <Badge variant="error">已过期</Badge>
                            )}
                            {!overdue && game.dueDate && (
                              <Badge variant="info">
                                截止 {formatDate(game.dueDate)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-jazz-textMuted mb-4">{game.description}</p>

                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                              <div className="text-xs text-jazz-textMuted mb-1">完成进度</div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-jazz-bg rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-jazz-gold transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-sm text-jazz-text font-medium">
                                  {Math.round(percentage)}%
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-jazz-textMuted mb-1">平均分</div>
                              <div className="text-xl font-bold text-jazz-greenLight">
                                {progress.avgScore}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-jazz-textMuted mb-1">已完成/总数</div>
                              <div className="text-xl font-bold text-jazz-text">
                                {progress.completed}/{progress.total}
                              </div>
                            </div>
                          </div>

                          {progress.sessions.filter((s) => s.score).length > 0 && (
                            <div>
                              <div className="text-xs text-jazz-textMuted mb-2">学生成绩</div>
                              <div className="flex flex-wrap gap-2">
                                {progress.sessions
                                  .filter((s) => s.score)
                                  .map((session) => (
                                    <button
                                      key={session.id}
                                      onClick={() => handleViewSession(session.id)}
                                      className="px-3 py-1 rounded-lg bg-jazz-bgLight hover:bg-jazz-border/50 transition-colors"
                                    >
                                      <span className="text-sm text-jazz-text mr-2">
                                        {session.studentName}
                                      </span>
                                      <GradeBadge grade={session.score!.grade} />
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/reports')}
                            className="gap-1"
                          >
                            <BarChart3 className="w-4 h-4" />
                            查看报告
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold text-jazz-text">学生进度</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classStudents.map((student) => {
                const progress = getStudentProgress(student.id);
                const percentage = (progress.completed / progress.total) * 100;

                return (
                  <Card key={student.id} glass hover>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-jazz-gold/20 flex items-center justify-center">
                          <span className="font-display text-xl font-bold text-jazz-gold">
                            {student.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-display text-lg text-jazz-text">{student.name}</h3>
                          <p className="text-sm text-jazz-textMuted">
                            完成 {progress.completed}/{progress.total} 个游戏
                          </p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-jazz-textMuted">完成进度</span>
                          <span className="text-sm font-medium text-jazz-gold">
                            {Math.round(percentage)}%
                          </span>
                        </div>
                        <div className="h-2 bg-jazz-bg rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-jazz-gold to-jazz-goldLight transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>

                      {progress.avgScore > 0 && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-jazz-bgLight mb-4">
                          <div className="text-sm text-jazz-textMuted">平均分</div>
                          <div className="font-display text-2xl font-bold text-jazz-greenLight">
                            {progress.avgScore}
                          </div>
                        </div>
                      )}

                      {progress.sessions.filter((s) => s.score).length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs text-jazz-textMuted">已完成游戏</div>
                          {progress.sessions
                            .filter((s) => s.score)
                            .map((session) => {
                              const game = classGames.find((g) => g.id === session.gameId);
                              return (
                                <button
                                  key={session.id}
                                  onClick={() => handleViewSession(session.id)}
                                  className="w-full flex items-center justify-between p-2 rounded-lg bg-jazz-bg hover:bg-jazz-border/30 transition-colors text-left"
                                >
                                  <span className="text-sm text-jazz-text truncate">
                                    {game?.name || session.gameId}
                                  </span>
                                  <GradeBadge grade={session.score!.grade} />
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-bold text-jazz-text">待确认成绩</h2>
              {pendingSessions.length > 0 && (
                <Badge variant="error">{pendingSessions.length}</Badge>
              )}
            </div>

            {pendingSessions.length === 0 ? (
              <Card glass className="p-12 text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-jazz-greenLight opacity-50" />
                <h3 className="font-display text-xl text-jazz-text mb-2">暂无待确认成绩</h3>
                <p className="text-jazz-textMuted">所有学生成绩都已确认</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingSessions.map((session) => {
                  const game = classGames.find((g) => g.id === session.gameId);
                  const errorSummary = session.score ? getErrorTypeSummary(session.score.errors) : null;

                  return (
                    <Card key={session.id} glass hover>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-display text-lg text-jazz-text">
                                {session.studentName}
                              </h3>
                              <Badge variant="warning">待确认</Badge>
                              {game && (
                                <span className="text-sm text-jazz-textMuted">
                                  · {game.name}
                                </span>
                              )}
                            </div>

                            <div className="text-sm text-jazz-textMuted mb-4">
                              提交时间: {formatDate(session.endTime || session.startTime)}
                            </div>

                            <div className="grid grid-cols-4 gap-4 mb-4">
                              <div className="text-center p-3 rounded-lg bg-jazz-gold/10">
                                <div className="font-display text-2xl font-bold text-jazz-gold">
                                  {session.score?.totalScore}
                                </div>
                                <div className="text-xs text-jazz-textMuted">总分</div>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-jazz-green/10">
                                <GradeBadge grade={session.score!.grade} large />
                                <div className="text-xs text-jazz-textMuted mt-1">等级</div>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-jazz-green/10">
                                <div className="font-display text-2xl font-bold text-jazz-greenLight">
                                  {session.score?.chordScore}
                                </div>
                                <div className="text-xs text-jazz-textMuted">和弦</div>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-blue-500/10">
                                <div className="font-display text-2xl font-bold text-blue-400">
                                  {session.score?.rhythmScore}
                                </div>
                                <div className="text-xs text-jazz-textMuted">节拍</div>
                              </div>
                            </div>

                            {errorSummary && (
                              <div className="flex gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <Badge variant="warning">数据</Badge>
                                  <span className="text-jazz-textMuted">
                                    {errorSummary.data.count}处，扣{errorSummary.data.totalDeduction}分
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge variant="error">规则</Badge>
                                  <span className="text-jazz-textMuted">
                                    {errorSummary.rule.count}处，扣{errorSummary.rule.totalDeduction}分
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Badge variant="info">材料</Badge>
                                  <span className="text-jazz-textMuted">
                                    {errorSummary.material.count}处，扣{errorSummary.material.totalDeduction}分
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 ml-4">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleConfirmSession(session)}
                              className="gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              确认
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewSession(session.id)}
                              className="gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              查看详情
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default TeacherConsole;

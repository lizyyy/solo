import React, { useEffect, useState } from 'react';
import { Play, Clock, Users, CheckCircle2, XCircle, Music, LogOut, ChevronRight, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useGameStore, initializeGameData } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useMaterialStore, initializeMaterialData } from '@/store/useMaterialStore';
import type { Game } from '@/types/music';
import { cn } from '@/lib/utils';

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { role, student, teacher, classId, logout } = useUserStore();
  const { games, sessions, startGame, loadGames, loadSessions } = useGameStore();
  const { loadMaterials } = useMaterialStore();
  
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

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

  const classGames = games.filter((g) => g.classId === classId);

  const filteredGames = classGames.filter((game) => {
    const hasCompleted = sessions.some(
      (s) => s.gameId === game.id && s.studentId === student?.id && s.score
    );
    if (filter === 'completed') return hasCompleted;
    if (filter === 'pending') return !hasCompleted;
    return true;
  });

  const getGameStatus = (game: Game) => {
    const userSession = sessions.find(
      (s) => s.gameId === game.id && s.studentId === student?.id
    );
    if (userSession?.score) {
      return { status: 'completed', score: userSession.score, confirmed: userSession.confirmed };
    }
    if (userSession) {
      return { status: 'in_progress', score: null, confirmed: false };
    }
    return { status: 'pending', score: null, confirmed: false };
  };

  const handleStartGame = (gameId: string) => {
    if (!student) return;
    startGame(gameId, student.id, student.name);
    navigate(`/game/${gameId}`);
  };

  const handleContinueGame = (gameId: string) => {
    navigate(`/game/${gameId}`);
  };

  const handleViewResults = (sessionId: string) => {
    navigate(`/results/${sessionId}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (game: Game) => {
    return game.dueDate && game.dueDate < Date.now();
  };

  if (!role) return null;

  return (
    <div className="min-h-screen bg-jazz-bg">
      <header className="glass border-b border-jazz-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-jazz-gold to-jazz-goldDark flex items-center justify-center">
              <Music className="w-5 h-5 text-jazz-bg" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-jazz-gold">爵士即兴接龙局</h1>
              <p className="text-xs text-jazz-textMuted">
                {role === 'student' ? `${student?.name} · 学生` : `${teacher?.name} · 教师`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {role === 'teacher' && (
              <Button
                variant="ghost"
                onClick={() => navigate('/console')}
                className="gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                控制台
              </Button>
            )}
            <Button variant="ghost" onClick={logout} className="gap-2">
              <LogOut className="w-4 h-4" />
              退出
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-3xl font-bold text-jazz-text mb-2">
              游戏大厅
            </h2>
            <p className="text-jazz-textMuted">
              选择一个游戏开始练习，或继续未完成的游戏
            </p>
          </div>

          <div className="flex gap-2 bg-jazz-bgLight p-1 rounded-xl">
            {([
              { key: 'all', label: '全部' },
              { key: 'pending', label: '待完成' },
              { key: 'completed', label: '已完成' },
            ] as const).map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  filter === item.key
                    ? 'bg-jazz-gold text-jazz-bg'
                    : 'text-jazz-textMuted hover:text-jazz-text'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {role === 'teacher' && (
          <div className="mb-8">
            <Card glass className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-xl text-jazz-gold mb-1">教师控制台</h3>
                  <p className="text-jazz-textMuted text-sm">
                    管理班级、材料库，查看全班成绩报告
                  </p>
                </div>
                <Button variant="brass" onClick={() => navigate('/console')} className="gap-2">
                  进入控制台 <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGames.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="w-16 h-16 rounded-full bg-jazz-bgLight flex items-center justify-center mx-auto mb-4">
                <Music className="w-8 h-8 text-jazz-textMuted" />
              </div>
              <h3 className="text-xl font-display text-jazz-text mb-2">暂无游戏</h3>
              <p className="text-jazz-textMuted">当前筛选条件下没有可用的游戏</p>
            </div>
          ) : (
            filteredGames.map((game) => {
              const { status, score, confirmed } = getGameStatus(game);
              const overdue = isOverdue(game);

              return (
                <Card
                  key={game.id}
                  glass
                  hover
                  className={cn(
                    'overflow-hidden transition-all',
                    status === 'completed' && 'opacity-90',
                    overdue && status !== 'completed' && 'border-jazz-burgundy/50'
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between mb-2">
                      <Badge
                        variant={
                          status === 'completed'
                            ? 'success'
                            : status === 'in_progress'
                            ? 'warning'
                            : overdue
                            ? 'error'
                            : 'info'
                        }
                        className="text-xs"
                      >
                        {status === 'completed'
                          ? '已完成'
                          : status === 'in_progress'
                          ? '进行中'
                          : overdue
                          ? '已过期'
                          : '待开始'}
                      </Badge>
                      {score && (
                        <div className="flex items-center gap-1">
                          <span className="text-2xl font-display font-bold text-jazz-gold">
                            {score.totalScore}
                          </span>
                          {confirmed && (
                            <CheckCircle2 className="w-4 h-4 text-jazz-green" />
                          )}
                        </div>
                      )}
                    </div>
                    <h3 className="font-display text-lg text-jazz-text">{game.name}</h3>
                    <p className="text-sm text-jazz-textMuted line-clamp-2">
                      {game.description}
                    </p>
                  </CardHeader>

                  <CardContent className="pb-3">
                    <div className="flex items-center gap-4 text-sm text-jazz-textMuted">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatDate(game.createdAt)}</span>
                      </div>
                      {game.dueDate && (
                        <div className="flex items-center gap-1">
                          <XCircle className={cn('w-4 h-4', overdue && 'text-jazz-burgundy')} />
                          <span className={overdue && 'text-jazz-burgundy'}>
                            截止 {formatDate(game.dueDate)}
                          </span>
                        </div>
                      )}
                    </div>

                    {score && (
                      <div className="mt-4 pt-4 border-t border-jazz-border/50">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-2 rounded-lg bg-jazz-green/10">
                            <div className="text-lg font-bold text-jazz-greenLight">
                              {score.chordScore}
                            </div>
                            <div className="text-xs text-jazz-textMuted">和弦得分</div>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-blue-500/10">
                            <div className="text-lg font-bold text-blue-400">
                              {score.rhythmScore}
                            </div>
                            <div className="text-xs text-jazz-textMuted">节拍得分</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-3">
                    {status === 'completed' ? (
                      <Button
                        variant="secondary"
                        onClick={() => score && handleViewResults(sessions.find(s => s.gameId === game.id && s.studentId === student?.id)?.id || '')}
                        className="w-full gap-2"
                      >
                        查看报告 <ChevronRight className="w-4 h-4" />
                      </Button>
                    ) : status === 'in_progress' ? (
                      <Button
                        variant="primary"
                        onClick={() => handleContinueGame(game.id)}
                        className="w-full gap-2"
                      >
                        <Play className="w-4 h-4" />
                        继续游戏
                      </Button>
                    ) : (
                      <Button
                        variant="brass"
                        onClick={() => handleStartGame(game.id)}
                        disabled={overdue}
                        className="w-full gap-2"
                      >
                        <Play className="w-4 h-4" />
                        开始游戏
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
};

export default Lobby;

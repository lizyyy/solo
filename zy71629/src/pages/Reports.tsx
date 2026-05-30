import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Download,
  Filter,
  Search,
  FileText,
  Eye,
  Users,
  Music,
  Trophy,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, GradeBadge } from '@/components/ui/Badge';
import { useGameStore, initializeGameData } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { useMaterialStore, initializeMaterialData } from '@/store/useMaterialStore';
import { SAMPLE_CLASS } from '@/data/sample';
import { getErrorTypeSummary, getGradeColor } from '@/engine/gameEngine';
import { exportClassReport, exportToCSV, downloadCSV } from '@/utils/export';
import { cn } from '@/lib/utils';
import type { GameSession } from '@/types/music';

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { role, classId } = useUserStore();
  const { sessions, games, loadGames, loadSessions, getSessionsByGame } = useGameStore();
  const { loadMaterials } = useMaterialStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

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

  const classGames = useMemo(() => {
    return games.filter((g) => g.classId === classId);
  }, [games, classId]);

  const allSessions = useMemo(() => {
    return sessions.filter(
      (s) => s.score && s.gameId && classGames.some((g) => g.id === s.gameId)
    );
  }, [sessions, classGames]);

  const filteredSessions = useMemo(() => {
    let filtered = allSessions;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((s) => s.studentName.toLowerCase().includes(term));
    }

    if (gameFilter !== 'all') {
      filtered = filtered.filter((s) => s.gameId === gameFilter);
    }

    if (gradeFilter !== 'all') {
      filtered = filtered.filter((s) => s.score?.grade === gradeFilter);
    }

    return filtered.sort((a, b) => {
      if (a.score && b.score) {
        return b.score.totalScore - a.score.totalScore;
      }
      return 0;
    });
  }, [allSessions, searchTerm, gameFilter, gradeFilter]);

  const stats = useMemo(() => {
    const total = allSessions.length;
    const avgScore =
      total > 0
        ? Math.round(allSessions.reduce((sum, s) => sum + (s.score?.totalScore || 0), 0) / total)
        : 0;

    const gradeDistribution = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    let totalErrors = 0;
    let totalDataErrors = 0;
    let totalRuleErrors = 0;
    let totalMaterialErrors = 0;

    allSessions.forEach((s) => {
      if (s.score?.grade) {
        gradeDistribution[s.score.grade]++;
      }
      if (s.score) {
        const summary = getErrorTypeSummary(s.score.errors);
        totalDataErrors += summary.data.count;
        totalRuleErrors += summary.rule.count;
        totalMaterialErrors += summary.material.count;
        totalErrors += summary.data.count + summary.rule.count + summary.material.count;
      }
    });

    return {
      total,
      avgScore,
      gradeDistribution,
      totalErrors,
      totalDataErrors,
      totalRuleErrors,
      totalMaterialErrors,
    };
  }, [allSessions]);

  const handleExportAll = () => {
    setIsExporting(true);
    try {
      exportClassReport(allSessions, SAMPLE_CLASS.name);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFiltered = () => {
    setIsExporting(true);
    try {
      const filename = `${SAMPLE_CLASS.name}_筛选结果_${new Date().toISOString().split('T')[0]}`;
      const data = exportToCSV(filteredSessions);
      downloadCSV(data, filename);
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewSession = (sessionId: string) => {
    navigate(`/results/${sessionId}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (!role) return null;

  return (
    <div className="min-h-screen bg-jazz-bg">
      <header className="glass border-b border-jazz-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/console')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回控制台
              </Button>
              <div>
                <h1 className="font-display text-xl font-bold text-jazz-gold">报告中心</h1>
                <p className="text-xs text-jazz-textMuted">{SAMPLE_CLASS.name} · 成绩报告</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleExportFiltered}
                disabled={isExporting || filteredSessions.length === 0}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                导出筛选结果
              </Button>
              <Button
                variant="brass"
                onClick={handleExportAll}
                disabled={isExporting || allSessions.length === 0}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                导出全部报告
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card glass className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-jazz-gold/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-jazz-gold" />
              </div>
              <span className="text-sm text-jazz-textMuted">总报告数</span>
            </div>
            <div className="font-display text-3xl font-bold text-jazz-text">{stats.total}</div>
          </Card>

          <Card glass className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-jazz-green/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-jazz-greenLight" />
              </div>
              <span className="text-sm text-jazz-textMuted">平均分</span>
            </div>
            <div className="font-display text-3xl font-bold text-jazz-greenLight">{stats.avgScore}</div>
          </Card>

          <Card glass className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-jazz-textMuted">优秀率(A/S)</span>
            </div>
            <div className="font-display text-3xl font-bold text-blue-400">
              {stats.total > 0
                ? Math.round(((stats.gradeDistribution.S + stats.gradeDistribution.A) / stats.total) * 100)
                : 0}%
            </div>
          </Card>

          <Card glass className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-jazz-burgundy/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-jazz-burgundyLight" />
              </div>
              <span className="text-sm text-jazz-textMuted">总错误数</span>
            </div>
            <div className="font-display text-3xl font-bold text-jazz-burgundyLight">{stats.totalErrors}</div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card glass>
            <CardHeader className="pb-3">
              <h3 className="font-display text-lg text-jazz-text">等级分布</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(['S', 'A', 'B', 'C', 'D', 'F'] as const).map((grade) => {
                  const count = stats.gradeDistribution[grade];
                  const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;

                  return (
                    <div key={grade} className="flex items-center gap-3">
                      <GradeBadge grade={grade} large />
                      <div className="flex-1">
                        <div className="h-4 bg-jazz-bg rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full transition-all duration-500',
                              grade === 'S' && 'bg-jazz-gold',
                              grade === 'A' && 'bg-jazz-green',
                              grade === 'B' && 'bg-blue-500',
                              grade === 'C' && 'bg-yellow-500',
                              grade === 'D' && 'bg-jazz-orange',
                              grade === 'F' && 'bg-jazz-burgundy'
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-jazz-text w-12 text-right">{count}人</span>
                      <span className="text-xs text-jazz-textMuted w-10">{Math.round(percentage)}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card glass>
            <CardHeader className="pb-3">
              <h3 className="font-display text-lg text-jazz-text">错误类型统计</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-xl bg-jazz-orange/10 border border-jazz-orange/30">
                  <div className="text-3xl mb-2">⚠️</div>
                  <div className="font-display text-2xl font-bold text-jazz-orange">{stats.totalDataErrors}</div>
                  <div className="text-xs text-jazz-textMuted">数据问题</div>
                  <div className="text-xs text-jazz-textMuted mt-1">和弦外音等</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-jazz-burgundy/10 border border-jazz-burgundy/30">
                  <div className="text-3xl mb-2">🚫</div>
                  <div className="font-display text-2xl font-bold text-jazz-burgundy">{stats.totalRuleErrors}</div>
                  <div className="text-xs text-jazz-textMuted">规则问题</div>
                  <div className="text-xs text-jazz-textMuted mt-1">超拍等</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                  <div className="text-3xl mb-2">📦</div>
                  <div className="font-display text-2xl font-bold text-purple-400">{stats.totalMaterialErrors}</div>
                  <div className="text-xs text-jazz-textMuted">材料问题</div>
                  <div className="text-xs text-jazz-textMuted mt-1">重复乐句等</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card glass>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-display text-lg text-jazz-text">成绩列表</h3>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jazz-textMuted" />
                  <input
                    type="text"
                    placeholder="搜索学生姓名..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-jazz-bgLight border border-jazz-border rounded-lg pl-9 pr-4 py-2 text-sm text-jazz-text placeholder-jazz-textMuted focus:outline-none focus:ring-2 focus:ring-jazz-gold w-48"
                  />
                </div>

                <select
                  value={gameFilter}
                  onChange={(e) => setGameFilter(e.target.value)}
                  className="bg-jazz-bgLight border border-jazz-border rounded-lg px-3 py-2 text-sm text-jazz-text focus:outline-none focus:ring-2 focus:ring-jazz-gold"
                >
                  <option value="all">全部游戏</option>
                  {classGames.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name}
                    </option>
                  ))}
                </select>

                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="bg-jazz-bgLight border border-jazz-border rounded-lg px-3 py-2 text-sm text-jazz-text focus:outline-none focus:ring-2 focus:ring-jazz-gold"
                >
                  <option value="all">全部等级</option>
                  {(['S', 'A', 'B', 'C', 'D', 'F'] as const).map((grade) => (
                    <option key={grade} value={grade}>
                      等级 {grade}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-sm text-jazz-textMuted mt-2">
              共找到 {filteredSessions.length} 条记录
            </p>
          </CardHeader>

          <CardContent>
            {filteredSessions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-jazz-textMuted opacity-30" />
                <p className="text-jazz-textMuted">没有找到符合条件的报告</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-jazz-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-jazz-textMuted">学生</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-jazz-textMuted">游戏</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-jazz-textMuted">总分</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-jazz-textMuted">等级</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-jazz-textMuted">和弦</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-jazz-textMuted">节拍</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-jazz-textMuted">提交时间</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-jazz-textMuted">状态</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-jazz-textMuted">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((session) => {
                      const game = classGames.find((g) => g.id === session.gameId);

                      return (
                        <tr
                          key={session.id}
                          className="border-b border-jazz-border/50 hover:bg-jazz-bgLight/50 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-jazz-gold/20 flex items-center justify-center">
                                <span className="text-sm font-bold text-jazz-gold">
                                  {session.studentName.charAt(0)}
                                </span>
                              </div>
                              <span className="text-jazz-text">{session.studentName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-jazz-text truncate max-w-[200px] block">
                              {game?.name || session.gameId}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-display text-xl font-bold text-jazz-gold">
                              {session.score?.totalScore}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <GradeBadge grade={session.score!.grade} />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-jazz-greenLight">{session.score?.chordScore}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-blue-400">{session.score?.rhythmScore}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-sm text-jazz-textMuted">
                              {formatDate(session.endTime || session.startTime)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {session.confirmed ? (
                              <Badge variant="success" className="gap-1">
                                <CheckCircle className="w-3 h-3" />
                                已确认
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="gap-1">
                                <XCircle className="w-3 h-3" />
                                待确认
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewSession(session.id)}
                              className="gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              查看
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Reports;

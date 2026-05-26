import React from 'react';
import { Trophy, Download, RotateCcw, Home, Play, AlertTriangle, CheckCircle } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { getErrorLabel } from '../game/scoring';
import { useNavigate, useParams } from 'react-router-dom';
import Papa from 'papaparse';

interface RingProps {
  label: string;
  value: number;
  color: string;
}

function Ring({ label, value, color }: RingProps) {
  const v = Math.max(0, Math.min(100, value));
  const bg = `conic-gradient(${color} ${v * 3.6}deg, #e5e7eb 0deg)`;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex h-24 w-24 items-center justify-center rounded-full"
        style={{ background: bg }}
      >
        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-white">
          <span className="text-lg font-bold text-slate-800">{Math.round(v)}%</span>
        </div>
      </div>
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ResultReport() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const currentLevel = useGameStore((s) => s.currentLevel);
  const score = useGameStore((s) => s.score);
  const correctCount = useGameStore((s) => s.correctCount);
  const errorCount = useGameStore((s) => s.errorCount);
  const maxCombo = useGameStore((s) => s.maxCombo);
  const errors = useGameStore((s) => s.errors);
  const getScoreBreakdown = useGameStore((s) => s.getScoreBreakdown);
  const getSession = useGameStore((s) => s.getSession);
  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.resetGame);

  const session = sessionId ? getSession(sessionId) : null;
  const breakdown = getScoreBreakdown();

  const levelName = session?.levelName ?? currentLevel?.name ?? '未知关卡';
  const totalScore = session?.totalScore ?? score;
  const result = session?.result ?? 'lose';
  const targetScore = currentLevel?.targetScore ?? 0;

  const finalErrors = session?.errors ?? errors;
  const finalCorrect = session?.correctCount ?? correctCount;
  const finalErrorCount = session?.errorCount ?? errorCount;
  const finalMaxCombo = session?.maxCombo ?? maxCombo;

  const isWin = result === 'win';

  const handleExportCSV = () => {
    const rows = finalErrors.map((e) => ({
      时间: formatTime(e.gameTime),
      类型: getErrorLabel(e.errorType),
      扣分: e.penaltyScore,
      描述: e.description,
    }));

    const summaryRows = [
      { 时间: '', 类型: '关卡', 扣分: '', 描述: levelName },
      { 时间: '', 类型: '结果', 扣分: '', 描述: isWin ? '胜利' : '失败' },
      { 时间: '', 类型: '总分', 扣分: totalScore, 描述: `目标 ${targetScore}` },
      { 时间: '', 类型: '正确操作', 扣分: finalCorrect, 描述: '' },
      { 时间: '', 类型: '错误操作', 扣分: finalErrorCount, 描述: '' },
      { 时间: '', 类型: '最大连击', 扣分: finalMaxCombo, 描述: '' },
      {},
      { 时间: '时间', 类型: '失误类型', 扣分: '扣分', 描述: '描述' },
    ];

    const csv = Papa.unparse([...summaryRows, ...rows]);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${levelName}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReplay = () => {
    if (sessionId) {
      navigate(`/replay/${sessionId}`);
    }
  };

  const handleRetry = () => {
    const levelId = session?.levelId ?? currentLevel?.id;
    if (levelId) {
      startGame(levelId);
      navigate(`/level/${levelId}`);
    }
  };

  const handleHome = () => {
    resetGame();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isWin ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                <Trophy className={`h-9 w-9 ${isWin ? 'text-emerald-600' : 'text-rose-600'}`} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{levelName}</h1>
                <p className={`text-sm font-medium ${isWin ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isWin ? '挑战成功' : '挑战失败'}
                </p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-slate-500">总分</p>
              <p className={`text-5xl font-extrabold ${isWin ? 'text-emerald-600' : 'text-rose-600'}`}>
                {totalScore}
              </p>
              <p className="mt-1 text-xs text-slate-400">目标 {targetScore} 分</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <h2 className="mb-6 text-lg font-semibold text-slate-800">分项得分</h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Ring label="备餐准确率" value={breakdown.prepAccuracy} color="#3b82f6" />
            <Ring label="取餐及时率" value={breakdown.pickupTimeliness} color="#10b981" />
            <Ring label="过敏规避率" value={breakdown.allergenAvoidance} color="#f59e0b" />
            <Ring label="浪费率" value={breakdown.wasteRatio} color="#ef4444" />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-slate-800">失误分析</h2>
          </div>
          {finalErrors.length === 0 ? (
            <p className="py-8 text-center text-slate-500">没有失误，表现完美！</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2">时间</th>
                    <th className="px-4 py-2">类型</th>
                    <th className="px-4 py-2">扣分</th>
                    <th className="px-4 py-2">描述</th>
                  </tr>
                </thead>
                <tbody>
                  {finalErrors.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-slate-700">{formatTime(e.gameTime)}</td>
                      <td className="px-4 py-2 text-rose-600">{getErrorLabel(e.errorType)}</td>
                      <td className="px-4 py-2 font-semibold text-rose-600">-{e.penaltyScore}</td>
                      <td className="px-4 py-2 text-slate-600">{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-2 flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              <p className="text-sm font-medium">正确操作数</p>
            </div>
            <p className="text-4xl font-bold text-slate-900">{finalCorrect}</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-2 flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm font-medium">错误操作数</p>
            </div>
            <p className="text-4xl font-bold text-slate-900">{finalErrorCount}</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-2 flex items-center gap-2 text-amber-500">
              <Trophy className="h-5 w-5" />
              <p className="text-sm font-medium">最大连击数</p>
            </div>
            <p className="text-4xl font-bold text-slate-900">{finalMaxCombo}</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={handleReplay}
            disabled={!sessionId}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Play className="h-4 w-4" />
            <span>查看回放</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-white shadow-md transition hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            <span>导出报告</span>
          </button>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-white shadow-md transition hover:bg-amber-600"
          >
            <RotateCcw className="h-4 w-4" />
            <span>重新挑战</span>
          </button>
          <button
            onClick={handleHome}
            className="flex items-center gap-2 rounded-xl bg-slate-700 px-6 py-3 text-white shadow-md transition hover:bg-slate-800"
          >
            <Home className="h-4 w-4" />
            <span>返回主菜单</span>
          </button>
        </div>
      </div>
    </div>
  );
}

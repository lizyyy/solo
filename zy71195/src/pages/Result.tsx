import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Star,
  Home,
  RotateCcw,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { exportToJSON, exportToCSV, generateReportText, generateErrorStats } from '../utils/exporter';
import { Modal } from '../components/ui/Modal';
import { getUnlockedLevels } from '../utils/storage';
import { LEVELS } from '../data/levels';

export default function Result() {
  const navigate = useNavigate();
  const { gameState, reset } = useGameStore();
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [unlockedLevels, setUnlockedLevels] = useState<number[]>([]);

  useEffect(() => {
    if (gameState.status !== 'finished') {
      navigate('/');
      return;
    }
    setUnlockedLevels(getUnlockedLevels());
  }, [gameState.status, navigate]);

  const accuracy =
    gameState.processedCount > 0
      ? Math.round((gameState.correctCount / gameState.processedCount) * 100)
      : 0;

  const passed = gameState.score >= gameState.level.passScore;
  const maxScore = gameState.level.vehicleCount * 100;

  const getStars = () => {
    if (!passed) return 0;
    if (gameState.score >= maxScore * 0.9) return 3;
    if (gameState.score >= maxScore * 0.7) return 2;
    return 1;
  };

  const stars = getStars();
  const errorStats = generateErrorStats(gameState.records);
  const hasNewUnlock = passed && unlockedLevels.includes(gameState.level.id + 1);

  const handleExportJSON = () => {
    const history = {
      id: Date.now().toString(),
      levelId: gameState.level.id,
      levelName: gameState.level.name,
      score: gameState.score,
      accuracy,
      totalVehicles: gameState.processedCount,
      correctCount: gameState.correctCount,
      errorCount: gameState.processedCount - gameState.correctCount,
      records: gameState.records,
      startTime: gameState.startTime,
      endTime: Date.now(),
      duration: Date.now() - gameState.startTime,
    };
    exportToJSON(history);
  };

  const handleExportCSV = () => {
    const history = {
      id: Date.now().toString(),
      levelId: gameState.level.id,
      levelName: gameState.level.name,
      score: gameState.score,
      accuracy,
      totalVehicles: gameState.processedCount,
      correctCount: gameState.correctCount,
      errorCount: gameState.processedCount - gameState.correctCount,
      records: gameState.records,
      startTime: gameState.startTime,
      endTime: Date.now(),
      duration: Date.now() - gameState.startTime,
    };
    exportToCSV(history);
  };

  const handleShowReport = () => {
    const history = {
      id: Date.now().toString(),
      levelId: gameState.level.id,
      levelName: gameState.level.name,
      score: gameState.score,
      accuracy,
      totalVehicles: gameState.processedCount,
      correctCount: gameState.correctCount,
      errorCount: gameState.processedCount - gameState.correctCount,
      records: gameState.records,
      startTime: gameState.startTime,
      endTime: Date.now(),
      duration: Date.now() - gameState.startTime,
    };
    setReportText(generateReportText(history));
    setShowReport(true);
  };

  const handleRestart = () => {
    navigate(`/game/${gameState.level.id}`);
  };

  const handleNextLevel = () => {
    if (gameState.level.id < 5) {
      navigate(`/game/${gameState.level.id + 1}`);
    } else {
      navigate('/');
    }
  };

  const handleHome = () => {
    reset();
    navigate('/');
  };

  const errorRecords = gameState.records.filter((r) => !r.isCorrect);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Card className="mb-6">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className={`p-4 rounded-full ${passed ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
                <Trophy
                  className={`w-16 h-16 ${passed ? 'text-yellow-400' : 'text-slate-500'}`}
                />
              </div>
            </div>
            <CardTitle className="text-3xl font-mono mb-2">
              {passed ? '恭喜通关！' : '挑战失败'}
            </CardTitle>
            <p className="text-slate-400">{gameState.level.name}</p>
            {hasNewUnlock && (
              <p className="text-yellow-400 text-sm mt-2">
                🎉 已解锁下一关卡！
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-2 mb-6">
              {Array.from({ length: 3 }, (_, i) => (
                <Star
                  key={i}
                  className={`w-10 h-10 transition-all duration-300 ${
                    i < stars
                      ? 'text-yellow-400 fill-yellow-400 scale-110'
                      : 'text-slate-700'
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">最终得分</p>
                <p
                  className={`text-2xl font-bold font-mono ${
                    gameState.score >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {gameState.score}
                </p>
              </div>
              <div className="bg-slate-800 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">准确率</p>
                <p
                  className={`text-2xl font-bold font-mono ${
                    accuracy >= 80
                      ? 'text-green-400'
                      : accuracy >= 60
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {accuracy}%
                </p>
              </div>
              <div className="bg-slate-800 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">正确数</p>
                <p className="text-2xl font-bold font-mono text-green-400">
                  {gameState.correctCount}
                </p>
              </div>
              <div className="bg-slate-800 p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">错误数</p>
                <p className="text-2xl font-bold font-mono text-red-400">
                  {gameState.processedCount - gameState.correctCount}
                </p>
              </div>
            </div>

            <div className="text-center mb-6">
              <p className="text-sm text-slate-500">
                及格分数：
                <span
                  className={`font-mono font-bold ml-1 ${
                    passed ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {gameState.level.passScore}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="primary" size="lg" onClick={handleRestart}>
                <RotateCcw className="w-5 h-5 mr-2" />
                再来一次
              </Button>
              {passed && gameState.level.id < 5 && (
                <Button variant="success" size="lg" onClick={handleNextLevel}>
                  下一关
                </Button>
              )}
              <Button variant="secondary" size="lg" onClick={handleHome}>
                <Home className="w-5 h-5 mr-2" />
                返回首页
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="w-5 h-5" />
              报告导出
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="md" onClick={handleExportJSON}>
                导出 JSON
              </Button>
              <Button variant="secondary" size="md" onClick={handleExportCSV}>
                导出 CSV
              </Button>
              <Button variant="secondary" size="md" onClick={handleShowReport}>
                <FileText className="w-4 h-4 mr-2" />
                查看报告
              </Button>
            </div>
          </CardContent>
        </Card>

        {Object.keys(errorStats).length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                错误类型统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(errorStats).map(([type, count]) => (
                  <div
                    key={type}
                    className="bg-red-900/20 border border-red-800 p-3"
                  >
                    <p className="text-sm text-red-400">{type}</p>
                    <p className="text-2xl font-bold font-mono text-red-300">
                      {count} 次
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {errorRecords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                错误详情
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {errorRecords.map((record, index) => (
                  <div
                    key={index}
                    className="bg-slate-800 p-3 border border-slate-700 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500 font-mono text-sm">
                        #{gameState.records.indexOf(record) + 1}
                      </span>
                      <div>
                        <p className="font-mono text-yellow-400">
                          {record.containerNo}
                        </p>
                        <p className="text-sm text-slate-400">
                          {record.licensePlate}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-red-400">{record.errorReason}</p>
                      <p className="text-xs text-slate-500">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {record.timeSpent.toFixed(2)}s
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {gameState.records.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                全部记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-700">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">箱号</th>
                      <th className="pb-2 pr-4">车牌</th>
                      <th className="pb-2 pr-4">危品</th>
                      <th className="pb-2 pr-4">操作</th>
                      <th className="pb-2 pr-4">结果</th>
                      <th className="pb-2 pr-4">分数</th>
                      <th className="pb-2">用时</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameState.records.map((record, index) => (
                      <tr
                        key={index}
                        className="border-b border-slate-800 hover:bg-slate-800/50"
                      >
                        <td className="py-2 pr-4 text-slate-500">{index + 1}</td>
                        <td className="py-2 pr-4 font-mono text-yellow-400">
                          {record.containerNo}
                        </td>
                        <td className="py-2 pr-4">{record.licensePlate}</td>
                        <td className="py-2 pr-4">
                          {record.hasDangerous ? (
                            <span className="text-red-400">是</span>
                          ) : (
                            <span className="text-slate-500">否</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {record.playerAction === 'pass' ? (
                            <span className="text-green-400">放行</span>
                          ) : record.playerAction === 'intercept' ? (
                            <span className="text-red-400">拦截</span>
                          ) : (
                            <span className="text-orange-400">超时</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {record.isCorrect ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                        </td>
                        <td
                          className={`py-2 pr-4 font-mono ${
                            record.scoreChange >= 0
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {record.scoreChange >= 0 ? '+' : ''}
                          {record.scoreChange}
                        </td>
                        <td className="py-2 text-slate-400">
                          {record.timeSpent.toFixed(2)}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Modal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title="验放报告"
        size="lg"
      >
        <pre className="bg-slate-950 p-4 rounded font-mono text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap">
          {reportText}
        </pre>
      </Modal>
    </div>
  );
}

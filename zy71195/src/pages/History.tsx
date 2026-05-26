import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  Download,
  Eye,
  Clock,
  Trophy,
  Target,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useHistoryStore } from '../store/useHistoryStore';
import { GameHistory } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { exportToJSON, exportToCSV, generateReportText, generateErrorStats } from '../utils/exporter';

export default function History() {
  const navigate = useNavigate();
  const { histories, loadHistories, deleteRecord, clearAll, selectHistory, selectedHistory } =
    useHistoryStore();
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [showDetail, setShowDetail] = useState<GameHistory | null>(null);

  useEffect(() => {
    loadHistories();
  }, [loadHistories]);

  const handleViewDetail = (history: GameHistory) => {
    setShowDetail(history);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这条记录吗？')) {
      deleteRecord(id);
    }
  };

  const handleClearAll = () => {
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复！')) {
      clearAll();
    }
  };

  const handleExportJSON = (history: GameHistory) => {
    exportToJSON(history);
  };

  const handleExportCSV = (history: GameHistory) => {
    exportToCSV(history);
  };

  const handleShowReport = (history: GameHistory) => {
    setReportText(generateReportText(history));
    setShowReport(true);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-slate-400 hover:text-slate-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </Button>
            <h1 className="text-2xl font-bold font-mono">历史记录</h1>
          </div>
          {histories.length > 0 && (
            <Button variant="danger" size="sm" onClick={handleClearAll}>
              <Trash2 className="w-4 h-4 mr-2" />
              清空全部
            </Button>
          )}
        </div>

        {histories.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16">
              <Clock className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">暂无游戏记录</p>
              <p className="text-slate-600 text-sm mt-2">完成游戏后，记录将显示在这里</p>
              <Button
                variant="primary"
                size="lg"
                className="mt-6"
                onClick={() => navigate('/')}
              >
                开始游戏
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {histories.map((history) => {
              const errorStats = generateErrorStats(history.records);
              const passed = history.accuracy >= 60;

              return (
                <Card key={history.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold font-mono text-slate-200">
                            {history.levelName}
                          </h3>
                          <span
                            className={`px-2 py-0.5 text-xs font-bold ${
                              passed
                                ? 'bg-green-900/50 text-green-400'
                                : 'bg-red-900/50 text-red-400'
                            }`}
                          >
                            {passed ? '通过' : '未通过'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mb-3">
                          {formatDate(history.startTime)}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="bg-slate-800 p-2 text-center">
                            <p className="text-xs text-slate-500">得分</p>
                            <p
                              className={`font-mono font-bold ${
                                history.score >= 0 ? 'text-yellow-400' : 'text-red-400'
                              }`}
                            >
                              {history.score}
                            </p>
                          </div>
                          <div className="bg-slate-800 p-2 text-center">
                            <p className="text-xs text-slate-500">准确率</p>
                            <p
                              className={`font-mono font-bold ${
                                history.accuracy >= 80
                                  ? 'text-green-400'
                                  : history.accuracy >= 60
                                  ? 'text-yellow-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {history.accuracy}%
                            </p>
                          </div>
                          <div className="bg-slate-800 p-2 text-center">
                            <p className="text-xs text-slate-500">车辆</p>
                            <p className="font-mono font-bold text-blue-400">
                              {history.totalVehicles}
                            </p>
                          </div>
                          <div className="bg-slate-800 p-2 text-center">
                            <p className="text-xs text-slate-500">正确</p>
                            <p className="font-mono font-bold text-green-400">
                              {history.correctCount}
                            </p>
                          </div>
                          <div className="bg-slate-800 p-2 text-center">
                            <p className="text-xs text-slate-500">用时</p>
                            <p className="font-mono font-bold text-slate-300">
                              {formatDuration(history.duration)}
                            </p>
                          </div>
                        </div>

                        {Object.keys(errorStats).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {Object.entries(errorStats).map(([type, count]) => (
                              <span
                                key={type}
                                className="px-2 py-0.5 text-xs bg-red-900/30 text-red-400"
                              >
                                {type}: {count}次
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleViewDetail(history)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          查看详情
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleExportJSON(history)}
                        >
                          JSON
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleExportCSV(history)}
                        >
                          CSV
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleShowReport(history)}
                        >
                          报告
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(history.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Modal
          isOpen={showDetail !== null}
          onClose={() => setShowDetail(null)}
          title="记录详情"
          size="xl"
        >
          {showDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-slate-800 p-3 text-center">
                  <Trophy className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">得分</p>
                  <p
                    className={`font-mono font-bold ${
                      showDetail.score >= 0 ? 'text-yellow-400' : 'text-red-400'
                    }`}
                  >
                    {showDetail.score}
                  </p>
                </div>
                <div className="bg-slate-800 p-3 text-center">
                  <Target className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">准确率</p>
                  <p
                    className={`font-mono font-bold ${
                      showDetail.accuracy >= 80
                        ? 'text-green-400'
                        : showDetail.accuracy >= 60
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  >
                    {showDetail.accuracy}%
                  </p>
                </div>
                <div className="bg-slate-800 p-3 text-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">正确</p>
                  <p className="font-mono font-bold text-green-400">
                    {showDetail.correctCount}
                  </p>
                </div>
                <div className="bg-slate-800 p-3 text-center">
                  <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">错误</p>
                  <p className="font-mono font-bold text-red-400">
                    {showDetail.errorCount}
                  </p>
                </div>
                <div className="bg-slate-800 p-3 text-center">
                  <Clock className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">用时</p>
                  <p className="font-mono font-bold text-slate-300">
                    {formatDuration(showDetail.duration)}
                  </p>
                </div>
              </div>

              {showDetail.errorCount > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-orange-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    错误类型统计
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(generateErrorStats(showDetail.records)).map(
                      ([type, count]) => (
                        <div
                          key={type}
                          className="bg-red-900/20 border border-red-800 p-2 text-center"
                        >
                          <p className="text-xs text-red-400">{type}</p>
                          <p className="font-mono font-bold text-red-300">{count}</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-2">详细记录</h4>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="text-left text-slate-500 border-b border-slate-700">
                        <th className="py-2 pr-4">#</th>
                        <th className="py-2 pr-4">箱号</th>
                        <th className="py-2 pr-4">车牌</th>
                        <th className="py-2 pr-4">危品</th>
                        <th className="py-2 pr-4">操作</th>
                        <th className="py-2 pr-4">结果</th>
                        <th className="py-2 pr-4">错误原因</th>
                        <th className="py-2 pr-4">分数</th>
                        <th className="py-2">用时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showDetail.records.map((record, index) => (
                        <tr
                          key={index}
                          className={`border-b border-slate-800 ${
                            !record.isCorrect ? 'bg-red-900/10' : ''
                          }`}
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
                          <td className="py-2 pr-4 text-red-400">
                            {record.errorReason || '-'}
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
              </div>
            </div>
          )}
        </Modal>

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
    </div>
  );
}

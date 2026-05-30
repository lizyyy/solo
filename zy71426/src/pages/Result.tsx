import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, FileText, Play, TrendingUp, AlertTriangle, Trophy, Target } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { getConclusionLabel, getRiskLevelLabel, getRiskLevelColor, getMarkTypeLabel } from '../utils/gameEngine';
import { loadReportFromStorage, getSeverityLabel, getSeverityColor } from '../utils/reportGenerator';
import type { InvestigationReport } from '../types';

const Result = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cases, setCurrentCase, resetCase, startPlayback, generateReport } = useGameStore();
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [showAnimation, setShowAnimation] = useState(true);

  useEffect(() => {
    if (id) {
      const storedReport = loadReportFromStorage(id);
      if (storedReport) {
        setReport(storedReport);
      } else {
        const caseData = cases.find(c => c.id === id);
        if (caseData) {
          const state = useGameStore.getState();
          const generatedReport = generateReport(id);
          setReport(generatedReport);
        }
      }
    }
    
    setTimeout(() => setShowAnimation(false), 2000);
  }, [id, cases, generateReport]);

  const currentCase = cases.find(c => c.id === id);

  if (!currentCase || !report) {
    return (
      <div className="min-h-screen bg-detective-bg flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">加载结果中...</p>
        </div>
      </div>
    );
  }

  const isPassed = currentCase.status === 'passed';
  const performance = report.playerPerformance;

  const handleRetry = () => {
    resetCase(id!);
    navigate('/cases');
  };

  const handlePlayback = () => {
    setCurrentCase(id!);
    startPlayback(id!);
    navigate(`/case/${id}`);
  };

  const handleViewReport = () => {
    navigate(`/report/${id}`);
  };

  const handleNextCase = () => {
    const currentIndex = cases.findIndex(c => c.id === id);
    const nextCase = cases.find((c, i) => i > currentIndex && c.status === 'pending');
    if (nextCase) {
      setCurrentCase(nextCase.id);
      navigate(`/case/${nextCase.id}`);
    } else {
      navigate('/cases');
    }
  };

  return (
    <div className="min-h-screen bg-detective-bg p-4 md:p-8">
      {showAnimation && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
          <div className="text-center">
            {isPassed ? (
              <>
                <div className="relative mb-6">
                  <Trophy className="w-32 h-32 text-detective-accent mx-auto animate-bounce" />
                  <div className="absolute inset-0 bg-detective-accent/20 rounded-full blur-3xl animate-pulse"></div>
                </div>
                <h2 className="text-4xl font-bold text-detective-accent mb-2">调查通过！</h2>
                <p className="text-xl text-slate-300">出色的侦探工作</p>
              </>
            ) : (
              <>
                <div className="relative mb-6">
                  <AlertTriangle className="w-32 h-32 text-detective-danger mx-auto animate-shake" />
                  <div className="absolute inset-0 bg-detective-danger/20 rounded-full blur-3xl animate-pulse"></div>
                </div>
                <h2 className="text-4xl font-bold text-detective-danger mb-2">需要重审</h2>
                <p className="text-xl text-slate-300">发现一些问题，请仔细查看分析</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/cases')}
            className="flex items-center gap-2 text-slate-400 hover:text-detective-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回案件大厅
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRetry}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              重新调查
            </button>
            <button
              onClick={handlePlayback}
              className="btn-secondary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              回放操作
            </button>
            <button
              onClick={handleViewReport}
              className="btn-primary flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              查看报告
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="file-folder text-center animate-slide-in-left">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${isPassed ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              {isPassed ? (
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400" />
              )}
            </div>
            <h3 className="text-lg font-bold mb-1 text-slate-200">调查结果</h3>
            <p className={`text-2xl font-bold ${isPassed ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPassed ? '通过' : '未通过'}
            </p>
          </div>

          <div className="file-folder text-center animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-detective-accent/20">
              <TrendingUp className="w-8 h-8 text-detective-accent" />
            </div>
            <h3 className="text-lg font-bold mb-1 text-slate-200">得分</h3>
            <p className="text-2xl font-bold text-detective-accent">
              {performance.earnedPoints} / {performance.totalPoints}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              准确率 {performance.accuracy.toFixed(0)}%
            </p>
          </div>

          <div className="file-folder text-center animate-slide-in-right" style={{ animationDelay: '200ms' }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-blue-500/20">
              <Target className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold mb-1 text-slate-200">风险等级</h3>
            <p className={`text-2xl font-bold ${getRiskLevelColor(report.riskAssessment.level)}`}>
              {getRiskLevelLabel(report.riskAssessment.level)}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {getConclusionLabel(report.riskAssessment.conclusion)}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="file-folder animate-slide-in-left">
            <h3 className="text-lg font-bold mb-4 text-detective-accent flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              你的优势
            </h3>
            {performance.strengths.length > 0 ? (
              <ul className="space-y-3">
                {performance.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">{strength}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 text-center py-4">暂无特别突出的优势，继续努力！</p>
            )}
          </div>

          <div className="file-folder animate-slide-in-right">
            <h3 className="text-lg font-bold mb-4 text-detective-accent flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              需要改进
            </h3>
            {performance.improvements.length > 0 ? (
              <ul className="space-y-3">
                {performance.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">{improvement}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 text-center py-4">表现优秀，暂无需要改进的地方！</p>
            )}
          </div>
        </div>

        {report.errorsFound.length > 0 && (
          <div className="file-folder mb-8 animate-fade-in">
            <h3 className="text-lg font-bold mb-4 text-detective-danger flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              发现的问题 ({report.errorsFound.length})
            </h3>
            <div className="space-y-4">
              {report.errorsFound.map((error, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getSeverityColor(error.severity) === 'text-red-500' ? 'bg-red-500/10 border-red-500/30' : getSeverityColor(error.severity) === 'text-orange-500' ? 'bg-orange-500/10 border-orange-500/30' : 'bg-amber-500/10 border-amber-500/30'} animate-fade-in`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(error.severity)}`}>
                        {getSeverityLabel(error.severity)}
                      </span>
                      <span className="text-slate-200 font-medium">{error.type}</span>
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm mb-2">{error.description}</p>
                  <p className="text-xs text-slate-400">
                    <span className="text-detective-accent">规则依据：</span>
                    {error.ruleBasis}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="file-folder mb-8 animate-fade-in">
          <h3 className="text-lg font-bold mb-4 text-detective-accent flex items-center gap-2">
            <FileText className="w-5 h-5" />
            证据分析对比
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-detective-bgLighter">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">证据类型</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">描述</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">你的标记</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">正确标记</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">结果</th>
                </tr>
              </thead>
              <tbody>
                {report.evidenceAnalysis.map((item, index) => (
                  <tr
                    key={index}
                    className={`border-b border-detective-bgLighter/50 transition-colors hover:bg-detective-bgLighter/30 ${!item.isCorrect ? 'bg-red-500/5' : ''}`}
                  >
                    <td className="py-3 px-4 text-slate-300">
                      {item.evidenceType === 'accident' ? '事故卡' : item.evidenceType === 'clause' ? '保单条款' : '照片证据'}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate">{item.description}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${item.isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {item.playerMark}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400">
                        {item.correctMark}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {item.isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="paper-texture mb-8 animate-fade-in">
          <h3 className="font-bold mb-3 text-detective-bg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            总结
          </h3>
          <p className="text-detective-bg/80">{report.finalConclusion}</p>
        </div>

        <div className="flex justify-center gap-4">
          <button onClick={handleRetry} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            重新调查
          </button>
          <button onClick={handlePlayback} className="btn-secondary flex items-center gap-2">
            <Play className="w-5 h-5" />
            回放操作
          </button>
          <button onClick={handleViewReport} className="btn-primary flex items-center gap-2">
            <FileText className="w-5 h-5" />
            导出完整报告
          </button>
          {cases.find((c, i) => i > cases.findIndex(c2 => c2.id === id) && c.status === 'pending') && (
            <button onClick={handleNextCase} className="btn-primary flex items-center gap-2">
              下一案
              <ArrowLeft className="w-5 h-5 rotate-180" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Result;

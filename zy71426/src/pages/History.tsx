import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Clock, Trophy, Play, FileText as FileTextIcon, RotateCcw } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { loadReportFromStorage } from '../utils/reportGenerator';
import { getConclusionLabel, getRiskLevelLabel, getRiskLevelColor } from '../utils/gameEngine';
import type { InvestigationReport } from '../types';

const History = () => {
  const navigate = useNavigate();
  const { cases, getCaseHistory, resetCase, startPlayback } = useGameStore();
  const [historyCases, setHistoryCases] = useState<Array<{
    case: typeof cases[0];
    report: InvestigationReport | null;
  }>>([]);

  useEffect(() => {
    const completedCases = getCaseHistory();
    const withReports = completedCases.map(c => ({
      case: c,
      report: loadReportFromStorage(c.id)
    }));
    setHistoryCases(withReports);
  }, [cases, getCaseHistory]);

  const getCaseTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'vehicle': '车险',
      'property': '财产险',
      'liability': '责任险',
      'health': '健康险'
    };
    return labels[type] || type;
  };

  const getDifficultyStars = (difficulty: number) => {
    return '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
  };

  const handleReplay = (caseId: string) => {
    startPlayback(caseId);
    navigate(`/case/${caseId}`);
  };

  const handleRetry = (caseId: string) => {
    resetCase(caseId);
    navigate(`/case/${caseId}`);
  };

  const handleViewReport = (caseId: string) => {
    navigate(`/report/${caseId}`);
  };

  const handleViewResult = (caseId: string) => {
    navigate(`/result/${caseId}`);
  };

  return (
    <div className="min-h-screen bg-detective-bg p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-detective-bgLighter"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-serif text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-detective-accent to-amber-300">
                调查记录
              </h1>
              <p className="text-sm text-slate-400">查看您已完成的理赔调查案件</p>
            </div>
          </div>
        </div>

        {historyCases.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-4">暂无调查记录</p>
            <button
              onClick={() => navigate('/cases')}
              className="px-6 py-2 bg-detective-accent text-detective-bg rounded-lg hover:bg-amber-400 transition-colors"
            >
              开始调查
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {historyCases.map(({ case: caseData, report }, index) => (
              <div
                key={caseData.id}
                className="file-folder animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-serif text-xl font-bold text-slate-200">
                        {caseData.title}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${
                        caseData.status === 'passed' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {caseData.status === 'passed' ? '通过' : '未通过'}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-slate-600/30 text-slate-400">
                        {getCaseTypeLabel(caseData.type)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="text-detective-accent">{getDifficultyStars(caseData.difficulty)}</span>
                      </span>
                      {report && (
                        <>
                          <span className="flex items-center gap-1">
                            <Trophy className="w-4 h-4" />
                            得分: {report.playerPerformance.earnedPoints}/{report.playerPerformance.totalPoints}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            准确率: {report.playerPerformance.accuracy.toFixed(1)}%
                          </span>
                          <span className="flex items-center gap-1">
                            <span className={getRiskLevelColor(report.riskAssessment.level)}>
                              {getRiskLevelLabel(report.riskAssessment.level)}
                            </span>
                          </span>
                          <span>
                            结论: {getConclusionLabel(report.riskAssessment.conclusion)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleViewResult(caseData.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-detective-accent/20 text-detective-accent rounded-lg hover:bg-detective-accent/30 transition-colors"
                    >
                      <FileTextIcon className="w-4 h-4" />
                      查看结果
                    </button>
                    <button
                      onClick={() => handleViewReport(caseData.id)}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-detective-bgLighter transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      查看报告
                    </button>
                    <button
                      onClick={() => handleReplay(caseData.id)}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-detective-bgLighter transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      回放
                    </button>
                    <button
                      onClick={() => handleRetry(caseData.id)}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-detective-bgLighter transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      重试
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;

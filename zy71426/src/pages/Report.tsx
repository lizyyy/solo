import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Shield, AlertTriangle, CheckCircle, XCircle, Clock, MapPin, DollarSign, User } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { InvestigationReport } from '../types';
import {
  getMarkTypeLabel,
  getConclusionLabel,
  getRiskLevelLabel,
  getRiskLevelColor,
  getRiskLevelBgColor
} from '../utils/gameEngine';
import {
  getSeverityLabel,
  getSeverityColor,
  loadReportFromStorage
} from '../utils/reportGenerator';
import { formatTime } from '../utils/playbackManager';

const Report = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cases, exportReport } = useGameStore();
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (id) {
      const savedReport = loadReportFromStorage(id);
      if (savedReport) {
        setReport(savedReport);
      } else {
        const currentCase = cases.find(c => c.id === id);
        if (currentCase) {
          const generatedReport = useGameStore.getState().generateReport(id);
          setReport(generatedReport);
        }
      }
    }
  }, [id, cases]);

  const handleExportPDF = async () => {
    if (!id) return;
    setIsExporting(true);
    try {
      await exportReport(id);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const currentCase = cases.find(c => c.id === id);

  if (!report || !currentCase) {
    return (
      <div className="min-h-screen bg-detective-bg flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">加载报告中...</p>
        </div>
      </div>
    );
  }

  const getEvidenceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'accident': '事故卡',
      'clause': '保单条款',
      'photo': '照片证据'
    };
    return labels[type] || type;
  };

  const getEvidenceTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'accident': 'bg-blue-500/20 text-blue-400',
      'clause': 'bg-purple-500/20 text-purple-400',
      'photo': 'bg-emerald-500/20 text-emerald-400'
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div className="min-h-screen bg-detective-bg py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/result/${id}`)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-detective-bgLighter"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-serif text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-detective-accent to-amber-300">
                理赔调查报告
              </h1>
              <p className="text-sm text-slate-400">
                {report.caseId.toUpperCase()} · 生成于 {new Date(report.generatedAt).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-detective-accent text-detective-bg rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? '导出中...' : '导出PDF'}
          </button>
        </div>

        <div id="report-content" className="bg-white rounded-xl p-8 text-slate-800">
          <div className="text-center mb-8 pb-6 border-b-2 border-slate-200">
            <h2 className="font-serif text-3xl font-bold text-slate-800 mb-2">保险理赔调查报告</h2>
            <p className="text-slate-500">案件编号：{report.caseId.toUpperCase()}</p>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-detective-accent" />
              一、案件摘要
            </h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-20">案件名称：</span>
                <span className="font-medium">{report.caseSummary.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500 w-16">事故时间：</span>
                <span>{report.caseSummary.accidentTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500 w-16">事故地点：</span>
                <span>{report.caseSummary.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500 w-16">索赔金额：</span>
                <span className="font-bold text-detective-accent">¥{report.caseSummary.claimAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-detective-accent" />
              二、证据分析
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="px-4 py-3 text-left font-medium text-slate-600">证据类型</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">证据描述</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">您的标记</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">正确标记</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">结果</th>
                  </tr>
                </thead>
                <tbody>
                  {report.evidenceAnalysis.map((item, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${getEvidenceTypeColor(item.evidenceType)}`}>
                          {getEvidenceTypeLabel(item.evidenceType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.description}</td>
                      <td className="px-4 py-3">{item.playerMark}</td>
                      <td className="px-4 py-3">{item.correctMark}</td>
                      <td className="px-4 py-3">
                        {item.isCorrect ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> 正确
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center gap-1">
                            <XCircle className="w-4 h-4" /> 错误
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-detective-accent" />
              三、条款匹配分析
            </h3>
            <div className="space-y-3">
              {report.clauseMatches.map((item, index) => (
                <div key={index} className={`p-4 rounded-lg border ${
                  item.shouldMatch 
                    ? (item.playerMatched ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50')
                    : (item.playerMatched ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-slate-50')
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{item.clauseNo}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        item.shouldMatch ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.shouldMatch ? '应匹配' : '无需匹配'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        item.playerMatched ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.playerMatched ? '已匹配' : '未匹配'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">{item.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {report.errorsFound.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-detective-accent" />
                四、错误发现与规则依据
              </h3>
              <div className="space-y-3">
                {report.errorsFound.map((error, index) => (
                  <div key={index} className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-800">{error.type}</span>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${getSeverityColor(error.severity)} bg-opacity-20`}
                        style={{ backgroundColor: error.severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' : error.severity === 'major' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(245, 158, 11, 0.1)' }}>
                        {getSeverityLabel(error.severity)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{error.description}</p>
                    <p className="text-xs text-slate-500">
                      <span className="font-medium">规则依据：</span>{error.ruleBasis}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-detective-accent" />
              五、风险评估
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-500 mb-1">风险评分</p>
                <p className="text-3xl font-bold text-slate-800">{report.riskAssessment.score}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-500 mb-1">风险等级</p>
                <p className={`text-2xl font-bold ${getRiskLevelColor(report.riskAssessment.level).replace('text-', 'text-')}`}>
                  {getRiskLevelLabel(report.riskAssessment.level)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-500 mb-1">您的结论</p>
                <p className="text-xl font-bold text-slate-800">
                  {getConclusionLabel(report.riskAssessment.conclusion)}
                </p>
              </div>
            </div>
            {report.riskAssessment.riskPoints.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700 mb-2">风险点：</p>
                <ul className="text-sm text-slate-600 space-y-1">
                  {report.riskAssessment.riskPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-detective-accent">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-detective-accent" />
              六、调查表现评估
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500 mb-1">总得分</p>
                <p className="text-3xl font-bold text-slate-800">
                  {report.playerPerformance.earnedPoints}
                  <span className="text-lg text-slate-400">/{report.playerPerformance.totalPoints}</span>
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500 mb-1">准确率</p>
                <p className="text-3xl font-bold text-slate-800">
                  {report.playerPerformance.accuracy.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500 mb-1">用时</p>
                <p className="text-2xl font-bold text-slate-800">
                  {formatTime(report.playerPerformance.timeSpent)}
                </p>
              </div>
              <div className={`rounded-lg p-4 ${getRiskLevelBgColor(report.playerPerformance.accuracy >= 80 ? 'low' : report.playerPerformance.accuracy >= 60 ? 'medium' : 'high')}`}>
                <p className="text-sm text-slate-500 mb-1">综合评价</p>
                <p className={`text-2xl font-bold ${getRiskLevelColor(report.playerPerformance.accuracy >= 80 ? 'low' : report.playerPerformance.accuracy >= 60 ? 'medium' : 'high')}`}>
                  {report.playerPerformance.accuracy >= 80 ? '优秀' : report.playerPerformance.accuracy >= 60 ? '良好' : '需改进'}
                </p>
              </div>
            </div>

            {report.playerPerformance.strengths.length > 0 && (
              <div className="bg-emerald-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-emerald-700 mb-2">✓ 优势：</p>
                <ul className="text-sm text-emerald-600 space-y-1">
                  {report.playerPerformance.strengths.map((s, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span>•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.playerPerformance.improvements.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-700 mb-2">⚠ 需改进：</p>
                <ul className="text-sm text-amber-600 space-y-1">
                  {report.playerPerformance.improvements.map((i, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span>•</span>
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-detective-accent/5 border-2 border-detective-accent/20 rounded-lg p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-3">七、调查结论</h3>
            <p className="text-slate-700 leading-relaxed">{report.finalConclusion}</p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 text-center text-sm text-slate-400">
            <p>本报告由「保险理赔侦探局」系统自动生成</p>
            <p className="mt-1">报告生成时间：{new Date(report.generatedAt).toLocaleString('zh-CN')}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={() => navigate(`/result/${id}`)}
            className="px-6 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-detective-bgLighter transition-colors"
          >
            返回结果页
          </button>
          <button
            onClick={() => navigate('/cases')}
            className="px-6 py-2 bg-detective-accent text-detective-bg rounded-lg hover:bg-amber-400 transition-colors"
          >
            返回案件大厅
          </button>
        </div>
      </div>
    </div>
  );
};

export default Report;

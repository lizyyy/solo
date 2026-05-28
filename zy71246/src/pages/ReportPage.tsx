import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, FileText, AlertCircle, ArrowLeft } from 'lucide-react';
import { Layout } from '../components/Layout';
import { ReportPanel } from '../components/ReportPanel';
import { useScoreStore } from '../store/scoreStore';
import type { MissionReport } from '../types/mission';

export const ReportPage: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { loadReportById, savedReports } = useScoreStore();
  
  const [report, setReport] = useState<MissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) {
      setError('未指定报告ID');
      setLoading(false);
      return;
    }

    try {
      const loadedReport = loadReportById(reportId);
      if (loadedReport) {
        setReport(loadedReport);
      } else {
        setError('报告不存在或已过期');
      }
    } catch (e) {
      setError('加载报告时出错');
    } finally {
      setLoading(false);
    }
  }, [reportId, loadReportById]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <FileText className="w-12 h-12 text-gold-400 mx-auto mb-4 animate-pulse" />
            <p className="text-deep-400 font-mono">正在加载报告...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !report) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center max-w-md">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-400 mb-2 font-mono">
              报告加载失败
            </h2>
            <p className="text-deep-400 mb-6">{error}</p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 bg-deep-800 hover:bg-deep-700 rounded text-sm font-mono transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                返回
              </button>
              <button
                onClick={handleGoHome}
                className="flex items-center gap-2 px-4 py-2 bg-gold-600 hover:bg-gold-500 rounded text-sm font-mono transition-colors"
              >
                <Home className="w-4 h-4" />
                返回首页
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pb-16"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 bg-deep-800 hover:bg-deep-700 rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gold-400 font-mono flex items-center gap-2">
                <FileText className="w-6 h-6" />
                测控任务报告
              </h2>
              <p className="text-xs text-deep-400 font-mono">
                报告ID: {report.reportId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGoHome}
              className="flex items-center gap-2 px-4 py-2 bg-deep-800 hover:bg-deep-700 rounded text-sm font-mono transition-colors"
            >
              <Home className="w-4 h-4" />
              返回首页
            </button>
          </div>
        </div>

        <ReportPanel report={report} />

        {savedReports.length > 1 && (
          <div className="mt-6 bg-deep-900/50 rounded-lg p-4 border border-deep-700">
            <h3 className="text-sm font-semibold text-deep-300 mb-3 font-mono">历史报告</h3>
            <div className="grid grid-cols-4 gap-3">
              {savedReports
                .filter(r => r.reportId !== report.reportId)
                .slice(0, 4)
                .map(r => (
                  <motion.div
                    key={r.reportId}
                    whileHover={{ scale: 1.02 }}
                    className="p-3 bg-deep-800/50 rounded-lg border border-deep-700 cursor-pointer hover:border-gold-500/50 transition-colors"
                    onClick={() => navigate(`/report/${r.reportId}`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-lg font-mono font-bold ${
                        r.grade === 'S' || r.grade === 'A' ? 'text-green-400' :
                        r.grade === 'B' || r.grade === 'C' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {r.grade}
                      </span>
                      <span className="text-xs font-mono text-deep-400">
                        {r.finalScore.toFixed(0)}
                      </span>
                    </div>
                    <div className="text-xs text-deep-400 truncate">{r.missionName}</div>
                    <div className="text-[10px] text-deep-500 font-mono">
                      {new Date(r.completedAt).toLocaleString()}
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
};

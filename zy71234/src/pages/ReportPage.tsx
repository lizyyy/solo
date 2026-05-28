import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, FileText, CheckCircle2 } from 'lucide-react';
import { useGameStore } from '../stores/useGameStore';
import { generateReportData, generateReportHTML, downloadReport } from '../utils/reportGenerator';
import { formatCurrency } from '../utils/settlementEngine';
import { getSeverityLabel, getIssueTypeLabel } from '../utils/issueDetector';
import levelsData from '../data/levels.json';

export function ReportPage() {
  const settlement = useGameStore(state => state.settlement);
  const game = useGameStore(state => state.game);
  const negotiationRecords = useGameStore(state => state.negotiationRecords);
  const setCurrentPage = useGameStore(state => state.setCurrentPage);
  
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const level = levelsData.find(l => l.id === game?.levelId);
  const reportData = settlement && game 
    ? generateReportData(level?.name || '未知关卡', settlement, negotiationRecords)
    : null;

  const handleExportHTML = () => {
    if (!reportData) return;
    const html = generateReportHTML(reportData);
    const filename = `版权谈判报告-${reportData.levelName}-${Date.now()}.html`;
    downloadReport(html, filename);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

  if (!settlement || !game || !reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-gray-400 mb-4">暂无报告数据</p>
          <button
            onClick={() => setCurrentPage('levels')}
            className="px-6 py-3 bg-music-gold text-music-dark font-bold rounded-lg"
          >
            选择关卡
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage('settlement')}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-serif font-bold text-music-gold">
                📄 谈判报告
              </h1>
              <p className="text-gray-400">{reportData.levelName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {exportSuccess && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                导出成功！
              </motion.div>
            )}
            <button
              onClick={handleExportHTML}
              disabled={exporting}
              className="flex items-center gap-2 px-6 py-3 bg-music-gold text-music-dark 
                font-bold rounded-lg hover:shadow-lg hover:shadow-music-gold/30 
                transition-all disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              导出 HTML 报告
            </button>
          </div>
        </div>

        <div id="report-content">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-music-gold/20 to-music-card 
              rounded-2xl p-8 mb-8 border border-music-gold/30"
          >
            <div className="text-center">
              <FileText className="w-16 h-16 text-music-gold mx-auto mb-4" />
              <h2 className="text-4xl font-serif font-bold text-white mb-2">
                音乐版权谈判报告
              </h2>
              <p className="text-gray-400">
                生成时间: {new Date().toLocaleString('zh-CN')}
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { label: '总营收', value: formatCurrency(reportData.totalRevenue), color: 'text-white' },
              { label: '最终支付', value: formatCurrency(reportData.finalPayout), color: 'text-music-gold' },
              { label: '信誉评分', value: `${reportData.reputationScore.toFixed(0)}分`, color: 'text-green-400' },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1 }}
                className="bg-music-card rounded-xl p-6 border border-white/10 text-center"
              >
                <div className="text-gray-400 text-sm mb-2">{stat.label}</div>
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-music-card rounded-xl p-6 border border-white/10 mb-8"
          >
            <h3 className="text-xl font-serif text-music-gold mb-6">
              🔍 原始信息 vs 处理结果对比
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 text-gray-400 font-medium">项目</th>
                    <th className="text-left py-3 text-gray-400 font-medium">📄 原始信息</th>
                    <th className="text-left py-3 text-gray-400 font-medium">🔄 处理结果</th>
                    <th className="text-left py-3 text-gray-400 font-medium">📝 差异说明</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.rawVsProcessed.map((item, index) => (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-4 font-medium">{item.item}</td>
                      <td className="py-4 text-gray-400 font-mono">{item.raw}</td>
                      <td className="py-4 text-music-gold font-mono">{item.processed}</td>
                      <td className="py-4 text-gray-300">{item.difference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-music-card rounded-xl p-6 border border-white/10 mb-8"
          >
            <h3 className="text-xl font-serif text-music-gold mb-6">
              ⚠️ 问题识别与分级
            </h3>
            
            {reportData.issues.length === 0 ? (
              <div className="text-center py-8 text-green-400">
                ✅ 未发现问题，协议合规！
              </div>
            ) : (
              <div className="space-y-4">
                {reportData.issues.map((issue, index) => (
                  <div
                    key={issue.id}
                    className={`p-4 rounded-lg border ${
                      issue.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                      issue.severity === 'major' ? 'bg-yellow-500/10 border-yellow-500/30' :
                      'bg-blue-500/10 border-blue-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                        issue.severity === 'critical' ? 'bg-red-500/30 text-red-400' :
                        issue.severity === 'major' ? 'bg-yellow-500/30 text-yellow-400' :
                        'bg-blue-500/30 text-blue-400'
                      }`}>
                        {getSeverityLabel(issue.severity)}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-white mb-1">{issue.description}</div>
                        <div className="text-sm text-gray-400 mb-2">
                          {getIssueTypeLabel(issue.type)}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="bg-music-darker rounded p-3">
                            <div className="text-gray-400 text-xs mb-1">原始信息</div>
                            <div className="text-gray-300">{issue.rawData}</div>
                          </div>
                          <div className="bg-music-darker rounded p-3">
                            <div className="text-gray-400 text-xs mb-1">处理结果</div>
                            <div className="text-yellow-300">{issue.processedResult}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-gray-400 bg-music-green/10 rounded p-3 border border-music-green/30">
                          <span className="text-music-green">💡 解释：</span>
                          {issue.explanation}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {reportData.negotiationRecords.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-music-card rounded-xl p-6 border border-white/10"
            >
              <h3 className="text-xl font-serif text-music-gold mb-6">
                📝 谈判操作记录
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 text-gray-400 font-medium">回合</th>
                      <th className="text-left py-3 text-gray-400 font-medium">卡牌</th>
                      <th className="text-left py-3 text-gray-400 font-medium">类型</th>
                      <th className="text-left py-3 text-gray-400 font-medium">效果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.negotiationRecords.map((record, index) => (
                      <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 font-medium">{record.round}</td>
                        <td className="py-3 font-medium text-white">{record.cardName}</td>
                        <td className="py-3">
                          <span className="px-2 py-1 rounded bg-music-gold/20 text-music-gold text-xs">
                            {record.cardType}
                          </span>
                        </td>
                        <td className="py-3 text-gray-400">{record.effect}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>本报告由音乐版权谈判培训工具自动生成</p>
            <p className="mt-1">© 2024 音乐版权谈判培训工具</p>
          </div>
        </div>
      </div>
    </div>
  );
}

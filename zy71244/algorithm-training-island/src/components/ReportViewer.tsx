import { useState } from 'react';
import { useGame } from '../context/GameContext';
import type { TrainingReport } from '../types';

interface ReportViewerProps {
  onClose: () => void;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ onClose }) => {
  const { state, exportReport, confirmCorrection } = useGame();
  const [acknowledger, setAcknowledger] = useState('');

  const generateReport = (): TrainingReport => {
    return {
      gameId: state.id,
      version: state.version.dataVersion,
      generatedAt: Date.now(),
      duration: state.currentDay - 1,
      finalStatus: state.status,
      finalScore: state.totalScore,
      problemDiscoveries: state.problemDiscoveries,
      correctionActions: state.correctionActions,
      keyDecisions: state.keyDecisions,
      memberStats: state.members.map(m => ({
        memberId: m.id,
        name: m.name,
        finalAbility: m.overallAbility,
        finalFatigue: m.fatigue,
        practiceCount: m.practiceCount,
        reviewCount: m.reviewCount,
        crashCount: m.crashCount,
      })),
      acknowledgers: [],
    };
  };

  const report = generateReport();

  const handleExport = () => {
    const reportData = exportReport();
    const blob = new Blob([reportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>训练报告 - ${report.gameId}</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #1e3a8a; margin-top: 30px; }
    .section { margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 8px; }
    .discovery { border-left: 4px solid #f59e0b; padding: 10px; margin: 10px 0; background: #fffbeb; }
    .correction { border-left: 4px solid #10b981; padding: 10px; margin: 10px 0; background: #ecfdf5; }
    .decision { border-left: 4px solid #8b5cf6; padding: 10px; margin: 10px 0; background: #f5f3ff; }
    .high { border-color: #ef4444 !important; background: #fef2f2 !important; }
    .medium { border-color: #f59e0b !important; background: #fffbeb !important; }
    .low { border-color: #3b82f6 !important; background: #eff6ff !important; }
    .member-card { display: inline-block; width: 200px; padding: 15px; margin: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat { display: flex; justify-content: space-between; margin: 5px 0; }
    .acknowledgment { margin-top: 40px; padding: 20px; border-top: 1px dashed #cbd5e1; }
    .signature { margin-top: 30px; display: flex; justify-content: space-around; }
    .signature-box { width: 200px; text-align: center; }
    .signature-line { border-bottom: 1px solid black; margin: 50px 0 5px; }
  </style>
</head>
<body>
  <h1>📊 算法竞赛训练报告</h1>
  
  <div class="section">
    <h2>📋 基本信息</h2>
    <p><strong>游戏ID:</strong> ${report.gameId}</p>
    <p><strong>数据版本:</strong> ${report.version}</p>
    <p><strong>生成时间:</strong> ${new Date(report.generatedAt).toLocaleString('zh-CN')}</p>
    <p><strong>训练周期:</strong> ${report.duration} 天</p>
    <p><strong>最终状态:</strong> ${report.finalStatus === 'won' ? '🏆 胜利' : report.finalStatus === 'lost' ? '😔 失败' : report.finalStatus === 'crashed' ? '💥 崩盘' : '🎮 进行中'}</p>
    <p><strong>最终得分:</strong> ${report.finalScore}</p>
  </div>

  <div class="section">
    <h2>🔍 第一部分：问题发现</h2>
    ${report.problemDiscoveries.length === 0 ? '<p>未发现问题。</p>' : ''}
    ${report.problemDiscoveries.map(d => `
      <div class="discovery ${d.severity}">
        <p><strong>第 ${d.day} 天</strong> | <strong>发现者:</strong> ${d.discoveredBy}</p>
        <p><strong>问题类型:</strong> ${d.type === 'fatigue' ? '😫 疲劳过高' : d.type === 'knowledge_gap' ? '📉 知识点短板' : d.type === 'lack_of_review' ? '📚 复盘缺失' : '⚖️ 发展不均衡'}</p>
        <p><strong>严重程度:</strong> ${d.severity === 'high' ? '🔴 高' : d.severity === 'medium' ? '🟡 中' : '🔵 低'}</p>
        <p>${d.description}</p>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <h2>🔧 第二部分：修正措施</h2>
    ${report.correctionActions.length === 0 ? '<p>暂无修正措施。</p>' : ''}
    ${report.correctionActions.map(c => `
      <div class="correction">
        <p><strong>第 ${c.day} 天</strong> | <strong>措施:</strong> ${c.action}</p>
        <p>${c.description}</p>
        <p><strong>预期效果:</strong> ${c.expectedEffect}</p>
        <p><strong>状态:</strong> ${c.confirmedBy ? '✅ 已确认' : '⏳ 待确认'}</p>
        ${c.confirmedBy ? `<p><strong>确认人:</strong> ${c.confirmedBy} | ${new Date(c.confirmedAt).toLocaleString('zh-CN')}</p>` : ''}
      </div>
    `).join('')}
  </div>

  <div class="section">
    <h2>🎯 关键决策记录</h2>
    ${report.keyDecisions.slice(-10).map(d => `
      <div class="decision ${d.riskLevel}">
        <p><strong>第 ${d.day} 天</strong> | <strong>类型:</strong> ${d.type === 'activity' ? '📋 训练安排' : d.type === 'strategy' ? '🎯 战略决策' : '🔧 调整措施'}</p>
        <p><strong>风险等级:</strong> ${d.riskLevel === 'high' ? '🔴 高' : d.riskLevel === 'medium' ? '🟡 中' : '🔵 低'}</p>
        <p><strong>决策:</strong> ${d.description}</p>
        <p><strong>影响:</strong> ${d.impact}</p>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <h2>👥 队员表现统计</h2>
    ${report.memberStats.map(m => `
      <div class="member-card">
        <h3>${m.name}</h3>
        <div class="stat"><span>最终能力:</span><strong>${m.finalAbility}</strong></div>
        <div class="stat"><span>最终疲劳:</span><strong>${Math.round(m.finalFatigue)}%</strong></div>
        <div class="stat"><span>刷题次数:</span><strong>${m.practiceCount}</strong></div>
        <div class="stat"><span>复盘次数:</span><strong>${m.reviewCount}</strong></div>
        <div class="stat"><span>崩盘次数:</span><strong>${m.crashCount}</strong></div>
      </div>
    `).join('')}
  </div>

  <div class="acknowledgment">
    <h2>✍️ 第三部分：确认签字</h2>
    <p>本报告由系统自动生成，包含完整的问题发现、修正措施和关键决策记录。</p>
    <p>请相关人员确认并签字。</p>
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-report-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unconfirmedCorrections = state.correctionActions.filter(c => !c.confirmedBy);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">📄 训练报告</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">
            ✕
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={handleExport} className="btn-secondary">
            📤 导出JSON
          </button>
          <button onClick={handleExportPDF} className="btn-primary">
            📄 导出HTML报告
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-2">📋 基本信息</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-slate-400">游戏ID:</span>
                <span className="text-white ml-2">{report.gameId}</span>
              </div>
              <div>
                <span className="text-slate-400">版本:</span>
                <span className="text-white ml-2">{report.version}</span>
              </div>
              <div>
                <span className="text-slate-400">训练周期:</span>
                <span className="text-white ml-2">{report.duration} 天</span>
              </div>
              <div>
                <span className="text-slate-400">最终状态:</span>
                <span className={`ml-2 font-semibold ${
                  report.finalStatus === 'won' ? 'text-yellow-400' :
                  report.finalStatus === 'lost' ? 'text-red-400' :
                  report.finalStatus === 'crashed' ? 'text-orange-400' : 'text-blue-400'
                }`}>
                  {report.finalStatus === 'won' ? '🏆 胜利' :
                   report.finalStatus === 'lost' ? '😔 失败' :
                   report.finalStatus === 'crashed' ? '💥 崩盘' : '🎮 进行中'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">最终得分:</span>
                <span className="text-purple-400 ml-2 font-bold">{report.finalScore}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-bold text-yellow-400 mb-3">🔍 第一部分：问题发现</h3>
            {report.problemDiscoveries.length === 0 ? (
              <p className="text-slate-400">未发现问题。</p>
            ) : (
              <div className="space-y-3">
                {report.problemDiscoveries.slice(-5).reverse().map(d => (
                  <div key={d.id} className={`p-3 rounded-lg border-l-4 ${
                    d.severity === 'high' ? 'bg-red-900/30 border-red-500' :
                    d.severity === 'medium' ? 'bg-yellow-900/30 border-yellow-500' :
                    'bg-blue-900/30 border-blue-500'
                  }`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-white">
                        {d.type === 'fatigue' ? '😫 疲劳过高' :
                         d.type === 'knowledge_gap' ? '📉 知识点短板' :
                         d.type === 'lack_of_review' ? '📚 复盘缺失' : '⚖️ 发展不均衡'}
                      </span>
                      <span className="text-xs text-slate-400">第 {d.day} 天 · {d.discoveredBy}</span>
                    </div>
                    <p className="text-sm text-slate-300">{d.description}</p>
                    <div className={`mt-1 text-xs badge ${
                      d.severity === 'high' ? 'badge-danger' :
                      d.severity === 'medium' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {d.severity === 'high' ? '🔴 高风险' :
                       d.severity === 'medium' ? '🟡 中风险' : '🔵 低风险'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-bold text-green-400 mb-3">🔧 第二部分：修正措施</h3>
            
            {unconfirmedCorrections.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                <p className="text-yellow-300 text-sm mb-2">
                  ⚠️ 有 {unconfirmedCorrections.length} 项措施待确认
                </p>
                {unconfirmedCorrections.slice(0, 3).map(c => (
                  <div key={c.id} className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">{c.action}</span>
                    <button
                      onClick={() => confirmCorrection(c.id, acknowledger || '匿名')}
                      className="btn-success text-xs py-1 px-3"
                    >
                      确认
                    </button>
                  </div>
                ))}
                {unconfirmedCorrections.length > 3 && (
                  <p className="text-xs text-slate-400">还有 {unconfirmedCorrections.length - 3} 项待确认...</p>
                )}
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="输入确认人姓名"
                    value={acknowledger}
                    onChange={e => setAcknowledger(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            )}

            {report.correctionActions.length === 0 ? (
              <p className="text-slate-400">暂无修正措施。</p>
            ) : (
              <div className="space-y-3">
                {report.correctionActions.slice(-5).reverse().map(c => (
                  <div key={c.id} className={`p-3 rounded-lg ${
                    c.confirmedBy ? 'bg-green-900/30 border border-green-700' : 'bg-slate-600/50 border border-slate-600'
                  }`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-white">{c.action}</span>
                      <span className={`badge ${c.confirmedBy ? 'badge-success' : 'badge-warning'}`}>
                        {c.confirmedBy ? '✅ 已确认' : '⏳ 待确认'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mb-1">{c.description}</p>
                    <p className="text-xs text-blue-400">🎯 预期: {c.expectedEffect}</p>
                    {c.confirmedBy && (
                      <p className="text-xs text-green-400 mt-1">
                        👤 确认人: {c.confirmedBy} · {new Date(c.confirmedAt).toLocaleString('zh-CN')}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">第 {c.day} 天</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-bold text-purple-400 mb-3">👥 队员统计</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {report.memberStats.map(m => (
                <div key={m.memberId} className="bg-slate-600/50 rounded-lg p-4">
                  <div className="font-bold text-white mb-2">{m.name}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">最终能力</span>
                      <span className="text-purple-400 font-semibold">{m.finalAbility}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">最终疲劳</span>
                      <span className={`font-semibold ${
                        m.finalFatigue > 80 ? 'text-red-400' :
                        m.finalFatigue > 50 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {Math.round(m.finalFatigue)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">刷题</span>
                      <span className="text-blue-400">{m.practiceCount}次</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">复盘</span>
                      <span className="text-purple-400">{m.reviewCount}次</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">崩盘</span>
                      <span className={`${m.crashCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {m.crashCount}次
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
          <div className="text-sm text-slate-400">
            版本: {state.version.dataVersion} | 数据更新: {new Date(state.version.lastUpdated).toLocaleString('zh-CN')}
          </div>
          <button onClick={onClose} className="btn-primary">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

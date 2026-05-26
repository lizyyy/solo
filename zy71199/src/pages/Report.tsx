import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Star, RotateCcw, Home, FileDown, Clock, CheckCircle, XCircle, AlertTriangle, FileCheck } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { CONFIDENTIALITY_LABELS, RETENTION_LABELS, ARCHIVE_BOX_LABELS } from '@/types';
import type { ActionRecord } from '@/types';

export default function Report() {
  const navigate = useNavigate();
  const { lastReport, restart, quit } = useGameStore();
  const [replayIndex, setReplayIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<'summary' | 'history' | 'errors'>('summary');

  if (!lastReport) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a3a2e] via-[#2c3e50] to-[#1a3a2e] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={48} className="text-white/30 mx-auto mb-4" />
          <p className="text-white/60">暂无结算报告</p>
          <button
            onClick={() => navigate('/levels')}
            className="mt-4 px-6 py-2.5 rounded-xl bg-[#d4a017] text-[#1a3a2e] font-bold"
          >
            返回关卡选择
          </button>
        </div>
      </div>
    );
  }

  const wrongActions = lastReport.wrongActions;
  const totalBorrowCount = lastReport.borrowCorrectCount + lastReport.borrowWrongCount;

  const formatAction = (action: ActionRecord): string => {
    switch (action.action) {
      case 'set_confidentiality':
        return `设定保密级别为「${CONFIDENTIALITY_LABELS[action.value as keyof typeof CONFIDENTIALITY_LABELS] || action.value}」`;
      case 'set_retention':
        return `设定保管期限为「${RETENTION_LABELS[action.value as keyof typeof RETENTION_LABELS] || action.value}」`;
      case 'assign_box':
        return `归档至「${ARCHIVE_BOX_LABELS[action.value] || action.value}」`;
      case 'process_borrow':
        return `处理借阅：${action.value}`;
      default:
        return action.action;
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(lastReport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive-report-${lastReport.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportText = () => {
    const lines: string[] = [];
    lines.push('='.repeat(60));
    lines.push('        资料归档审计 - 结算报告');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`报告编号: ${lastReport.sessionId}`);
    lines.push(`关卡名称: ${lastReport.levelName}`);
    lines.push(`导出时间: ${new Date(lastReport.exportTime).toLocaleString('zh-CN')}`);
    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('  成绩总览');
    lines.push('-'.repeat(60));
    lines.push(`  评级: ${'★'.repeat(lastReport.grade === 'S' ? 5 : lastReport.grade === 'A' ? 4 : lastReport.grade === 'B' ? 3 : lastReport.grade === 'C' ? 2 : 1)} ${lastReport.grade}`);
    lines.push(`  总得分: ${lastReport.totalScore} 分`);
    lines.push(`  正确率: ${lastReport.accuracy.toFixed(1)}%`);
    lines.push(`  文件正确: ${lastReport.correctCount} 个`);
    lines.push(`  文件错误: ${lastReport.wrongCount} 个`);
    lines.push(`  借阅正确: ${lastReport.borrowCorrectCount} 个`);
    lines.push(`  借阅错误: ${lastReport.borrowWrongCount} 个`);
    lines.push(`  用时: ${lastReport.duration} 秒`);
    lines.push('');

    if (wrongActions.length > 0) {
      lines.push('-'.repeat(60));
      lines.push('  错误操作记录');
      lines.push('-'.repeat(60));
      wrongActions.forEach((action, i) => {
        lines.push(`  ${i + 1}. [${new Date(action.timestamp).toLocaleTimeString('zh-CN')}] ${formatAction(action)}`);
        if (action.errorReason) {
          lines.push(`     原因: ${action.errorReason}`);
        }
        lines.push('');
      });
    }

    lines.push('-'.repeat(60));
    lines.push('  完整操作日志');
    lines.push('-'.repeat(60));
    lastReport.actionHistory.forEach((action, i) => {
      const status = action.isCorrect ? '✓' : '✗';
      lines.push(`  ${status} [${new Date(action.timestamp).toLocaleTimeString('zh-CN')}] ${formatAction(action)}`);
    });
    lines.push('');
    lines.push('='.repeat(60));
    lines.push('  报告结束');
    lines.push('='.repeat(60));

    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive-report-${lastReport.sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const gradeColors: Record<string, string> = {
    S: 'from-[#d4a017] to-[#f1c40f]',
    A: 'from-[#27ae60] to-[#2ecc71]',
    B: 'from-[#3498db] to-[#5dade2]',
    C: 'from-[#95a5a6] to-[#bdc3c7]',
    D: 'from-[#e67e22] to-[#f39c12]',
    F: 'from-[#c0392b] to-[#e74c3c]',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a3a2e] via-[#2c3e50] to-[#1a3a2e] p-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className={cn(
            'inline-flex items-center justify-center w-24 h-24 rounded-full',
            'bg-gradient-to-br shadow-2xl mb-4',
            gradeColors[lastReport.grade]
          )}>
            <span className="text-4xl font-bold text-white">{lastReport.grade}</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">关卡结算</h1>
          <p className="text-white/60">{lastReport.levelName}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <Trophy size={24} className="text-[#d4a017] mx-auto mb-2" />
            <div className="text-3xl font-bold text-white">{lastReport.totalScore}</div>
            <div className="text-white/60 text-sm">总得分</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-green-400">{lastReport.correctCount}</div>
            <div className="text-white/60 text-sm">文件正确</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <XCircle size={24} className="text-red-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-red-400">{lastReport.wrongCount}</div>
            <div className="text-white/60 text-sm">文件错误</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <FileCheck size={24} className="text-emerald-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-emerald-400">{lastReport.borrowCorrectCount}</div>
            <div className="text-white/60 text-sm">借阅正确</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <XCircle size={24} className="text-orange-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-orange-400">{lastReport.borrowWrongCount}</div>
            <div className="text-white/60 text-sm">借阅错误</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
            <Clock size={24} className="text-[#3498db] mx-auto mb-2" />
            <div className="text-3xl font-bold text-[#3498db]">{lastReport.duration}s</div>
            <div className="text-white/60 text-sm">用时</div>
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden mb-6">
          <div className="flex border-b border-white/10">
            {[
              { key: 'summary', label: '成绩总览', icon: Star },
              { key: 'history', label: '操作历史', icon: Clock },
              { key: 'errors', label: '错误回放', icon: XCircle },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={cn(
                  'flex-1 px-4 py-3 text-sm font-medium transition-all duration-200',
                  'flex items-center justify-center gap-2',
                  activeTab === tab.key
                    ? 'bg-white/10 text-white border-b-2 border-[#d4a017]'
                    : 'text-white/60 hover:text-white/80'
                )}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <span className="text-white/60">正确率</span>
                  <span className="text-2xl font-bold text-white">{lastReport.accuracy.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <span className="text-white/60">评级说明</span>
                  <div className="flex items-center gap-1 text-[#d4a017]">
                    {Array.from({ length: lastReport.grade === 'S' ? 5 : lastReport.grade === 'A' ? 4 : lastReport.grade === 'B' ? 3 : lastReport.grade === 'C' ? 2 : 1 }).map((_, i) => (
                      <Star key={i} size={16} className="fill-[#d4a017]" />
                    ))}
                  </div>
                </div>
                {totalBorrowCount > 0 && (
                  <div className="p-4 bg-white/5 rounded-xl">
                    <div className="text-white/60 text-sm mb-2">借阅处理统计</div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/80">借阅正确</span>
                      <span className="text-emerald-400 font-bold">{lastReport.borrowCorrectCount}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white/80">借阅错误</span>
                      <span className="text-orange-400 font-bold">{lastReport.borrowWrongCount}</span>
                    </div>
                  </div>
                )}
                {wrongActions.length > 0 && (
                  <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="text-red-400 mt-0.5" />
                      <div>
                        <p className="text-red-400 font-medium">共有 {wrongActions.length} 处错误</p>
                        <p className="text-white/60 text-sm mt-1">切换到「错误回放」查看详细分析</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {lastReport.actionHistory.map((action, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg transition-all duration-200',
                      action.isCorrect ? 'bg-green-500/10 hover:bg-green-500/20' : 'bg-red-500/10 hover:bg-red-500/20'
                    )}
                  >
                    {action.isCorrect ? (
                      <CheckCircle size={18} className="text-green-400 mt-0.5" />
                    ) : (
                      <XCircle size={18} className="text-red-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="text-white/80 text-sm">{formatAction(action)}</div>
                      <div className="text-white/40 text-xs mt-0.5">
                        {new Date(action.timestamp).toLocaleTimeString('zh-CN')}
                      </div>
                      {action.errorReason && (
                        <div className="text-red-400/80 text-xs mt-1">{action.errorReason}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'errors' && (
              <div className="space-y-4">
                {wrongActions.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
                    <p className="text-white/80">完美！没有任何错误</p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {wrongActions.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setReplayIndex(i)}
                          className={cn(
                            'w-10 h-10 rounded-lg font-bold transition-all duration-200',
                            replayIndex === i
                              ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                              : 'bg-white/10 text-white/60 hover:bg-white/20'
                          )}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    {replayIndex >= 0 && replayIndex < wrongActions.length && (
                      <div className="bg-gradient-to-br from-red-500/20 to-red-500/10 rounded-xl p-5 border border-red-500/30">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-500/30 flex items-center justify-center flex-shrink-0">
                            <XCircle size={20} className="text-red-400" />
                          </div>
                          <div className="flex-1">
                            <div className="text-white font-medium mb-2">错误 #{replayIndex + 1}</div>
                            <div className="text-white/80 text-sm mb-2">{formatAction(wrongActions[replayIndex])}</div>
                            {wrongActions[replayIndex].errorReason && (
                              <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-2">
                                <strong>原因：</strong>{wrongActions[replayIndex].errorReason}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {replayIndex < 0 && (
                      <p className="text-white/60 text-center py-4">点击上方数字查看错误详情</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={restart}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#d4a017] to-[#f1c40f]
              text-[#1a3a2e] font-bold flex items-center gap-2
              hover:shadow-lg hover:shadow-[#d4a017]/30 transition-all duration-200"
          >
            <RotateCcw size={18} />
            再来一次
          </button>
          <button
            onClick={() => navigate('/levels')}
            className="px-6 py-3 rounded-xl bg-white/10 text-white/80
              hover:bg-white/20 hover:text-white transition-all duration-200
              flex items-center gap-2"
          >
            <Trophy size={18} />
            选择关卡
          </button>
          <button
            onClick={handleExport}
            className="px-6 py-3 rounded-xl bg-white/10 text-white/80
              hover:bg-white/20 hover:text-white transition-all duration-200
              flex items-center gap-2"
          >
            <FileDown size={18} />
            导出 JSON
          </button>
          <button
            onClick={handleExportText}
            className="px-6 py-3 rounded-xl bg-white/10 text-white/80
              hover:bg-white/20 hover:text-white transition-all duration-200
              flex items-center gap-2"
          >
            <FileDown size={18} />
            导出文本报告
          </button>
          <button
            onClick={quit}
            className="px-6 py-3 rounded-xl bg-white/5 text-white/50
              hover:bg-white/10 hover:text-white/80 transition-all duration-200
              flex items-center gap-2 border border-white/10"
          >
            <Home size={18} />
            返回主页
          </button>
        </div>
      </div>
    </div>
  );
}
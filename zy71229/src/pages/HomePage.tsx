import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, RotateCcw, History, BookOpen, Shield, AlertTriangle, Clock, Target, FileJson } from 'lucide-react';
import { useHistoryStore } from '../store/useHistoryStore';
import { useGameStore } from '../store/useGameStore';
import { useUIStore } from '../store/useUIStore';

const rules = [
  {
    icon: Target,
    title: '路线规划',
    desc: '巡逻路线越全面，覆盖越多角落，但耗时越长。在有限时间内找到最优解。',
    color: 'text-source-route border-source-route',
  },
  {
    icon: AlertTriangle,
    title: '异常线索',
    desc: '每个异常可能来自多个数据源。交叉验证多个来源可以提高准确性，但需要时间。',
    color: 'text-alert-red border-alert-red',
  },
  {
    icon: Clock,
    title: '时间限制',
    desc: '游戏时间有限。快速处理可能漏检细节，仔细检查可能超时。',
    color: 'text-alert-yellow border-alert-yellow',
  },
  {
    icon: Shield,
    title: '回放评分',
    desc: '每个决策都会被记录并评分。准确率、响应速度、覆盖率都会影响最终得分。',
    color: 'text-alert-green border-alert-green',
  },
  {
    icon: FileJson,
    title: '报告导出',
    desc: '所有决策记录可导出为JSON/CSV格式，用于培训复盘和责任追溯。',
    color: 'text-source-report border-source-report',
  },
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { history, initializeFromStorage } = useHistoryStore();
  const { resetGame } = useGameStore();
  const { showRules, setShowRules } = useUIStore();
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    initializeFromStorage();
  }, [initializeFromStorage]);

  const handleNewGame = () => {
    resetGame();
    navigate('/game');
  };

  const handleLoadReplay = (replayId: string) => {
    navigate(`/replay/${replayId}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-alert-green';
    if (score >= 60) return 'text-alert-yellow';
    return 'text-alert-red';
  };

  return (
    <div className="min-h-screen bg-night-700 flex flex-col">
      <header className="relative py-16 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-night-500/30 to-transparent" />
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <pattern id="art-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="1" fill="currentColor" className="text-gray-500" />
              <rect x="10" y="10" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-gray-600" />
              <rect x="40" y="35" width="10" height="8" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-gray-600" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#art-pattern)" />
          </svg>
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield size={48} className="text-alert-blue" />
            <h1 className="text-4xl md:text-5xl font-bold font-mono text-white tracking-tight">
              美术馆夜巡解谜
            </h1>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            安保培训系统 · 多源数据交叉验证 · 决策可追溯
          </p>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <button
              onClick={handleNewGame}
              className="group relative p-8 bg-night-600 border-2 border-alert-green hover:border-alert-green transition-all hover:bg-night-500 text-left overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-alert-green/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <Play size={40} className="text-alert-green mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">开始新游戏</h2>
              <p className="text-gray-400">
                随机生成异常场景，在限时内根据多源数据排查异常，做出正确决策。
              </p>
            </button>

            <button
              onClick={() => setShowHistory(!showHistory)}
              className="group relative p-8 bg-night-600 border-2 border-gray-600 hover:border-source-route transition-all hover:bg-night-500 text-left overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-source-route/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <History size={40} className="text-source-route mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">历史复盘</h2>
              <p className="text-gray-400">
                查看历史对局记录，回放完整决策过程，进行培训复盘。
              </p>
              {history.length > 0 && (
                <span className="inline-block mt-2 px-2 py-1 bg-source-route/20 text-source-route text-xs font-mono">
                  {history.length} 条记录
                </span>
              )}
            </button>
          </div>

          {showHistory && (
            <div className="mb-12 panel animate-slide-in">
              <div className="panel-header">
                <span className="panel-title">历史对局记录</span>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-gray-200 text-sm"
                >
                  关闭
                </button>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto scrollbar-thin">
                {history.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <History size={32} className="mx-auto mb-2 opacity-30" />
                    <p>暂无历史记录</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map(record => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-4 bg-night-700 border border-gray-700 hover:border-gray-500 transition-colors cursor-pointer"
                        onClick={() => handleLoadReplay(record.replayDataId)}
                      >
                        <div>
                          <div className="text-sm text-gray-300">
                            {formatDate(record.startTime)}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            异常: {record.totalAnomalies} · 决策: {record.correctDecisions}/{record.totalDecisions} 正确
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-2xl font-bold font-mono ${getScoreColor(record.finalScore)}`}>
                            {record.finalScore}
                          </span>
                          <span className="text-xs text-gray-500">分</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <button
              onClick={() => setShowRules(!showRules)}
              className="flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-4 transition-colors"
            >
              <BookOpen size={18} />
              <span>{showRules ? '收起规则说明' : '展开规则说明'}</span>
            </button>

            {showRules && (
              <div className="space-y-4 animate-slide-in">
                <h3 className="text-lg font-semibold text-gray-200 mb-4">游戏规则 - 五大权衡机制</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {rules.map((rule, index) => (
                    <div
                      key={index}
                      className={`p-4 bg-night-600 border-l-4 ${rule.color}`}
                    >
                      <rule.icon size={24} className={`mb-2 ${rule.color.split(' ')[0]}`} />
                      <h4 className="font-semibold text-gray-200 mb-1">{rule.title}</h4>
                      <p className="text-sm text-gray-400">{rule.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-night-600 border border-gray-700">
                  <h4 className="font-semibold text-gray-200 mb-2">数据来源说明（追责用）</h4>
                  <p className="text-sm text-gray-400 mb-3">
                    所有数据都标记了来源，在UI和导出报告中保持可追溯：
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { tag: '[展厅]', color: 'border-source-hall', desc: '展厅状态' },
                      { tag: '[作品]', color: 'border-source-art', desc: '作品传感器' },
                      { tag: '[门禁]', color: 'border-source-door', desc: '门禁记录' },
                      { tag: '[灯光]', color: 'border-source-light', desc: '灯光控制' },
                      { tag: '[路线]', color: 'border-source-route', desc: '巡逻路线' },
                      { tag: '[报告]', color: 'border-source-report', desc: '夜巡报告' },
                    ].map((item, i) => (
                      <div key={i} className={`flex items-center gap-2 p-2 border-l-2 ${item.color} bg-night-700`}>
                        <span className="font-mono text-xs text-gray-400">{item.tag}</span>
                        <span className="text-xs text-gray-500">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="py-6 px-6 border-t border-gray-800">
        <div className="max-w-4xl mx-auto text-center text-xs text-gray-600">
          <p>美术馆夜巡解谜 · 安保培训系统 v1.0</p>
          <p className="mt-1">所有决策记录可追溯 · 适用于安保培训与考核</p>
        </div>
      </footer>
    </div>
  );
};

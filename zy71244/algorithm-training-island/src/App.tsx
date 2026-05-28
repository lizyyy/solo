import { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { MemberCard } from './components/MemberCard';
import { SchedulePanel } from './components/SchedulePanel';
import { StatusPanel } from './components/StatusPanel';
import { ProblemAnalysisPanel } from './components/ProblemAnalysisPanel';
import { DailyResults } from './components/DailyResults';
import { KeyDecisions } from './components/KeyDecisions';
import { ResultPage } from './components/ResultPage';
import { ReplayViewer } from './components/ReplayViewer';
import { ReportViewer } from './components/ReportViewer';

function GameContent() {
  const { state, executeDay, restartGame } = useGame();
  const [showReplay, setShowReplay] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const [activeTab, setActiveTab] = useState<'schedule' | 'analysis' | 'log' | 'decisions'>('schedule');

  const handleScheduleComplete = () => {
    executeDay();
  };

  const handleRestart = () => {
    if (confirm('确定要重新开局吗？当前进度将被清除。')) {
      restartGame();
    }
  };

  if (state.phase === 'result' || state.status !== 'playing') {
    return <ResultPage onRestart={handleRestart} />;
  }

  return (
    <div className="min-h-screen">
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🏝️</div>
              <div>
                <h1 className="text-xl font-bold text-white">算法竞赛补题岛</h1>
                <p className="text-xs text-slate-400">Algorithm Training Island</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 text-sm text-slate-400 bg-slate-700/50 rounded-lg px-3 py-1">
                <span>v{state.version.dataVersion}</span>
                <span className="text-slate-600">|</span>
                <span>Day {state.currentDay}/{state.totalDays}</span>
              </div>
              <button
                onClick={() => setShowReport(true)}
                className="btn-secondary text-sm"
                title="查看训练报告"
              >
                📄 报告
              </button>
              <button
                onClick={() => setShowReplay(true)}
                className="btn-secondary text-sm"
                title="查看回放"
              >
                🎥 回放
              </button>
              <button
                onClick={handleRestart}
                className="btn-danger text-sm"
                title="重新开局"
              >
                🔄 重开
              </button>
            </div>
          </div>
        </div>
      </header>

      {showTutorial && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full border border-slate-700 animate-fade-in">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">👋 欢迎来到算法竞赛补题岛！</h2>
              <p className="text-slate-400 mt-1">管理你的编程社队员，合理安排训练，避免疲劳崩盘！</p>
            </div>
            <button
              onClick={() => setShowTutorial(false)}
              className="text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 text-slate-300">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-2">🎮 游戏玩法</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">📝</span>
                  <span><strong>刷题</strong> - 提升知识点能力，但会增加疲劳</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">🔄</span>
                  <span><strong>复盘</strong> - 巩固知识点，疲劳增加较少</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">😴</span>
                  <span><strong>休息</strong> - 恢复精力，降低疲劳值</span>
                </li>
              </ul>
            </div>

            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-400 mb-2">⚠️ 注意事项</h3>
              <ul className="space-y-2 text-sm">
                <li>• 疲劳过高会导致<strong className="text-red-400">崩盘</strong>，训练效率严重下降</li>
                <li>• 知识点偏科、复盘缺失会被系统检测并记录为问题</li>
                <li>• 定期参加比赛获得分数，达成目标即可通关</li>
                <li>• 所有队员崩盘则游戏失败</li>
              </ul>
            </div>

            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
              <h3 className="font-semibold text-blue-400 mb-2">📊 三段式流程</h3>
              <ol className="space-y-1 text-sm">
                <li>1️⃣ <strong>问题发现</strong> - 系统自动分析训练问题</li>
                <li>2️⃣ <strong>修正措施</strong> - 针对问题给出建议</li>
                <li>3️⃣ <strong>确认执行</strong> - 确认人签字确认</li>
              </ol>
            </div>
          </div>

          <button
            onClick={() => setShowTutorial(false)}
            className="w-full btn-primary mt-6"
          >
            开始游戏 🚀
          </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <StatusPanel />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {state.members.map(member => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>

        <div className="flex gap-2 mb-4 bg-slate-800/50 rounded-lg p-1">
          {(['schedule', 'analysis', 'log', 'decisions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab === 'schedule' && '📋 排程'}
              {tab === 'analysis' && '🔍 问题分析'}
              {tab === 'log' && '📜 训练日志'}
              {tab === 'decisions' && '🎯 关键决策'}
            </button>
          ))}
        </div>

        {activeTab === 'schedule' && (
          <SchedulePanel onScheduleComplete={handleScheduleComplete} />
        )}
        {activeTab === 'analysis' && (
          <ProblemAnalysisPanel />
        )}
        {activeTab === 'log' && (
          <DailyResults />
        )}
        {activeTab === 'decisions' && (
          <KeyDecisions />
        )}
      </main>

      {showReplay && (
        <ReplayViewer onClose={() => setShowReplay(false)} />
      )}

      {showReport && (
        <ReportViewer onClose={() => setShowReport(false)} />
      )}

      <footer className="mt-8 py-6 border-t border-slate-700 text-center text-slate-500 text-sm">
        <p>算法竞赛补题岛 v{state.version.dataVersion} | 游戏ID: {state.id}</p>
        <p className="mt-1">数据版本: {state.version.dataVersion} | 最后更新: {new Date(state.version.lastUpdated).toLocaleString('zh-CN')}</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
}

export default App;

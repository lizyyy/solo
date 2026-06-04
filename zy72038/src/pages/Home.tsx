import React, { useState, useEffect } from 'react';
import { Shield, Gamepad2, Upload, BarChart3, Menu, X, Github } from 'lucide-react';
import { GameCanvas } from '@/components/GameCanvas';
import { ControlPanel } from '@/components/ControlPanel';
import { DataImport } from '@/components/DataImport';
import { AnalysisReport } from '@/components/AnalysisReport';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ReplayPlayer } from '@/components/ReplayPlayer';
import { useGameStore } from '@/store/gameStore';
import { useGameEngine } from '@/hooks/useGameEngine';
import { getDefaultGameConfig } from '@/utils/gameUtils';

type TabType = 'game' | 'import' | 'report';

export default function Home() {
  const { status, config, setConfig } = useGameStore();
  const [activeTab, setActiveTab] = useState<TabType>('game');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useGameEngine();

  useEffect(() => {
    const defaultConfig = getDefaultGameConfig();
    setConfig(defaultConfig);
  }, [setConfig]);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'game', label: '游戏', icon: <Gamepad2 className="w-4 h-4" /> },
    { id: 'import', label: '导入', icon: <Upload className="w-4 h-4" /> },
    { id: 'report', label: '报告', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <header className="relative z-10 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">链上钱包防守塔</h1>
                  <p className="text-xs text-slate-400">培训讲师老冯专用版本</p>
                </div>
              </div>

              <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                      ${activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}
                    `}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="flex items-center gap-4">
                {config && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-400 text-xs">
                      {status === 'playing'
                        ? '游戏进行中'
                        : status === 'paused'
                        ? '已暂停'
                        : status === 'ended'
                        ? '已结束'
                        : '准备就绪'}
                    </span>
                  </div>
                )}

                <button
                  className="md:hidden p-2 text-slate-400 hover:text-white"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>

            {mobileMenuOpen && (
              <div className="md:hidden py-4 border-t border-slate-700/50">
                <div className="flex flex-col gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`
                        flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all
                        ${activeTab === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                      `}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'game' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-white mb-2">游戏画布</h2>
                  <p className="text-slate-400 text-sm">
                    选择防守塔后点击网格位置放置，阻止敌人攻击你的钱包
                  </p>
                </div>
                <div className="flex justify-center">
                  <GameCanvas />
                </div>

                <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">操作说明</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-400">1</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">选择塔</p>
                        <p className="text-slate-400">在右侧选择防守塔类型</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-400">2</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">放置</p>
                        <p className="text-slate-400">点击网格放置防守塔</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-400">3</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">防守</p>
                        <p className="text-slate-400">塔会自动攻击范围内敌人</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-400">4</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">获胜</p>
                        <p className="text-slate-400">守住所有波次即获胜</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <ControlPanel />
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-2">数据导入</h2>
                <p className="text-slate-400 text-sm">
                  导入课堂计分表数据，系统会自动校验并保留原始备注信息
                </p>
              </div>
              <DataImport />

              <div className="mt-8 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-lg font-medium text-white mb-4">测试用例说明</h3>
                <div className="space-y-4 text-sm">
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-300 font-medium mb-1">空关卡测试</p>
                    <p className="text-slate-400">导入包含空名称或0波次的关卡配置</p>
                  </div>
                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-orange-300 font-medium mb-1">重复事件测试</p>
                    <p className="text-slate-400">导入包含相同ID的多个事件记录</p>
                  </div>
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-300 font-medium mb-1">边界值测试</p>
                    <p className="text-slate-400">导入超出正常范围的资源配置（如负数金币、超大生命值）</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'report' && (
            <div className="max-w-3xl mx-auto">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-2">分析报告</h2>
                <p className="text-slate-400 text-sm">
                  游戏结束后查看详细分析，包括失败原因、证据记录和改进建议
                </p>
              </div>
              <AnalysisReport />
            </div>
          )}
        </main>

        <footer className="relative z-10 border-t border-slate-700/50 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-slate-500 text-sm">
                © 2024 链上钱包防守塔 - 培训讲师老冯专用版本
              </div>
              <div className="flex items-center gap-4 text-slate-500 text-sm">
                <span>版本 1.0.0</span>
                <a href="#" className="hover:text-slate-300 transition-colors">
                  <Github className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </footer>

        <ReplayPlayer />
      </div>
    </ErrorBoundary>
  );
}

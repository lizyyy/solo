import { useEffect, useState } from 'react';
import { GridEditor } from '@/components/GridEditor/GridEditor';
import { ControlPanel } from '@/components/Controls/ControlPanel';
import { ValidationPanel } from '@/components/Validation/ValidationPanel';
import { HistoryPanel } from '@/components/History/HistoryPanel';
import { ExportPanel } from '@/components/Export/ExportPanel';
import { usePatternStore } from '@/store/patternStore';
import { Music2, Github, BookOpen, History, Settings } from 'lucide-react';

function App() {
  const { runValidation } = usePatternStore();
  const [activeSideTab, setActiveSideTab] = useState<'validation' | 'history' | 'export'>('validation');

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  const sideTabs = [
    { id: 'validation' as const, label: '节奏校验', icon: BookOpen },
    { id: 'history' as const, label: '版本历史', icon: History },
    { id: 'export' as const, label: '导出设置', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-dark-900 text-white font-mono">
      <header className="bg-dark-800 border-b border-dark-600 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-neon-blue flex items-center justify-center">
              <Music2 size={24} className="text-dark-900" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neon-blue">鼓机节奏生成器</h1>
              <p className="text-xs text-gray-500">Drum Machine Pattern Generator</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 bg-dark-700 px-2 py-1 rounded">
              电子音乐社 · 协作版
            </span>
            <a
              href="#"
              className="p-2 rounded-lg bg-dark-700 text-gray-400 hover:text-white transition-colors"
              title="帮助文档"
            >
              <Github size={18} />
            </a>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-screen-2xl mx-auto">
          <div className="mb-4">
            <ControlPanel />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <GridEditor />
            </div>

            <div className="w-80 flex flex-col gap-4">
              <div className="flex gap-1 bg-dark-800 p-1 rounded-lg border border-dark-600">
                {sideTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSideTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded text-xs transition-all ${
                        activeSideTab === tab.id
                          ? 'bg-neon-blue text-dark-900'
                          : 'text-gray-400 hover:text-white hover:bg-dark-700'
                      }`}
                    >
                      <Icon size={14} />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {activeSideTab === 'validation' && <ValidationPanel />}
              {activeSideTab === 'history' && <HistoryPanel />}
              {activeSideTab === 'export' && <ExportPanel />}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
              <h3 className="text-sm font-medium text-gray-400 mb-2">操作提示</h3>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• 点击网格添加/删除音符</li>
                <li>• 右键音符调整力度值</li>
                <li>• 拖拽选择多个音符</li>
                <li>• 保存版本记录修改历史</li>
              </ul>
            </div>
            <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
              <h3 className="text-sm font-medium text-gray-400 mb-2">力度范围</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-green" />
                  <span className="text-xs">正常 (20-110)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-orange" />
                  <span className="text-xs">过轻 (&lt; 20)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-red" />
                  <span className="text-xs">过重 (&gt; 110)</span>
                </div>
              </div>
            </div>
            <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
              <h3 className="text-sm font-medium text-gray-400 mb-2">快捷键</h3>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• <kbd className="bg-dark-700 px-1 rounded">Space</kbd> 播放/停止</li>
                <li>• <kbd className="bg-dark-700 px-1 rounded">M</kbd> 静音轨道</li>
                <li>• <kbd className="bg-dark-700 px-1 rounded">S</kbd> 独奏轨道</li>
                <li>• <kbd className="bg-dark-700 px-1 rounded">↑↓</kbd> 调整BPM</li>
              </ul>
            </div>
            <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
              <h3 className="text-sm font-medium text-gray-400 mb-2">协作说明</h3>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• 数据保存在本地浏览器</li>
                <li>• 导出JSON可分享给他人</li>
                <li>• 版本记录可回溯恢复</li>
                <li>• 覆盖前会显示冲突标记</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-8 py-4 border-t border-dark-700 text-center text-xs text-gray-600">
        <p>鼓机节奏生成器 · 电子音乐社内部工具 · v0.1.0</p>
      </footer>
    </div>
  );
}

export default App;

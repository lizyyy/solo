import { useState } from 'react';
import { HistoryTimeline } from '../history/HistoryTimeline';
import { PresetList } from '../presets/PresetList';
import { Button } from '../ui/Button';
import { History, Save } from 'lucide-react';

type TabType = 'history' | 'presets';

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('history');

  return (
    <aside className="w-80 bg-gray-900/50 border-l border-gray-800 flex flex-col h-full">
      <div className="flex border-b border-gray-800">
        <Button
          variant="ghost"
          size="sm"
          className={`flex-1 rounded-none border-b-2 ${
            activeTab === 'history'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-gray-500'
          }`}
          onClick={() => setActiveTab('history')}
        >
          <History size={14} className="mr-1.5" />
          历史记录
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`flex-1 rounded-none border-b-2 ${
            activeTab === 'presets'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-gray-500'
          }`}
          onClick={() => setActiveTab('presets')}
        >
          <Save size={14} className="mr-1.5" />
          预设管理
        </Button>
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        {activeTab === 'history' ? <HistoryTimeline /> : <PresetList />}
      </div>
    </aside>
  );
}

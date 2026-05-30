import React, { useState } from 'react';
import {
  User,
  Bell,
  Search,
  Download,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface HeaderProps {
  onRefresh?: () => void;
  onImport?: () => void;
  onExport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, onImport, onExport }) => {
  const { currentUser, currentDeviceId, devices } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-14 bg-slate-900/90 backdrop-blur border-b border-slate-700/50 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400">当前设备:</label>
          <select
            className="bg-slate-800 border border-slate-600 rounded-sm px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            value={currentDeviceId}
            onChange={(e) => useAppStore.getState().setCurrentDeviceId(e.target.value)}
          >
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.id})
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="搜索采样记录、异常事件..."
            className="input pl-10 w-80 py-1.5 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <button className="btn btn-ghost flex items-center gap-2 py-1.5" onClick={onRefresh}>
            <RefreshCw size={16} />
            <span>刷新</span>
          </button>
        )}
        {onImport && (
          <button className="btn btn-secondary flex items-center gap-2 py-1.5" onClick={onImport}>
            <Upload size={16} />
            <span>导入数据</span>
          </button>
        )}
        {onExport && (
          <button className="btn btn-primary flex items-center gap-2 py-1.5" onClick={onExport}>
            <Download size={16} />
            <span>导出报告</span>
          </button>
        )}
        <div className="w-px h-6 bg-slate-700 mx-2" />
        <button className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse-slow" />
        </button>
        <div className="flex items-center gap-2 ml-2 px-3 py-1.5 bg-slate-800 rounded-sm border border-slate-700">
          <div className="w-7 h-7 bg-blue-600 rounded-sm flex items-center justify-center">
            <User size={14} className="text-white" />
          </div>
          <span className="text-sm text-slate-300">{currentUser}</span>
        </div>
      </div>
    </header>
  );
};

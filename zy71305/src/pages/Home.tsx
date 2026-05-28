import { useState, useEffect } from 'react';
import { ImportExportBar } from '../components/ImportExportBar';
import { HoistPointManager } from '../components/HoistPointManager';
import { EquipmentList } from '../components/EquipmentList';
import { SettingsPanel } from '../components/SettingsPanel';
import { CheckResults } from '../components/CheckResults';
import { ForceDiagram } from '../components/ForceDiagram';
import { ReportExport } from '../components/ReportExport';
import { useHoistStore } from '../store/useHoistStore';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'data' | 'analysis' | 'report'>('data');
  const { report, loadSavedData } = useHoistStore();

  useEffect(() => {
    loadSavedData();
  }, [loadSavedData]);

  const tabs = [
    { id: 'data', label: '数据录入', icon: '📊' },
    { id: 'analysis', label: '受力分析', icon: '📐' },
    { id: 'report', label: '校核报告', icon: '📋' },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <ImportExportBar />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-1 mt-4 mb-6 bg-slate-800/50 p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.id === 'report' && report && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    report.summary.overallStatus === 'safe'
                      ? 'bg-green-400'
                      : report.summary.overallStatus === 'warning'
                      ? 'bg-yellow-400'
                      : 'bg-red-400'
                  }`}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 pb-8">
        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HoistPointManager />
              <SettingsPanel />
            </div>
            <EquipmentList />
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <ForceDiagram />
            <CheckResults />
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-6">
            <ReportExport />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>舞台吊点载荷校核工具 · 适用于课堂教学与实验室演示</p>
          <p className="mt-1 text-xs">
            计算结果仅供参考，实际作业请遵循相关安全规范
          </p>
        </div>
      </footer>
    </div>
  );
}

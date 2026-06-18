import { Upload, MapPin, GitBranch, CloudRain } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import ImportPanel from '../components/data/ImportPanel';
import MappingTable from '../components/data/MappingTable';
import BoundaryList from '../components/data/BoundaryList';
import CloudOcclusion from '../components/data/CloudOcclusion';
import type { TabType } from '../types';

const tabs: { key: TabType; label: string; icon: any; desc: string }[] = [
  { key: 'import', label: '导入记录', icon: Upload, desc: '船上记录本导入与去重' },
  { key: 'mapping', label: '经纬度映射', icon: MapPin, desc: '格式统一对应关系' },
  { key: 'boundary', label: '边界样本', icon: GitBranch, desc: '边界样本单独管理' },
  { key: 'cloud', label: '云遮挡处理', icon: CloudRain, desc: '处理建议与参考' },
];

export default function DataManage() {
  const activeTab = useRecordStore(s => s.activeTab);
  const setActiveTab = useRecordStore(s => s.setActiveTab);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-slate-800">数据管理</h1>
        <p className="text-sm text-slate-500 mt-1">导入记录本、管理经纬度映射、处理边界样本与云遮挡</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200">
          <div className="flex">
            {tabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center gap-2 px-4 py-3 text-sm transition-colors relative ${
                    isActive
                      ? 'text-ocean-600 bg-ocean-50/50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-medium">{tab.label}</p>
                    <p className="text-xs opacity-70">{tab.desc}</p>
                  </div>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ocean-500"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'import' && <ImportPanel />}
          {activeTab === 'mapping' && <MappingTable />}
          {activeTab === 'boundary' && <BoundaryList />}
          {activeTab === 'cloud' && <CloudOcclusion />}
        </div>
      </div>
    </div>
  );
}

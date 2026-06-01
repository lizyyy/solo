import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Table,
  FileText,
  Save,
} from 'lucide-react';
import { DataCheckCard } from './DataCheckCard';
import { SchemeList } from './SchemeList';
import type { DataCheckResult, Scheme, InspectionRecord } from '../../types';

interface LeftPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  dataCheckResult: DataCheckResult | null;
  schemes: Scheme[];
  currentSchemeId: string | null;
  records: InspectionRecord[];
  highlightedRow: number | null;
  onDataCheckItemClick: (type: string) => void;
  onLoadScheme: (id: string) => void;
  onDeleteScheme: (id: string) => void;
  onSaveNewScheme: () => void;
  onHighlightRow: (row: number | null) => void;
}

export function LeftPanel({
  collapsed,
  onToggle,
  dataCheckResult,
  schemes,
  currentSchemeId,
  records,
  highlightedRow,
  onDataCheckItemClick,
  onLoadScheme,
  onDeleteScheme,
  onSaveNewScheme,
  onHighlightRow,
}: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<'check' | 'schemes' | 'data'>('check');
  
  if (collapsed) {
    return (
      <div className="h-full w-12 bg-slate-900/90 backdrop-blur border-r border-slate-700 flex flex-col items-center py-4 gap-2">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </button>
        <div className="w-8 h-px bg-slate-700 my-2" />
        <button
          onClick={() => { onToggle(); setActiveTab('check'); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTab === 'check' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="数据检查"
        >
          <FileText className="w-5 h-5" />
        </button>
        <button
          onClick={() => { onToggle(); setActiveTab('schemes'); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTab === 'schemes' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="方案管理"
        >
          <Save className="w-5 h-5" />
        </button>
        <button
          onClick={() => { onToggle(); setActiveTab('data'); }}
          className={`p-2 rounded-lg transition-colors ${
            activeTab === 'data' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="原始数据"
        >
          <Table className="w-5 h-5" />
        </button>
      </div>
    );
  }
  
  return (
    <div className="h-full w-80 bg-slate-900/90 backdrop-blur border-r border-slate-700 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-slate-200">桥梁施工吊装预演</h2>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>
      </div>
      
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('check')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
            activeTab === 'check' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            数据检查
          </div>
          {activeTab === 'check' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('schemes')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
            activeTab === 'schemes' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Save className="w-3.5 h-3.5" />
            方案
          </div>
          {activeTab === 'schemes' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
            activeTab === 'data' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Table className="w-3.5 h-3.5" />
            原始数据
          </div>
          {activeTab === 'data' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
          )}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'check' && (
          <DataCheckCard
            result={dataCheckResult}
            onItemClick={onDataCheckItemClick}
          />
        )}
        
        {activeTab === 'schemes' && (
          <SchemeList
            schemes={schemes}
            currentSchemeId={currentSchemeId}
            onLoad={onLoadScheme}
            onDelete={onDeleteScheme}
            onSaveNew={onSaveNewScheme}
          />
        )}
        
        {activeTab === 'data' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Table className="w-4 h-4 text-blue-400" />
                原始数据表格
              </h3>
              <span className="text-xs text-slate-500">{records.length} 条记录</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-1 text-slate-500 font-medium">行</th>
                    <th className="text-left py-2 px-1 text-slate-500 font-medium">设备</th>
                    <th className="text-left py-2 px-1 text-slate-500 font-medium">异常类型</th>
                    <th className="text-left py-2 px-1 text-slate-500 font-medium">坐标</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className={`border-b border-slate-800 cursor-pointer transition-colors ${
                        highlightedRow === record.sourceRow
                          ? 'bg-yellow-500/20'
                          : 'hover:bg-slate-800/50'
                      }`}
                      onClick={() => onHighlightRow(highlightedRow === record.sourceRow ? null : record.sourceRow)}
                    >
                      <td className="py-2 px-1 text-slate-400 font-mono">#{record.sourceRow}</td>
                      <td className="py-2 px-1 text-slate-300">{record.deviceName}</td>
                      <td className="py-2 px-1 text-slate-400">{record.anomalyType}</td>
                      <td className="py-2 px-1 text-slate-500 font-mono">
                        {record.x.toFixed(0)},{record.y.toFixed(0)},{record.z.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

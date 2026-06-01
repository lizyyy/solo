import { useState } from 'react';
import {
  Camera,
  Save,
  RotateCcw,
  Download,
  FileText,
  User,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import type { Anomaly, Scheme } from '../../types';
import { STATUS_COLORS, STATUS_LABELS } from '../../types';

interface ToolbarProps {
  anomalies: Anomaly[];
  schemes: Scheme[];
  currentSchemeId: string | null;
  currentOperator: string;
  cameraPosition: [number, number, number];
  onSaveScheme: (name: string) => void;
  onExportScreenshot: () => void;
  onExportReport: () => void;
  onResetView: () => void;
  onSetOperator: (name: string) => void;
}

export function Toolbar({
  anomalies,
  schemes,
  currentSchemeId,
  currentOperator,
  cameraPosition,
  onSaveScheme,
  onExportScreenshot,
  onExportReport,
  onResetView,
  onSetOperator,
}: ToolbarProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [schemeName, setSchemeName] = useState('');
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [operatorName, setOperatorName] = useState(currentOperator);
  
  const currentScheme = schemes.find(s => s.id === currentSchemeId);
  
  const statusCounts = anomalies.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const handleSave = () => {
    if (schemeName.trim()) {
      onSaveScheme(schemeName.trim());
      setShowSaveModal(false);
      setSchemeName('');
    }
  };
  
  const handleSetOperator = () => {
    if (operatorName.trim()) {
      onSetOperator(operatorName.trim());
      setShowOperatorModal(false);
    }
  };
  
  return (
    <>
      <div className="absolute bottom-0 left-0 right-0 h-14 bg-slate-900/95 backdrop-blur border-t border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-400 font-mono">
              ({cameraPosition[0].toFixed(1)}, {cameraPosition[1].toFixed(1)}, {cameraPosition[2].toFixed(1)})
            </span>
          </div>
          
          <div className="h-6 w-px bg-slate-700" />
          
          <div className="flex items-center gap-4">
            {(['pending', 'processing', 'completed', 'rework'] as const).map((status) => {
              const count = statusCounts[status] || 0;
              const Icon = status === 'pending' ? AlertTriangle :
                          status === 'processing' ? Clock :
                          status === 'completed' ? CheckCircle : RefreshCw;
              
              return (
                <div key={status} className="flex items-center gap-1.5">
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: STATUS_COLORS[status] }}
                  />
                  <span className="text-xs font-medium" style={{ color: STATUS_COLORS[status] }}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{count}</span>
                </div>
              );
            })}
          </div>
          
          {currentScheme && (
            <>
              <div className="h-6 w-px bg-slate-700" />
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-400">方案:</span>
                <span className="text-xs text-slate-200 font-medium">{currentScheme.name}</span>
              </div>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOperatorModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            {currentOperator}
          </button>
          
          <div className="h-6 w-px bg-slate-700" />
          
          <button
            onClick={onResetView}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置视角
          </button>
          
          <button
            onClick={onExportScreenshot}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            截图
          </button>
          
          <button
            onClick={onExportReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            报告
          </button>
          
          <button
            onClick={() => {
              if (currentScheme) {
                onSaveScheme(currentScheme.name);
              } else {
                setShowSaveModal(true);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-xs text-white font-medium transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {currentScheme ? '更新方案' : '保存方案'}
          </button>
        </div>
      </div>
      
      {showSaveModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">保存方案</h3>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">方案名称</label>
              <input
                type="text"
                value={schemeName}
                onChange={(e) => setSchemeName(e.target.value)}
                placeholder="请输入方案名称..."
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!schemeName.trim()}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showOperatorModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">设置操作人员</h3>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">姓名</label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="请输入操作人员姓名..."
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowOperatorModal(false)}
                className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSetOperator}
                disabled={!operatorName.trim()}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

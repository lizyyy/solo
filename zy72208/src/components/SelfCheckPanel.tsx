import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, FileWarning, Coins, Calculator, FileCheck } from 'lucide-react';
import type { SelfCheckResult } from '../../shared/types.js';

interface SelfCheckPanelProps {
  results: SelfCheckResult[];
  onRunCheck: (types?: string[]) => void;
  loading?: boolean;
}

const checkConfig: Record<string, { icon: React.ReactNode; label: string; description: string }> = {
  'DUPLICATE_IMPORT': {
    icon: <FileWarning size={24} />,
    label: '重复导入检测',
    description: '基于文件哈希和行内容指纹检测重复批次'
  },
  'MIXED_CURRENCY': {
    icon: <Coins size={24} />,
    label: '港币人民币同列检测',
    description: '检测同一单元格内是否包含多种币种标识'
  },
  'RECALC_AFTER_SUPPLEMENT': {
    icon: <Calculator size={24} />,
    label: '补录后重算校验',
    description: '验证补录税费率后佣金计算是否正确'
  },
  'EXPORT_CONSISTENCY': {
    icon: <FileCheck size={24} />,
    label: '导出一致性校验',
    description: '确保页面展示、API返回、导出文件三者一致'
  }
};

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; animate?: string }> = {
  'PASS': { icon: <CheckCircle size={20} />, color: 'text-audit-green', bg: 'bg-audit-green/10', border: 'border-audit-green/30' },
  'WARNING': { icon: <AlertTriangle size={20} />, color: 'text-audit-orange', bg: 'bg-audit-orange/10', border: 'border-audit-orange/30', animate: 'animate-breathe' },
  'FAIL': { icon: <XCircle size={20} />, color: 'text-audit-red', bg: 'bg-audit-red/10', border: 'border-audit-red/30' }
};

export const SelfCheckPanel: React.FC<SelfCheckPanelProps> = ({ results, onRunCheck, loading }) => {
  const allTypes = ['DUPLICATE_IMPORT', 'MIXED_CURRENCY', 'RECALC_AFTER_SUPPLEMENT', 'EXPORT_CONSISTENCY'];
  
  const getResult = (type: string) => results.find(r => r.checkType === type);

  return (
    <div className="bg-white rounded-lg border border-navy-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl text-navy-800">自检引擎</h3>
        <button
          onClick={() => onRunCheck()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-navy-800 text-white rounded hover:bg-navy-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          执行全部自检
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {allTypes.map(type => {
          const config = checkConfig[type];
          const result = getResult(type);
          const status = result?.status || 'PASS';
          const statusStyle = statusConfig[status as keyof typeof statusConfig];
          
          return (
            <div
              key={type}
              className={`p-4 rounded-lg border-2 ${statusStyle.border} ${statusStyle.bg} ${statusStyle.animate || ''} transition-all hover:shadow-md cursor-pointer`}
              onClick={() => onRunCheck([type])}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${statusStyle.bg} ${statusStyle.color}`}>
                  {config.icon}
                </div>
                <div className={statusStyle.color}>
                  {result ? statusStyle.icon : <div className="w-5 h-5 rounded-full border-2 border-navy-300" />}
                </div>
              </div>
              
              <h4 className="font-semibold text-navy-800 text-sm mb-1">{config.label}</h4>
              <p className="text-xs text-navy-500 mb-2">{config.description}</p>
              
              {result && (
                <>
                  <p className={`text-xs font-medium ${statusStyle.color} mb-1`}>
                    {result.message}
                  </p>
                  {result.affectedDetailIds.length > 0 && (
                    <p className="text-xs text-navy-400 font-mono">
                      影响 {result.affectedDetailIds.length} 条明细
                    </p>
                  )}
                  <p className="text-xs text-navy-400 font-mono mt-1">
                    {result.checkedAt.slice(5, 16)}
                  </p>
                </>
              )}
              
              {!result && (
                <p className="text-xs text-navy-400 italic">点击执行检测</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

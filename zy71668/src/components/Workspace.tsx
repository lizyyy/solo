import { useState, useEffect } from 'react';
import { Play, Save, RotateCcw, Download, FileJson, FileSpreadsheet, FileText, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import DataImport from './DataImport';
import ParamsConfig from './ParamsConfig';
import ResultDashboard from './ResultDashboard';
import { exportToJSON, exportToExcel, downloadReport } from '@/utils/export';
import type { ChangeItem } from '@/types';

export default function Workspace() {
  const calculate = useAppStore((state) => state.calculate);
  const reset = useAppStore((state) => state.reset);
  const saveToHistory = useAppStore((state) => state.saveToHistory);
  const calculationResult = useAppStore((state) => state.calculationResult);
  const conservativeFactor = useAppStore((state) => state.conservativeFactor);
  const safetyMargin = useAppStore((state) => state.safetyMargin);
  const dataIssues = useAppStore((state) => state.dataIssues);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [versionDesc, setVersionDesc] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const errors = dataIssues.filter((i) => i.severity === 'error' && !i.fixed);

  const handleCalculate = () => {
    calculate();
  };

  const handleSave = () => {
    if (!authorName.trim()) return;

    const changes: ChangeItem[] = [
      {
        field: '保守系数',
        oldValue: 1.0,
        newValue: conservativeFactor,
        reason: '保守估算设置',
      },
      {
        field: '安全余量',
        oldValue: 15,
        newValue: safetyMargin,
        reason: '用户自定义安全设置',
      },
    ];

    saveToHistory(authorName, versionDesc || '未命名计算', changes);
    setShowSaveModal(false);
    setAuthorName('');
    setVersionDesc('');
  };

  const handleExportJSON = () => {
    if (calculationResult) {
      exportToJSON(calculationResult);
    }
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    if (calculationResult) {
      exportToExcel(calculationResult);
    }
    setShowExportMenu(false);
  };

  const handleExportReport = () => {
    if (calculationResult) {
      downloadReport(calculationResult);
    }
    setShowExportMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-100">
          无人机续航风阻估算工作台
        </h1>
        <div className="flex items-center gap-3">
          {errors.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-danger-500/20 border border-danger-500/50 rounded-lg text-danger-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {errors.length} 个错误待处理
            </div>
          )}

          <button
            onClick={handleCalculate}
            className="btn-primary flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            开始计算
          </button>

          <button
            onClick={reset}
            className="px-4 py-2 bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>

          {calculationResult && (
            <>
              <button
                onClick={() => setShowSaveModal(true)}
                className="px-4 py-2 bg-success-600 text-white rounded-md hover:bg-success-700 transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                保存版本
              </button>

              <div className="relative export-menu-container">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExportMenu(!showExportMenu);
                  }}
                  className="px-4 py-2 bg-aviation-600 text-white rounded-md hover:bg-aviation-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  导出
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-10">
                    <button
                      onClick={handleExportJSON}
                      className="w-full px-4 py-2.5 text-left text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <FileJson className="w-4 h-4 text-aviation-400" />
                      导出 JSON
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="w-full px-4 py-2.5 text-left text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-success-400" />
                      导出 Excel
                    </button>
                    <button
                      onClick={handleExportReport}
                      className="w-full px-4 py-2.5 text-left text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-warning-400" />
                      导出报告
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
        <div className="col-span-4 overflow-y-auto scrollbar-thin pr-2">
          <div className="space-y-4">
            <DataImport />
            <ParamsConfig />
          </div>
        </div>

        <div className="col-span-8 overflow-y-auto scrollbar-thin pl-2">
          <ResultDashboard />
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-slate-200">保存到历史记录</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label-text">操作人姓名</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="请输入您的姓名"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">版本描述（可选）</label>
                <textarea
                  value={versionDesc}
                  onChange={(e) => setVersionDesc(e.target.value)}
                  placeholder="简要描述本次计算的用途或修改内容"
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!authorName.trim()}
                className="px-4 py-2 bg-success-600 text-white rounded-md hover:bg-success-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

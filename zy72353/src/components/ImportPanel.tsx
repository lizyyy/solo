import { useState } from 'react';
import { Upload, X, Check, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useThresholdStore } from '../store/thresholdStore';
import type { ImportResult } from '../types';

const ImportPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { importThresholds, devices } = useThresholdStore();

  const handleSampleImport = () => {
    const sampleData = [
      {
        name: '冷凝管结霜阈值',
        value: -4,
        unit: 'Celsius' as const,
        deviceId: 'dev-001',
        remark: '测试导入数据1',
        calculationModel: 'FrostPointPrediction',
        modelVersion: 'v2.1.0',
        tradeOffReason: '测试数据',
      },
      {
        name: '冷凝管结霜阈值',
        value: -5,
        unit: 'Celsius' as const,
        deviceId: 'dev-001',
        remark: '重复数据测试',
      },
      {
        name: '冷凝管结霜阈值',
        value: 270,
        unit: 'Kelvin' as const,
        deviceId: 'dev-002',
        remark: '测试导入数据2',
      },
    ];

    const result = importThresholds(sampleData);
    setImportResult(result);
  };

  const handleClose = () => {
    setIsOpen(false);
    setImportResult(null);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50"
      >
        <Upload className="w-5 h-5" />
        <span className="font-medium">导入阈值表</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-industrial-600 rounded-xl w-full max-w-lg mx-4 shadow-2xl border border-industrial-500">
            <div className="flex items-center justify-between p-5 border-b border-industrial-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">导入安全阈值表</h3>
                  <p className="text-industrial-300 text-sm">支持 Excel、CSV 格式</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-industrial-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {!importResult ? (
                <>
                  <div className="border-2 border-dashed border-industrial-400 rounded-xl p-8 text-center hover:border-primary-500 transition-colors cursor-pointer bg-industrial-700/50">
                    <Upload className="w-12 h-12 text-industrial-300 mx-auto mb-3" />
                    <p className="text-industrial-200 mb-1">拖拽文件到此处或点击上传</p>
                    <p className="text-industrial-400 text-sm">支持 .xlsx, .xls, .csv</p>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 h-px bg-industrial-500" />
                    <span className="text-industrial-400 text-sm">或</span>
                    <div className="flex-1 h-px bg-industrial-500" />
                  </div>

                  <button
                    onClick={handleSampleImport}
                    className="w-full mt-4 py-3 bg-industrial-700 hover:bg-industrial-500 text-industrial-200 rounded-lg transition-all border border-industrial-500 hover:border-primary-500"
                  >
                    使用示例数据测试导入
                  </button>

                  <div className="mt-4 p-4 bg-industrial-700 rounded-lg">
                    <p className="text-industrial-300 text-sm">
                      <span className="text-primary-400">提示：</span>导入时系统会自动检测重复数据（名称+设备+数值相同判定为重复），并标记单位混用异常。
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-success-500/20 rounded-lg p-4 text-center">
                      <Check className="w-8 h-8 text-success-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-success-400">{importResult.success}</p>
                      <p className="text-industrial-300 text-sm">成功导入</p>
                    </div>
                    <div className="bg-warning-500/20 rounded-lg p-4 text-center">
                      <AlertTriangle className="w-8 h-8 text-warning-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-warning-400">{importResult.duplicate}</p>
                      <p className="text-industrial-300 text-sm">重复跳过</p>
                    </div>
                    <div className="bg-red-500/20 rounded-lg p-4 text-center">
                      <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-red-400">{importResult.error}</p>
                      <p className="text-industrial-300 text-sm">导入失败</p>
                    </div>
                  </div>

                  {importResult.messages.length > 0 && (
                    <div className="bg-industrial-700 rounded-lg p-4 max-h-40 overflow-y-auto">
                      <p className="text-industrial-200 text-sm font-medium mb-2">导入日志：</p>
                      {importResult.messages.map((msg, i) => (
                        <p key={i} className="text-industrial-300 text-sm py-1">
                          {msg}
                        </p>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleClose}
                    className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all font-medium"
                  >
                    完成
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportPanel;

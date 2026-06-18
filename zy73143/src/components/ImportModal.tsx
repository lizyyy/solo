import { useState } from 'react';
import { X, Upload, Check, AlertTriangle, FileText } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { ImportResult } from '../types';

const ImportModal = () => {
  const { showImportModal, setShowImportModal, importBuoyLogs } = useAppStore();
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [batchName, setBatchName] = useState('');

  const generateMockImportData = (hasDuplicate: boolean, hasAnomaly: boolean) => {
    const data: any[] = [
      {
        buoyId: 'FB-A04',
        longitude: 118.7756,
        latitude: 32.0389,
        temperature: 23.5,
        seagrassCoverage: 72,
        biomass: 148,
        recordTime: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        buoyId: 'FB-B02',
        longitude: 118.8234,
        latitude: 32.0678,
        temperature: 22.8,
        seagrassCoverage: 58,
        biomass: 115,
        recordTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    if (hasDuplicate) {
      data.push({
        buoyId: 'FB-A01',
        longitude: 118.7823,
        latitude: 32.0456,
        temperature: 22.5,
        seagrassCoverage: 78,
        biomass: 156,
        recordTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    if (hasAnomaly) {
      data.push({
        buoyId: 'FB-C02',
        longitude: 32.0923,
        latitude: 118.8345,
        temperature: 21.2,
        seagrassCoverage: 35,
        biomass: 68,
        recordTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return data;
  };

  const handleSimulateImport = (type: 'normal' | 'with-duplicate' | 'with-anomaly') => {
    let data: any[] = [];
    const batch = `batch-test-${Date.now()}`;

    switch (type) {
      case 'normal':
        data = generateMockImportData(false, false);
        break;
      case 'with-duplicate':
        data = generateMockImportData(true, false);
        break;
      case 'with-anomaly':
        data = generateMockImportData(false, true);
        break;
    }

    setSampleData(data);
    setBatchName(batch);
    setStep('preview');
  };

  const handleConfirmImport = () => {
    const result = importBuoyLogs(sampleData, batchName);
    setImportResult(result);
    setStep('result');
  };

  const handleClose = () => {
    setShowImportModal(false);
    setStep('upload');
    setImportResult(null);
    setSampleData([]);
    setBatchName('');
  };

  if (!showImportModal) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-ocean-50 to-white">
            <div>
              <h3 className="font-bold text-lg text-gray-800">导入浮标日志</h3>
              <p className="text-sm text-gray-500 mt-0.5">支持 CSV/Excel 格式数据导入</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {step === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50 hover:bg-ocean-50 hover:border-ocean-300 transition-colors cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">点击或拖拽文件到此处</p>
                  <p className="text-gray-400 text-sm mt-1">支持 .csv, .xlsx 格式</p>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-3">快速体验（模拟导入）</p>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => handleSimulateImport('normal')}
                      className="p-3 bg-seagrass-50 hover:bg-seagrass-100 rounded-lg text-left transition-colors border border-seagrass-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-seagrass-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-seagrass-800 text-sm">正常数据导入</p>
                          <p className="text-xs text-seagrass-600">全部为新数据，无异常</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSimulateImport('with-duplicate')}
                      className="p-3 bg-sand-50 hover:bg-sand-100 rounded-lg text-left transition-colors border border-sand-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sand-500 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-sand-800 text-sm">含重复记录</p>
                          <p className="text-xs text-sand-600">验证去重和备注保留功能</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleSimulateImport('with-anomaly')}
                      className="p-3 bg-coral-50 hover:bg-coral-100 rounded-lg text-left transition-colors border border-coral-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-coral-500 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-coral-800 text-sm">含经纬度反写异常</p>
                          <p className="text-xs text-coral-600">验证异常检测功能</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-4">
                <div className="bg-ocean-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-ocean-800">导入批次</p>
                  <p className="text-xs text-ocean-600 font-mono mt-1">{batchName}</p>
                  <p className="text-sm text-ocean-700 mt-2">
                    共 <span className="font-bold">{sampleData.length}</span> 条数据待导入
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">数据预览</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-600 font-medium">浮标编号</th>
                          <th className="px-3 py-2 text-left text-gray-600 font-medium">经度</th>
                          <th className="px-3 py-2 text-left text-gray-600 font-medium">纬度</th>
                          <th className="px-3 py-2 text-left text-gray-600 font-medium">覆盖度</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sampleData.map((item, index) => (
                          <tr key={index} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-mono">{item.buoyId}</td>
                            <td className="px-3 py-2">{item.longitude.toFixed(4)}</td>
                            <td className="px-3 py-2">{item.latitude.toFixed(4)}</td>
                            <td className="px-3 py-2">{item.seagrassCoverage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {step === 'result' && importResult && (
              <div className="space-y-4">
                <div className="bg-seagrass-50 rounded-xl p-5 text-center">
                  <div className="w-16 h-16 bg-seagrass-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-lg font-bold text-seagrass-800">导入完成</h4>
                  <p className="text-sm text-seagrass-600 mt-1">{importResult.batchName}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-gray-800">{importResult.total}</p>
                    <p className="text-xs text-gray-500 mt-1">导入总数</p>
                  </div>
                  <div className="bg-seagrass-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-seagrass-700">{importResult.newCount}</p>
                    <p className="text-xs text-seagrass-600 mt-1">新增记录</p>
                  </div>
                  <div className="bg-sand-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-sand-700">{importResult.duplicateCount}</p>
                    <p className="text-xs text-sand-600 mt-1">重复记录</p>
                  </div>
                  <div className="bg-coral-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-coral-700">{importResult.anomalyCount}</p>
                    <p className="text-xs text-coral-600 mt-1">检测到异常</p>
                  </div>
                </div>

                {importResult.skippedWithRemark > 0 && (
                  <div className="bg-sand-100 border border-sand-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-sand-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-sand-800 text-sm">备注保留提示</p>
                        <p className="text-xs text-sand-700 mt-1">
                          {importResult.skippedWithRemark} 条重复记录保留了原有人工备注，未被新数据覆盖
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3">
            {step === 'upload' ? (
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
            ) : step === 'preview' ? (
              <>
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  返回
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex-1 py-2.5 bg-ocean-600 text-white rounded-lg font-medium hover:bg-ocean-700 transition-colors shadow-sm"
                >
                  确认导入
                </button>
              </>
            ) : (
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 bg-ocean-600 text-white rounded-lg font-medium hover:bg-ocean-700 transition-colors shadow-sm"
              >
                完成
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ImportModal;

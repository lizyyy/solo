import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Database, ArrowRight, FileSpreadsheet, Info } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import DataUpload from '../components/modules/DataUpload';
import DataTable from '../components/common/DataTable';
import TracePanel from '../components/common/TracePanel';
import type { RawData } from '../types';

const DataImportPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    rawData, 
    processedData, 
    setRawData, 
    setSelectedDataId, 
    selectedDataId, 
    isTracePanelOpen, 
    setTracePanelOpen,
    loadMockData,
    runPreprocess,
    setCurrentStep,
    confirmDataStatus
  } = useDataStore();

  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = (file: File) => {
    setUploadError(null);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let parsedData: RawData[] = [];

        if (file.name.endsWith('.json')) {
          parsedData = JSON.parse(content);
        } else if (file.name.endsWith('.csv')) {
          parsedData = parseCSV(content);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          setUploadError('Excel文件解析需要xlsx库支持，请使用CSV或JSON格式，或加载内置样例数据');
          return;
        }

        if (parsedData.length === 0) {
          setUploadError('未解析到有效数据，请检查文件格式');
          return;
        }

        const dataWithIds = parsedData.map((item, index) => ({
          ...item,
          id: item.id || `RAW-${Date.now()}-${index.toString().padStart(3, '0')}`,
          importedAt: item.importedAt || new Date().toISOString(),
        }));

        setRawData(dataWithIds);
      } catch (error) {
        setUploadError(`文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    };

    reader.onerror = () => {
      setUploadError('文件读取失败');
    };

    reader.readAsText(file);
  };

  const parseCSV = (content: string): RawData[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data: RawData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const getValue = (names: string[]) => {
        const idx = headers.findIndex(h => names.some(n => h.includes(n)));
        return idx >= 0 ? values[idx] : '';
      };

      const stress = getValue(['stress', '应力']);
      const life = getValue(['life', '寿命', '循环']);

      data.push({
        id: '',
        material: getValue(['material', '材料']),
        stress: stress ? parseFloat(stress) : null,
        stressUnit: getValue(['stressunit', 'stress_unit', '应力单位', '单位']) || 'MPa',
        life: life ? parseFloat(life) : null,
        lifeUnit: getValue(['lifeunit', 'life_unit', '寿命单位', '单位']) || '次',
        source: getValue(['source', '来源']) || '文件导入',
        remark: getValue(['remark', '备注']),
        testDate: getValue(['testdate', 'test_date', '试验日期', '日期']) || new Date().toISOString().split('T')[0],
        importedAt: '',
      });
    }

    return data;
  };

  const handleLoadMockData = () => {
    loadMockData();
    setCurrentStep('preprocess');
    navigate('/preprocess');
  };

  const handleRowClick = (dataId: string) => {
    setSelectedDataId(dataId);
  };

  const handleTraceClose = () => {
    setTracePanelOpen(false);
  };

  const handleConfirm = (status: 'confirmed' | 'normal') => {
    if (selectedDataId) {
      confirmDataStatus(selectedDataId, status, '数据导入后确认', '系统');
    }
  };

  const handlePreprocess = () => {
    runPreprocess();
    setCurrentStep('preprocess');
    navigate('/preprocess');
  };

  const selectedData = processedData.find(d => d.id === selectedDataId) || 
                       rawData.find(d => d.id === selectedDataId);

  const displayData = processedData.length > 0 ? processedData : rawData;

  return (
    <div className="min-h-screen bg-engineering-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif-cn font-bold text-engineering-800">
              数据导入
            </h1>
            <p className="text-sm text-engineering-500 mt-1">
              上传疲劳试验数据，支持CSV、Excel、JSON格式
            </p>
          </div>
          <div className="flex items-center gap-4">
            {displayData.length > 0 && (
              <div className="text-right">
                <p className="text-sm text-engineering-500">已导入</p>
                <p className="text-2xl font-mono-num font-bold text-engineering-800">
                  {displayData.length} <span className="text-sm text-engineering-500">条</span>
                </p>
              </div>
            )}
            {rawData.length > 0 && (
              <button
                onClick={handlePreprocess}
                className="btn-primary flex items-center gap-2"
              >
                开始预处理
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {uploadError && (
          <div className="p-4 bg-danger-50 border border-danger-200 rounded-engineering flex items-start gap-3">
            <Info className="w-5 h-5 text-danger-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-danger-800">上传失败</p>
              <p className="text-sm text-danger-700 mt-0.5">{uploadError}</p>
            </div>
          </div>
        )}

        {rawData.length === 0 ? (
          <DataUpload 
            onLoadMockData={handleLoadMockData}
            onFileUpload={handleFileUpload}
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card p-4 bg-engineering-50 border border-engineering-200">
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="w-4 h-4 text-engineering-600" />
                  <span className="text-xs text-engineering-500">数据总量</span>
                </div>
                <p className="text-2xl font-mono-num font-bold text-engineering-800">
                  {rawData.length}
                </p>
              </div>
              <div className="card p-4 bg-warning-50 border border-warning-200">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-warning-600" />
                  <span className="text-xs text-warning-600">空值数据</span>
                </div>
                <p className="text-2xl font-mono-num font-bold text-warning-700">
                  {rawData.filter(d => d.stress === null || d.life === null).length}
                </p>
              </div>
              <div className="card p-4 bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-blue-600">材料种类</span>
                </div>
                <p className="text-2xl font-mono-num font-bold text-blue-700">
                  {new Set(rawData.map(d => d.material)).size}
                </p>
              </div>
              <div className="card p-4 bg-historical-50 border border-historical-200">
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="w-4 h-4 text-historical-600" />
                  <span className="text-xs text-historical-600">数据来源</span>
                </div>
                <p className="text-2xl font-mono-num font-bold text-historical-700">
                  {new Set(rawData.map(d => d.source)).size}
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>数据预览</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setRawData([]); }}
                    className="btn-secondary text-sm"
                  >
                    清空数据
                  </button>
                  <button
                    onClick={handleLoadMockData}
                    className="btn-secondary flex items-center gap-1.5 text-sm"
                  >
                    <Database className="w-4 h-4" />
                    替换为样例数据
                  </button>
                </div>
              </div>
              <div className="card-body p-0">
                {displayData.length > 0 && (
                  <DataTable
                    data={displayData}
                    highlightId={selectedDataId || undefined}
                    onRowClick={handleRowClick}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {isTracePanelOpen && selectedData && (
          <TracePanel
            data={selectedData as any}
            onClose={handleTraceClose}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </div>
  );
};

export default DataImportPage;

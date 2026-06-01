import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, ChevronRight, Sparkles } from 'lucide-react';
import { useAppStore, createNewSolution } from '../store/appStore';
import { sampleDevicesSmooth, sampleDevicesRework, sampleDevicesBoundary } from '../data/mockData';
import { DeviceData } from '../types';

const sampleDatasets = [
  { name: '顺利处理样例', description: '少量异常，可快速通过', devices: sampleDevicesSmooth, color: 'green' },
  { name: '返工样例', description: '包含多种异常，需要补录修正', devices: sampleDevicesRework, color: 'orange' },
  { name: '边界测试样例', description: '空值、重复项、边界值测试', devices: sampleDevicesBoundary, color: 'red' },
];

export default function ImportPage() {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedData, setUploadedData] = useState<DeviceData[] | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [selectedSample, setSelectedSample] = useState<number | null>(null);
  const currentConfig = useAppStore((state) => state.currentConfig);
  const addSolution = useAppStore((state) => state.addSolution);
  const setCurrentSolution = useAppStore((state) => state.setCurrentSolution);

  const handleFileUpload = useCallback((file: File) => {
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
      
      const devices: DeviceData[] = jsonData.map((row, index) => ({
        id: `device-${index}`,
        name: row['设备名称'] || row['name'] || '',
        floor: Number(row['楼层'] || row['floor'] || 1),
        position: {
          x: Number(row['X坐标'] || row['x'] || 0),
          y: Number(row['Y坐标'] || row['y'] || 1),
          z: Number(row['Z坐标'] || row['z'] || 0),
        },
        energyConsumption: Number(row['能耗'] || row['energy'] || 0),
        status: 'normal',
        photo: row['照片'] || row['photo'],
        lastUpdate: new Date().toISOString(),
      }));
      
      setUploadedData(devices);
      setSelectedSample(null);
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleSampleSelect = (index: number) => {
    setSelectedSample(index);
    setUploadedData(null);
    setUploadedFileName('');
  };

  const handleContinue = () => {
    const devices = uploadedData || (selectedSample !== null ? sampleDatasets[selectedSample].devices : null);
    if (!devices) return;

    const solutionName = uploadedFileName 
      ? uploadedFileName.replace(/\.[^/.]+$/, '')
      : sampleDatasets[selectedSample!].name;
    
    const newSolution = createNewSolution(solutionName, devices, currentConfig);
    addSolution(newSolution);
    setCurrentSolution(newSolution);
    navigate('/parameter');
  };

  const hasData = uploadedData !== null || selectedSample !== null;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          开始数据校验流程
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">导入能耗楼宇数据</h1>
        <p className="text-gray-500">上传 Excel/CSV 文件或选择样例数据，系统将自动检测异常</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">上传文件</h3>
          <div
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
              isDragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDragging ? 'bg-primary-100' : 'bg-gray-100'}`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-primary-600' : 'text-gray-500'}`} />
            </div>
            <p className="font-medium text-gray-700 mb-1">
              {isDragging ? '释放文件以上传' : '拖拽文件到此处'}
            </p>
            <p className="text-sm text-gray-500">或点击选择文件</p>
            <p className="text-xs text-gray-400 mt-2">支持 .xlsx, .xls, .csv 格式</p>
          </div>

          {uploadedData && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-green-800 truncate">{uploadedFileName}</p>
                <p className="text-sm text-green-600">已读取 {uploadedData.length} 条设备数据</p>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">选择样例数据</h3>
          <div className="space-y-3">
            {sampleDatasets.map((sample, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  selectedSample === index
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
                onClick={() => handleSampleSelect(index)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    sample.color === 'green' ? 'bg-green-100' :
                    sample.color === 'orange' ? 'bg-orange-100' : 'bg-red-100'
                  }`}>
                    <FileSpreadsheet className={`w-5 h-5 ${
                      sample.color === 'green' ? 'text-green-600' :
                      sample.color === 'orange' ? 'text-orange-600' : 'text-red-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{sample.name}</p>
                    <p className="text-sm text-gray-500">{sample.description}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                    {sample.devices.length} 条
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {hasData && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-accent-orange" />
            异常预检测结果
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="设备总数" value={(uploadedData || sampleDatasets[selectedSample!].devices).length} />
            <StatCard label="坐标偏移" value={countAnomalyType('coordinate_offset')} warning />
            <StatCard label="重名设备" value={countAnomalyType('duplicate_name')} error />
            <StatCard label="缺照片" value={countAnomalyType('missing_photo')} />
            <StatCard label="跨楼层" value={countAnomalyType('cross_floor')} error />
            <StatCard label="空值/边界" value={countAnomalyType('empty_value') + countAnomalyType('boundary')} warning />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          disabled={!hasData}
          onClick={handleContinue}
          className={`flex items-center gap-2 px-8 py-3 rounded-xl font-medium transition-all duration-200 ${
            hasData
              ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200 hover:shadow-xl'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          进入参数配置
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  function countAnomalyType(type: string): number {
    const devices = uploadedData || (selectedSample !== null ? sampleDatasets[selectedSample].devices : null);
    if (!devices) return 0;
    
    if (type === 'missing_photo') {
      return devices.filter(d => !d.photo).length;
    }
    if (type === 'duplicate_name') {
      const names = new Set();
      const duplicates = new Set();
      devices.forEach(d => {
        if (names.has(d.name)) duplicates.add(d.name);
        names.add(d.name);
      });
      return duplicates.size;
    }
    if (type === 'empty_value') {
      return devices.filter(d => !d.name || d.name.trim() === '').length;
    }
    return 0;
  }
}

function StatCard({ label, value, warning, error }: { label: string; value: number; warning?: boolean; error?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${
        error ? 'text-accent-red' : warning ? 'text-accent-orange' : 'text-gray-800'
      }`}>
        {value}
      </p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

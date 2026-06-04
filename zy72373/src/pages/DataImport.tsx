import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, AlertTriangle, Check, ArrowRight } from 'lucide-react';
import Papa from 'papaparse';
import { useDiagnosisStore } from '../store/useDiagnosisStore';
import { StepProgress } from '../components/StepProgress';
import { formatTemperature } from '../services/temperatureService';
import type { SensorData, StepInfo } from '../types';

export function DataImport() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { importSensorData, setCurrentTask } = useDiagnosisStore();
  const [isDragging, setIsDragging] = useState(false);
  const [importedData, setImportedData] = useState<SensorData[]>([]);

  const steps: StepInfo[] = [
    { step: 1, title: '数据导入', description: '导入传感器数据', status: 'active' },
    { step: 2, title: '照片补录', description: '补录工况照片', status: 'pending' },
    { step: 3, title: '生成报告', description: '生成交接报告', status: 'pending' },
  ];

  const handleFileUpload = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const data: SensorData[] = results.data
          .filter((row: any) => row.sensorNo)
          .map((row: any, index: number) => ({
            id: `imported-${index}`,
            sensorNo: row.sensorNo || row['传感器编号'] || '',
            timestamp: row.timestamp || row['时间'] || new Date().toISOString(),
            temperature: parseFloat(row.temperature || row['温度'] || 0),
            temperatureUnit: (row.unit || row['单位'] || 'C') as 'C' | 'K',
            vibration: parseFloat(row.vibration || row['振动'] || 0),
            position: row.position || row['位置'] || '',
          }));
        setImportedData(data);
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleImportData = () => {
    if (taskId && importedData.length > 0) {
      setCurrentTask(taskId);
      importSensorData(taskId, importedData);
      navigate(`/diagnosis/${taskId}/photos`);
    }
  };

  const handleLoadDemoData = () => {
    const demoData: SensorData[] = [
      { id: 's1', sensorNo: 'FAN-001-A', timestamp: new Date().toISOString(), temperature: 85, temperatureUnit: 'C', vibration: 2.3, position: '叶片A' },
      { id: 's2', sensorNo: 'FAN-001-B', timestamp: new Date().toISOString(), temperature: 358, temperatureUnit: 'K', vibration: 2.1, position: '叶片B' },
      { id: 's3', sensorNo: 'FAN-001-C', timestamp: new Date().toISOString(), temperature: 82, temperatureUnit: 'C', vibration: 2.5, position: '叶片C' },
      { id: 's4', sensorNo: 'FAN-001-D', timestamp: new Date().toISOString(), temperature: 355, temperatureUnit: 'K', vibration: 2.2, position: '叶片D' },
    ];
    setImportedData(demoData);
  };

  const hasUnitMixing = importedData.some(d => d.temperatureUnit === 'C') && importedData.some(d => d.temperatureUnit === 'K');
  const celsiusCount = importedData.filter(d => d.temperatureUnit === 'C').length;
  const kelvinCount = importedData.filter(d => d.temperatureUnit === 'K').length;

  return (
    <div className="space-y-8">
      <div className="card">
        <StepProgress steps={steps} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-industrial-900">第一步：导入传感器数据</h2>
            <p className="text-sm text-industrial-500 mt-1">上传CSV文件或使用演示数据</p>
          </div>
          <button onClick={handleLoadDemoData} className="btn-secondary">
            加载演示数据
          </button>
        </div>

        {importedData.length === 0 ? (
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
              isDragging
                ? 'border-industrial-500 bg-industrial-50'
                : 'border-industrial-200 hover:border-industrial-400'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-industrial-400" />
            <p className="text-industrial-600 mb-2">拖拽CSV文件到这里</p>
            <p className="text-sm text-industrial-400 mb-4">或点击选择文件</p>
            <label className="btn-primary cursor-pointer inline-block">
              <input type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
              选择文件
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            {hasUnitMixing && (
              <div className="card-warning border-2 flex items-start gap-4 p-4">
                <div className="bg-warning-200 p-2 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-warning-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-warning-800">检测到温度单位混用！</h3>
                  <p className="text-sm text-warning-700 mt-1">
                    摄氏度(℃)数据: {celsiusCount} 条 | 开尔文(K)数据: {kelvinCount} 条
                  </p>
                  <p className="text-sm text-warning-600 mt-2">
                    ⚠️ 系统不会自动修正，将留给训练教练老唐人工复核
                  </p>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-industrial-50">
                    <th className="table-header">传感器编号</th>
                    <th className="table-header">位置</th>
                    <th className="table-header">温度</th>
                    <th className="table-header">振动</th>
                    <th className="table-header">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {importedData.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.temperatureUnit === 'K'
                          ? 'bg-warning-50 animate-shake'
                          : 'hover:bg-industrial-50'
                      }
                    >
                      <td className="table-cell font-mono text-sm">{row.sensorNo}</td>
                      <td className="table-cell">{row.position}</td>
                      <td className="table-cell">
                        <span className={`font-mono ${
                          row.temperatureUnit === 'K' ? 'text-warning-700 font-semibold' : ''
                        }`}>
                          {formatTemperature(row.temperature, row.temperatureUnit)}
                        </span>
                      </td>
                      <td className="table-cell">{row.vibration} mm/s</td>
                      <td className="table-cell">
                        {row.temperatureUnit === 'K' ? (
                          <span className="badge badge-pending">待复核</span>
                        ) : (
                          <span className="badge badge-success">正常</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-industrial-100">
              <div className="flex items-center gap-2 text-sm text-industrial-500">
                <Check className="w-4 h-4 text-emerald-500" />
                已导入 {importedData.length} 条数据
              </div>
              <button
                onClick={handleImportData}
                className="btn-primary flex items-center gap-2"
              >
                确认导入
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

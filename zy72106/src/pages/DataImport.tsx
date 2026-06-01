import { useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { sampleSensorRecords } from '@/data/sampleData';
import { Upload, FileText, Plus, Trash2, Download } from 'lucide-react';
import Papa from 'papaparse';
import type { SensorRecord } from '@/types';

export function DataImport() {
  const { sensorRecords, setSensorRecords, removeSensorRecord } =
    useAppStore();
  const [dragActive, setDragActive] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    },
    []
  );

  const handleFileUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        try {
          const parsedRecords: SensorRecord[] = results.data
            .filter((row: any) => row.sensorId)
            .map((row: any, index: number) => ({
              id: `imported-${Date.now()}-${index}`,
              sensorId: row.sensorId || row['传感器ID'] || '',
              stationName: row.stationName || row['台站名称'] || '',
              latitude: parseFloat(row.latitude || row['纬度']) || 0,
              longitude: parseFloat(row.longitude || row['经度']) || 0,
              elevation: parseFloat(row.elevation || row['海拔']) || 0,
              pWaveArrival: row.pWaveArrival || row['P波到时'] ? parseFloat(row.pWaveArrival || row['P波到时']) : null,
              sWaveArrival: row.sWaveArrival || row['S波到时'] ? parseFloat(row.sWaveArrival || row['S波到时']) : null,
              amplitude: row.amplitude || row['振幅'] ? parseFloat(row.amplitude || row['振幅']) : null,
              quality: (row.quality || row['质量'] || 'good') as 'good' | 'fair' | 'poor',
              source: (row.source || row['来源'] || 'sensor') as 'sensor' | 'manual' | 'legacy',
              notes: row.notes || row['备注'],
              createdAt: new Date().toISOString(),
            }));

          setSensorRecords([...sensorRecords, ...parsedRecords]);
          setImportStatus('success');
          setTimeout(() => setImportStatus('idle'), 3000);
        } catch (error) {
          setImportStatus('error');
          setTimeout(() => setImportStatus('idle'), 3000);
        }
      },
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const loadSampleData = () => {
    setSensorRecords(sampleSensorRecords);
    setImportStatus('success');
    setTimeout(() => setImportStatus('idle'), 3000);
  };

  const exportTemplate = () => {
    const template = [
      {
        sensorId: 'STA-001',
        stationName: '示例台站',
        latitude: 39.9042,
        longitude: 116.4074,
        elevation: 43.5,
        pWaveArrival: 10.5,
        sWaveArrival: 18.2,
        amplitude: 2500,
        quality: 'good',
        source: 'sensor',
        notes: '示例数据',
      },
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '地震波数据模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-white">上传数据文件</h3>
          </div>
          <div className="card-body">
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary-500 bg-primary-900/30'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload
                className={`mx-auto mb-4 ${
                  importStatus === 'success'
                    ? 'text-green-400'
                    : importStatus === 'error'
                    ? 'text-red-400'
                    : 'text-primary-400'
                }`}
                size={48}
              />
              <p className="text-white font-medium mb-2">
                {importStatus === 'success'
                  ? '导入成功！'
                  : importStatus === 'error'
                  ? '导入失败，请检查文件格式'
                  : '拖拽文件到此处或点击上传'}
              </p>
              <p className="text-sm text-slate-400 mb-4">支持 CSV 格式文件</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="btn-primary inline-flex items-center gap-2 cursor-pointer"
              >
                <FileText size={18} />
                选择文件
              </label>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={loadSampleData}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                加载示例数据
              </button>
              <button
                onClick={exportTemplate}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-primary-400 hover:text-primary-300 transition-colors"
              >
                <Download size={18} />
                下载数据模板
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-white">
              已导入数据 ({sensorRecords.length}条)
            </h3>
            {sensorRecords.length > 0 && (
              <button
                onClick={() => setSensorRecords([])}
                className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <Trash2 size={14} /> 清空
              </button>
            )}
          </div>
          <div className="card-body">
            {sensorRecords.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto text-slate-600 mb-4" size={48} />
                <p className="text-slate-400">暂无数据，请上传或加载示例数据</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sensorRecords.map((record) => (
                  <div
                    key={record.id}
                    className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between hover:bg-slate-800 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-white">{record.stationName}</p>
                      <p className="text-xs text-slate-400">
                        {record.sensorId} · P: {record.pWaveArrival?.toFixed(2) || '-'}s · S:{' '}
                        {record.sWaveArrival?.toFixed(2) || '-'}s
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`badge ${
                          record.quality === 'good'
                            ? 'badge-success'
                            : record.quality === 'fair'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                      >
                        {record.quality}
                      </span>
                      <button
                        onClick={() => removeSensorRecord(record.id)}
                        className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-white">数据说明</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-white mb-2">必需字段</h4>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• sensorId / 传感器ID</li>
                <li>• stationName / 台站名称</li>
                <li>• latitude / 纬度</li>
                <li>• longitude / 经度</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">可选字段</h4>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• elevation / 海拔</li>
                <li>• pWaveArrival / P波到时 (秒)</li>
                <li>• sWaveArrival / S波到时 (秒)</li>
                <li>• amplitude / 振幅</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">数据质量标记</h4>
              <ul className="space-y-1 text-sm text-slate-400">
                <li>• good - 数据质量良好</li>
                <li>• fair - 数据质量一般</li>
                <li>• poor - 数据质量较差</li>
                <li>• legacy - 旧口径数据</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

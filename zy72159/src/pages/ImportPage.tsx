import { useState } from 'react';
import { Upload, FileJson, FileSpreadsheet, AlertCircle, CheckCircle, Database, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAppStore } from '../store/useAppStore';
import { ConflictCard } from '../components/ConflictCard';
import type { ImportResult } from '@shared/types';

export default function ImportPage() {
  const navigate = useNavigate();
  const { fetchRecords, setImportResult } = useAppStore();
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [content, setContent] = useState('');
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const sampleJSON = `[
  {
    "stationName": "龙阳路站",
    "exitNo": "2号口",
    "lat": 31.2148,
    "lng": 121.5575,
    "timeSlot": "早高峰 7:30-9:00",
    "bikeCount": 45,
    "capacity": 60,
    "reason": "早高峰通勤流量大",
    "source": {
      "type": "inspection",
      "name": "2024年3月巡查记录",
      "date": "2024-03-15",
      "rawContent": "龙阳路站2号口早高峰停放正常"
    }
  }
]`;

  const sampleCSV = `stationName,exitNo,lat,lng,timeSlot,bikeCount,capacity,reason,sourceType,sourceName,sourceDate,sourceContent
龙阳路站,2号口,31.2148,121.5575,早高峰 7:30-9:00,45,60,早高峰通勤流量大,inspection,2024年3月巡查记录,2024-03-15,龙阳路站2号口早高峰停放正常`;

  const handlePreview = async () => {
    if (!content.trim()) {
      setError('请输入或粘贴导入内容');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.import.preview(content, format);
      setPreviewResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '预览失败');
      setPreviewResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!previewResult) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.import.doImport(content, format);
      setImportResult(result);
      await fetchRecords();
      alert(`导入成功！共 ${result.total} 条记录，其中 ${result.withIssues} 条存在异常需要关注。`);
      navigate('/merge');
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setContent(text);
      const ext = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
      setFormat(ext);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const loadSample = () => {
    setContent(format === 'json' ? sampleJSON : sampleCSV);
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-primary-900 mb-2">
            导入原始材料
          </h1>
          <p className="text-gray-600">
            将现场会议纪要、巡查记录、投诉记录等零散材料导入系统。支持 JSON 和 CSV 格式。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-6">
              <h3 className="font-semibold text-primary-900 mb-4">选择数据源</h3>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setFormat('json')}
                  className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    format === 'json'
                      ? 'bg-accent-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <FileJson className="w-4 h-4" />
                  JSON
                </button>
                <button
                  onClick={() => setFormat('csv')}
                  className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    format === 'csv'
                      ? 'bg-accent-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV
                </button>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  dragActive
                    ? 'border-accent-500 bg-accent-50'
                    : 'border-gray-300 hover:border-accent-400 hover:bg-gray-50'
                }`}
              >
                <input
                  type="file"
                  accept={format === 'json' ? '.json' : '.csv'}
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <Upload className={`w-12 h-12 mx-auto mb-3 ${dragActive ? 'text-accent-500' : 'text-gray-400'}`} />
                  <p className="text-sm text-gray-600 mb-1">拖拽文件到此处</p>
                  <p className="text-xs text-gray-400">或点击选择 {format.toUpperCase()} 文件</p>
                </label>
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={loadSample}
                  className="text-sm text-accent-600 hover:text-accent-700 flex items-center gap-1 mx-auto"
                >
                  <Database className="w-4 h-4" />
                  加载 {format.toUpperCase()} 样例数据
                </button>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-primary-900 mb-2">数据格式说明</h3>
              <div className="text-xs text-gray-600 space-y-2">
                <p><strong>必填字段：</strong>stationName(站点名称), exitNo(出口), lat(纬度), lng(经度), timeSlot(时段), bikeCount(单车数), capacity(容量), reason(原因)</p>
                <p><strong>来源信息：</strong>source.type (inspection/complaint/meeting/old_caliber), source.name, source.date, source.rawContent</p>
                <p className="text-orange-600 bg-orange-50 p-2 rounded">
                  <strong>提示：</strong>系统会自动检测同名路口、重复投诉、坐标偏移、跨时段统计、容量超限等异常情况。
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="card p-6">
              <h3 className="font-semibold text-primary-900 mb-4">
                {format === 'json' ? '粘贴 JSON 数据' : '粘贴 CSV 数据'}
              </h3>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={format === 'json' ? sampleJSON : sampleCSV}
                className="w-full h-64 p-4 font-mono text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none bg-gray-50"
              />
              <div className="flex justify-between mt-4">
                <div className="text-xs text-gray-500">
                  {content.length > 0 && `${content.split('\n').length} 行, ${content.length} 字符`}
                </div>
                <button
                  onClick={handlePreview}
                  disabled={loading || !content.trim()}
                  className="btn-accent flex items-center gap-2"
                >
                  {loading ? '解析中...' : (
                    <>
                      预览解析结果
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">解析失败</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {previewResult && (
              <div className="card p-6 animate-slide-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-primary-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    解析预览
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">
                      共 <strong className="text-primary-900">{previewResult.total}</strong> 条
                    </span>
                    <span className="text-gray-600">
                      正常 <strong className="text-green-600">{previewResult.success - previewResult.withIssues}</strong> 条
                    </span>
                    {previewResult.withIssues > 0 && (
                      <span className="text-orange-600 font-medium">
                        ⚠ {previewResult.withIssues} 条含异常
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 text-xs font-medium text-gray-500">站点</th>
                        <th className="text-left py-2 text-xs font-medium text-gray-500">时段</th>
                        <th className="text-left py-2 text-xs font-medium text-gray-500">数量/容量</th>
                        <th className="text-left py-2 text-xs font-medium text-gray-500">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewResult.records.map((record, idx) => (
                        <tr key={idx} className={`border-b border-gray-100 ${record.conflicts.length > 0 ? 'bg-orange-50/50' : ''}`}>
                          <td className="py-2">
                            <div className="font-medium">{record.stationName}</div>
                            <div className="text-xs text-gray-500">{record.exitNo}</div>
                          </td>
                          <td className="py-2 text-gray-600">{record.timeSlot}</td>
                          <td className="py-2 font-mono">
                            {record.bikeCount}/{record.capacity}
                          </td>
                          <td className="py-2">
                            {record.conflicts.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {record.conflicts.slice(0, 2).map((c, i) => (
                                  <ConflictCard key={i} conflict={c} compact />
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-green-600">✓ 正常</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewResult.issues.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-orange-700 mb-2">检测到的异常汇总</h4>
                    <div className="max-h-48 overflow-y-auto">
                      {previewResult.issues.slice(0, 5).map((issue, idx) => (
                        <ConflictCard key={idx} conflict={issue} />
                      ))}
                      {previewResult.issues.length > 5 && (
                        <p className="text-sm text-gray-500 text-center mt-2">
                          ...还有 {previewResult.issues.length - 5} 条异常
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleImport}
                    disabled={loading}
                    className="btn-primary text-lg px-8 py-3"
                  >
                    {loading ? '导入中...' : '✓ 确认导入数据库'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

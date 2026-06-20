import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FileText, AlertTriangle, CheckCircle, Eye, X } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAppStore } from '../store/useAppStore';
import { formatDate, generateId } from '../utils/formatters';
import { detectAnomalies } from '../utils/anomalyDetector';
import { parseFile, ParsedSampleRow } from '../utils/fileParser';
import { Sample } from '../types';

const demoCsvContent = `sampleNo,currentModelVersion,category,style,scene
SAMPLE-20240603-001,v2.3.1,美妆,日常,室内
SAMPLE-20240603-002,v2.3.0,服饰,休闲,户外
SAMPLE-20240603-002,v2.3.1,服饰,商务,室内
SAMPLE-20240603-003,v2.3.1,食品,摆盘,餐桌`;

export default function BatchImport() {
  const { batches, selectedBatchId, setSelectedBatchId, addBatch, addSamples, getSamplesByBatch } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [imported, setImported] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; anomalies: number; fileName?: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [newBatchName, setNewBatchName] = useState('灰度批次 #20240603-C');
  const [newModelVersion, setNewModelVersion] = useState('v2.3.1');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentBatch = batches.find(b => b.id === selectedBatchId);
  const currentSamples = selectedBatchId ? getSamplesByBatch(selectedBatchId) : [];

  const mergeRowsAndImport = async (rows: ParsedSampleRow[], sourceFileName?: string) => {
    setImportError(null);

    if (rows.length === 0) {
      setImportError('文件中没有有效的样本数据');
      return;
    }

    const validRows = rows.filter(r => r.sampleNo && r.currentModelVersion);
    if (validRows.length === 0) {
      setImportError('文件中缺少必填字段：sampleNo 或 currentModelVersion 为空');
      return;
    }

    const groupedBySampleNo = new Map<string, ParsedSampleRow[]>();
    validRows.forEach(row => {
      const existing = groupedBySampleNo.get(row.sampleNo) || [];
      groupedBySampleNo.set(row.sampleNo, [...existing, row]);
    });

    const newBatch = addBatch({
      name: newBatchName,
      importTime: new Date().toISOString(),
      modelVersion: newModelVersion,
      totalSamples: 0,
    });

    const mergedSamples: Omit<Sample, 'id' | 'isAnomaly'>[] = [];

    groupedBySampleNo.forEach((rowsForSample, sampleNo) => {
      const versions = rowsForSample.map((row, idx) => ({
        id: `v-${generateId()}`,
        modelVersion: row.currentModelVersion,
        tags: { category: row.category, style: row.style, scene: row.scene },
        timestamp: new Date(Date.now() + idx * 60000).toISOString(),
      }));

      const lastRow = rowsForSample[rowsForSample.length - 1];

      mergedSamples.push({
        sampleNo,
        batchId: newBatch.id,
        currentModelVersion: lastRow.currentModelVersion,
        status: 'confirmed_normal',
        createdAt: new Date().toISOString(),
        versions,
        comments: [],
      });
    });

    const detected = detectAnomalies(mergedSamples as unknown as Sample[]);
    const anomalyCount = detected.filter(s => s.isAnomaly).length;
    const totalUnique = mergedSamples.length;

    addSamples(mergedSamples);

    setImportResult({ total: totalUnique, anomalies: anomalyCount, fileName: sourceFileName });
    setImported(true);
  };

  const handleDemoImport = () => {
    setIsImporting(true);
    setImportError(null);
    try {
      const lines = demoCsvContent.trim().split('\n').slice(1);
      const rows: ParsedSampleRow[] = lines.map(line => {
        const [sampleNo, currentModelVersion, category, style, scene] = line.split(',');
        return { sampleNo, currentModelVersion, category, style, scene };
      });
      mergeRowsAndImport(rows, '演示数据');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsImporting(true);
    setImported(false);
    setImportResult(null);
    setImportError(null);

    try {
      const rows = await parseFile(file);
      await mergeRowsAndImport(rows, file.name);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '文件解析失败');
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setImported(false);
    setImportResult(null);
    setImportError(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">灰度批次导入</h1>
        <p className="text-stone-500 mt-1">导入样本数据，自动检测"模型版本换了但样本编号没变"的异常</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">导入新批次</h2>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">批次名称</label>
              <input
                type="text"
                value={newBatchName}
                onChange={(e) => setNewBatchName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">模型版本</label>
              <input
                type="text"
                value={newModelVersion}
                onChange={(e) => setNewModelVersion(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
              />
            </div>
          </div>

          <div
            className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 ${
              isDragging
                ? 'border-amber-400 bg-amber-50'
                : imported
                ? 'border-emerald-300 bg-emerald-50'
                : importError
                ? 'border-red-300 bg-red-50'
                : 'border-stone-300 hover:border-amber-300 bg-stone-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {importError && (
              <button
                onClick={resetImport}
                className="absolute top-3 right-3 text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {isImporting ? (
              <div className="space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center animate-pulse">
                  <Upload className="w-8 h-8 text-amber-600" />
                </div>
                <p className="font-medium text-stone-700">正在解析文件...</p>
              </div>
            ) : importError ? (
              <div className="space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <p className="font-semibold text-stone-800">导入失败</p>
                <p className="text-sm text-red-600">{importError}</p>
                <button
                  onClick={resetImport}
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  重新上传
                </button>
              </div>
            ) : imported && importResult ? (
              <div className="space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="font-semibold text-stone-800">导入成功</p>
                {importResult.fileName && (
                  <p className="text-xs text-stone-500">来源：{importResult.fileName}</p>
                )}
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div>
                    <span className="text-stone-500">样本总数</span>
                    <p className="text-xl font-bold text-stone-800">{importResult.total}</p>
                  </div>
                  <div>
                    <span className="text-stone-500">异常样本</span>
                    <p className="text-xl font-bold text-amber-600">{importResult.anomalies}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-amber-500' : 'text-stone-400'}`} />
                <p className="font-medium text-stone-700 mb-1">拖拽 CSV/JSON 文件到这里</p>
                <p className="text-sm text-stone-500 mb-4">或点击下方按钮选择文件</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-white border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  选择文件
                </button>
                <button
                  onClick={handleDemoImport}
                  className="ml-3 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  加载演示数据
                </button>
              </>
            )}
          </div>

          <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-100">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">导入提示</p>
                <p className="mt-1 text-amber-700">
                  系统会自动检测「模型版本换了但样本编号没变」的样本，这些样本不会自动归为正常，会留给运营复核人确认。
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
            <p className="text-xs font-medium text-stone-600 mb-2">📋 文件格式说明</p>
            <div className="text-xs text-stone-500 space-y-1">
              <p><span className="font-medium">CSV 字段：</span>sampleNo, currentModelVersion, category, style, scene</p>
              <p><span className="font-medium">JSON 格式：</span>样本数组，每个元素含 sampleNo、currentModelVersion、标签字段</p>
              <p><span className="font-medium text-amber-600">异常识别：</span>同一样本编号出现多行 / 多版本即判定为异常</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-stone-800">批次选择</h2>
          </div>

          <div className="space-y-2 mb-6">
            {batches.map((batch) => (
              <button
                key={batch.id}
                onClick={() => setSelectedBatchId(batch.id)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedBatchId === batch.id
                    ? 'border-amber-400 bg-amber-50 shadow-sm'
                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-stone-800">{batch.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{formatDate(batch.importTime)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-stone-600">{batch.modelVersion}</p>
                    {batch.anomalyCount > 0 && (
                      <p className="text-xs text-amber-600 font-medium">{batch.anomalyCount} 条异常</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {currentBatch && (
            <div className="p-4 bg-stone-50 rounded-lg">
              <p className="text-sm font-medium text-stone-700 mb-2">当前批次信息</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-stone-500">样本总数</span>
                  <p className="font-semibold text-stone-800">{currentBatch.totalSamples}</p>
                </div>
                <div>
                  <span className="text-stone-500">异常数</span>
                  <p className="font-semibold text-amber-600">{currentBatch.anomalyCount}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {currentSamples.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-100">
            <h2 className="text-lg font-semibold text-stone-800">样本列表</h2>
            <p className="text-sm text-stone-500 mt-1">橙色高亮 = 模型版本换了但样本编号没变，需复核</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">样本编号</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">模型版本</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">标签</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">留言</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {currentSamples.map((sample) => (
                  <tr
                    key={sample.id}
                    className={`border-b border-stone-50 transition-colors ${
                      sample.isAnomaly ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-stone-50'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {sample.isAnomaly && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        )}
                        <span className="font-medium text-stone-800">{sample.sampleNo}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-stone-600">
                      {sample.versions.map(v => v.modelVersion).join(' → ')}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={sample.status} isAnomaly={sample.isAnomaly} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {sample.versions[sample.versions.length - 1]?.tags && Object.entries(
                          sample.versions[sample.versions.length - 1].tags
                        ).map(([k, v]) => (
                          <span key={k} className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded">
                            {v}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-stone-500">
                      {sample.comments.length > 0 ? `${sample.comments.length} 条` : '无'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/sample/${sample.id}`}
                          className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          详情
                        </Link>
                        <Link
                          to={`/review/${sample.id}`}
                          className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-700"
                        >
                          <FileText className="w-4 h-4" />
                          复盘
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

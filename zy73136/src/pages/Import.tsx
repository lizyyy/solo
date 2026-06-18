import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertTriangle, CheckCircle, XCircle, Info, ChevronRight, RefreshCw, MapPin, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { processImportLogs } from '../utils/deduplicator';
import type { BuoyLog } from '../types';
import { PARAMETER_THRESHOLDS } from '../types';

export default function Import() {
  const navigate = useNavigate();
  const { logs, importLogs, buoys } = useAppStore();

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<BuoyLog[]>([]);
  const [importResult, setImportResult] = useState<{
    total: number;
    added: number;
    duplicates: number;
    preservedRemarks: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = useCallback((text: string): BuoyLog[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const buoyIdIndex = headers.findIndex((h) => h.includes('buoy') || h.includes('浮标'));
    const timestampIndex = headers.findIndex((h) => h.includes('time') || h.includes('时间'));
    const phIndex = headers.findIndex((h) => h.includes('ph') || h.includes('ph值'));
    const doIndex = headers.findIndex((h) => h.includes('oxygen') || h.includes('溶解氧') || h.includes('do'));
    const turbidityIndex = headers.findIndex((h) => h.includes('turbidity') || h.includes('浊度'));
    const tempIndex = headers.findIndex((h) => h.includes('temp') || h.includes('温度'));
    const salinityIndex = headers.findIndex((h) => h.includes('salinity') || h.includes('盐度'));
    const ammoniaIndex = headers.findIndex((h) => h.includes('ammonia') || h.includes('氨氮'));

    const buoyMap = new Map(buoys.map((b) => [b.name.toLowerCase(), b.id]));

    const parsedLogs: BuoyLog[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      if (values.length < 2) continue;

      let buoyId = values[buoyIdIndex] || 'buoy-01';
      if (buoyMap.has(buoyId.toLowerCase())) {
        buoyId = buoyMap.get(buoyId.toLowerCase())!;
      } else if (!buoys.find((b) => b.id === buoyId)) {
        buoyId = buoys[0]?.id || 'buoy-01';
      }

      const timestamp = timestampIndex >= 0 && values[timestampIndex]
        ? new Date(values[timestampIndex]).getTime()
        : Date.now() - (i * 3600000);

      const parseFloatSafe = (val: string, defaultValue: number) => {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      const log: BuoyLog = {
        id: `log-import-${Date.now()}-${i}`,
        buoyId,
        timestamp,
        parameters: {
          ph: parseFloatSafe(values[phIndex], 7.5),
          dissolvedOxygen: parseFloatSafe(values[doIndex], 7.0),
          turbidity: parseFloatSafe(values[turbidityIndex], 10.0),
          temperature: parseFloatSafe(values[tempIndex], 20.0),
          salinity: parseFloatSafe(values[salinityIndex], 30.0),
          ammoniaNitrogen: parseFloatSafe(values[ammoniaIndex], 0.2),
        },
        anomalies: [],
        isBoundarySample: false,
        sourceRow: lines[i],
        remark: '',
      };

      parsedLogs.push(log);
    }

    return parsedLogs;
  }, [buoys]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploadedFile(file);
      setImportResult(null);
      setError(null);
      setIsProcessing(true);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = parseCSV(text);

          if (parsed.length === 0) {
            setError('未能解析到有效数据，请检查文件格式');
            setIsProcessing(false);
            return;
          }

          const result = processImportLogs(parsed, logs);
          setPreviewData(result.processedLogs);
          setImportResult({
            total: result.total,
            added: result.added,
            duplicates: result.duplicates,
            preservedRemarks: result.preservedRemarks,
          });
        } catch (err) {
          setError('文件解析失败：' + (err as Error).message);
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError('文件读取失败');
        setIsProcessing(false);
      };

      reader.readAsText(file);
    },
    [parseCSV, logs]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const handleImport = useCallback(() => {
    if (previewData.length === 0) return;

    setIsProcessing(true);
    setTimeout(() => {
      importLogs(previewData);
      setIsProcessing(false);
    }, 1000);
  }, [previewData, importLogs]);

  const handleReset = useCallback(() => {
    setUploadedFile(null);
    setPreviewData([]);
    setImportResult(null);
    setError(null);
  }, []);

  const previewStats = useMemo(() => {
    if (previewData.length === 0) return null;

    const boundaryCount = previewData.filter((l) => l.isBoundarySample).length;
    const anomalyCount = previewData.filter((l) => l.anomalies.length > 0).length;
    const withAreaCount = previewData.filter((l) => l.affectedArea).length;

    return {
      boundaryCount,
      anomalyCount,
      withAreaCount,
    };
  }, [previewData]);

  return (
    <div className="min-h-screen bg-deep-ocean pt-20 pb-8 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-orbitron text-cyan-glow glow-text flex items-center gap-3">
                <Upload size={32} />
                数据导入
              </h1>
              <p className="text-cyan-dim mt-2">
                导入浮标水质监测数据，自动去重、识别边界样本、反写经纬度影响范围
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg border border-cyan-glow/30 text-cyan-glow hover:bg-ocean-blue/30 transition-colors flex items-center gap-2"
              >
                <RefreshCw size={18} />
                重置
              </button>
              <button
                onClick={() => navigate('/logs')}
                className="px-4 py-2 rounded-lg bg-cyan-glow text-deep-ocean font-semibold hover:bg-cyan-dim transition-colors flex items-center gap-2"
              >
                查看日志
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="col-span-1"
          >
            <div className="glass-panel p-6 h-full">
              <h2 className="text-xl font-orbitron text-cyan-glow mb-4 flex items-center gap-2">
                <FileText size={20} />
                上传文件
              </h2>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  isDragActive
                    ? 'border-cyan-glow bg-cyan-glow/10'
                    : 'border-cyan-glow/30 hover:border-cyan-glow/60 hover:bg-ocean-blue/20'
                }`}
              >
                <input {...getInputProps()} />
                <Upload
                  size={48}
                  className={`mx-auto mb-4 ${isDragActive ? 'text-cyan-glow' : 'text-cyan-dim'}`}
                />
                {isDragActive ? (
                  <p className="text-cyan-glow">释放文件以上传</p>
                ) : (
                  <>
                    <p className="text-white mb-2">
                      拖拽文件到此处，或点击选择文件
                    </p>
                    <p className="text-cyan-dim text-sm">
                      支持 CSV、TXT 格式
                    </p>
                  </>
                )}
              </div>

              {uploadedFile && (
                <div className="mt-4 p-3 rounded-lg bg-ocean-blue/30 border border-cyan-glow/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-cyan-glow" />
                      <span className="text-white text-sm truncate max-w-[180px]">
                        {uploadedFile.name}
                      </span>
                    </div>
                    <span className="text-cyan-dim text-xs font-roboto-mono">
                      {(uploadedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="mt-4 flex items-center gap-2 text-cyan-glow">
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-sm">正在处理...</span>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-anomaly-red/10 border border-anomaly-red/30">
                  <div className="flex items-center gap-2 text-anomaly-red">
                    <XCircle size={16} />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}

              {importResult && (
                <div className="mt-4 space-y-3">
                  <h3 className="text-cyan-glow font-semibold flex items-center gap-2">
                    <Info size={16} />
                    导入预览
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-cyan-dim">解析总数</span>
                      <span className="text-white font-roboto-mono">
                        {importResult.total} 条
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-normal-green flex items-center gap-1">
                        <CheckCircle size={14} />
                        新增记录
                      </span>
                      <span className="text-normal-green font-roboto-mono">
                        {importResult.added} 条
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-warning-orange flex items-center gap-1">
                        <AlertTriangle size={14} />
                        重复记录
                      </span>
                      <span className="text-warning-orange font-roboto-mono">
                        {importResult.duplicates} 条
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cyan-glow flex items-center gap-1">
                        <Layers size={14} />
                        保留备注
                      </span>
                      <span className="text-cyan-glow font-roboto-mono">
                        {importResult.preservedRemarks} 条
                      </span>
                    </div>
                  </div>

                  {previewStats && (
                    <div className="pt-3 border-t border-cyan-glow/20 space-y-2">
                      {previewStats.boundaryCount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-warning-orange">边界样本</span>
                          <span className="text-warning-orange font-roboto-mono">
                            {previewStats.boundaryCount} 条
                          </span>
                        </div>
                      )}
                      {previewStats.anomalyCount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-anomaly-red">异常记录</span>
                          <span className="text-anomaly-red font-roboto-mono">
                            {previewStats.anomalyCount} 条
                          </span>
                        </div>
                      )}
                      {previewStats.withAreaCount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-cyan-glow flex items-center gap-1">
                            <MapPin size={14} />
                            影响范围
                          </span>
                          <span className="text-cyan-glow font-roboto-mono">
                            {previewStats.withAreaCount} 条
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleImport}
                    disabled={isProcessing || importResult.added === 0}
                    className="w-full mt-4 px-4 py-3 rounded-lg bg-cyan-glow text-deep-ocean font-semibold hover:bg-cyan-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        导入中...
                      </>
                    ) : importResult.added === 0 ? (
                      '无新增记录'
                    ) : (
                      <>
                        <Upload size={18} />
                        确认导入 {importResult.added} 条记录
                      </>
                    )}
                  </button>

                  {importResult.added === 0 && importResult.duplicates > 0 && (
                    <p className="text-center text-warning-orange text-sm mt-2">
                      所有记录均为重复数据，已自动跳过
                    </p>
                  )}
                </div>
              )}

              <div className="mt-6 p-4 rounded-lg bg-ocean-blue/20 border border-cyan-glow/20">
                <h4 className="text-cyan-glow text-sm font-semibold mb-2 flex items-center gap-2">
                  <Info size={14} />
                  导入说明
                </h4>
                <ul className="text-cyan-dim text-xs space-y-1">
                  <li>• 自动识别重复记录，避免数据翻倍</li>
                  <li>• 保留已有记录的人工备注不被覆盖</li>
                  <li>• 自动检测边界样本（非标准格式数据）</li>
                  <li>• 自动计算并反写经纬度影响范围</li>
                  <li>• 保留原始数据行，便于追溯来源</li>
                </ul>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="col-span-2"
          >
            <div className="glass-panel p-6 h-full">
              <h2 className="text-xl font-orbitron text-cyan-glow mb-4 flex items-center gap-2">
                <FileText size={20} />
                数据预览
                {previewData.length > 0 && (
                  <span className="text-sm text-cyan-dim font-roboto-mono ml-2">
                    共 {previewData.length} 条
                  </span>
                )}
              </h2>

              <AnimatePresence>
                {previewData.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-96 flex flex-col items-center justify-center text-cyan-dim"
                  >
                    <FileText size={64} className="mb-4 opacity-30" />
                    <p className="text-lg">上传文件后查看预览数据</p>
                    <p className="text-sm mt-2">
                      支持的字段：浮标ID、时间、pH、溶解氧、浊度、温度、盐度、氨氮
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="overflow-x-auto max-h-[600px] overflow-y-auto"
                  >
                    <table className="w-full">
                      <thead className="bg-ocean-blue/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-cyan-dim text-xs font-semibold">
                            #
                          </th>
                          <th className="px-3 py-2 text-left text-cyan-dim text-xs font-semibold">
                            时间
                          </th>
                          <th className="px-3 py-2 text-left text-cyan-dim text-xs font-semibold">
                            浮标
                          </th>
                          <th className="px-3 py-2 text-left text-cyan-dim text-xs font-semibold">
                            pH
                          </th>
                          <th className="px-3 py-2 text-left text-cyan-dim text-xs font-semibold">
                            溶解氧
                          </th>
                          <th className="px-3 py-2 text-left text-cyan-dim text-xs font-semibold">
                            浊度
                          </th>
                          <th className="px-3 py-2 text-left text-cyan-dim text-xs font-semibold">
                            状态
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 50).map((log, index) => {
                          const buoy = buoys.find((b) => b.id === log.buoyId);
                          const date = new Date(log.timestamp);
                          const hasAnomaly = log.anomalies.length > 0;

                          const checkParam = (
                            key: keyof typeof PARAMETER_THRESHOLDS,
                            value: number
                          ) => {
                            const info = PARAMETER_THRESHOLDS[key];
                            const isExceed =
                              value > info.max ||
                              (key === 'ph' && value < info.min) ||
                              (key === 'dissolvedOxygen' && value < info.min);
                            return isExceed;
                          };

                          return (
                            <tr
                              key={log.id}
                              className={`border-t border-cyan-glow/10 ${
                                log.isBoundarySample
                                  ? 'bg-warning-orange/10'
                                  : hasAnomaly
                                  ? 'bg-anomaly-red/5'
                                  : 'hover:bg-ocean-blue/10'
                              }`}
                            >
                              <td className="px-3 py-2 text-cyan-dim text-xs font-roboto-mono">
                                {index + 1}
                              </td>
                              <td className="px-3 py-2 text-white text-xs font-roboto-mono">
                                {date.getMonth() + 1}/{date.getDate()}{' '}
                                {date.getHours().toString().padStart(2, '0')}:{date.getMinutes().toString().padStart(2, '0')}
                              </td>
                              <td className="px-3 py-2 text-white text-xs">
                                {buoy?.name || log.buoyId}
                              </td>
                              <td
                                className={`px-3 py-2 text-xs font-roboto-mono ${
                                  checkParam('ph', log.parameters.ph)
                                    ? 'text-anomaly-red'
                                    : 'text-white'
                                }`}
                              >
                                {log.parameters.ph.toFixed(2)}
                              </td>
                              <td
                                className={`px-3 py-2 text-xs font-roboto-mono ${
                                  checkParam(
                                    'dissolvedOxygen',
                                    log.parameters.dissolvedOxygen
                                  )
                                    ? 'text-anomaly-red'
                                    : 'text-white'
                                }`}
                              >
                                {log.parameters.dissolvedOxygen.toFixed(2)}
                              </td>
                              <td
                                className={`px-3 py-2 text-xs font-roboto-mono ${
                                  checkParam('turbidity', log.parameters.turbidity)
                                    ? 'text-anomaly-red'
                                    : 'text-white'
                                }`}
                              >
                                {log.parameters.turbidity.toFixed(2)}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  {log.isBoundarySample && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-warning-orange/20 text-warning-orange">
                                      边界
                                    </span>
                                  )}
                                  {hasAnomaly && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-anomaly-red/20 text-anomaly-red">
                                      异常
                                    </span>
                                  )}
                                  {log.affectedArea && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-glow/20 text-cyan-glow">
                                      范围
                                    </span>
                                  )}
                                  {!log.isBoundarySample && !hasAnomaly && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-normal-green/20 text-normal-green">
                                      正常
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {previewData.length > 50 && (
                      <div className="text-center text-cyan-dim text-sm py-2">
                        ... 还有 {previewData.length - 50} 条记录未显示
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

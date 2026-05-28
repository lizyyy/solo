import { useState, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  X,
  ChevronRight,
  Info,
  Eye,
  Database,
  RefreshCw,
  AlertCircle,
  Table,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import {
  analyzeFile,
  parseExcelFile,
  parseNetValueFile,
  parseRedemptionFile,
  parseWarningLineFile,
  type FileCategory,
  type ImportPreview,
} from '../services/fileParser';

interface FileUpload {
  id: string;
  file: File;
  name: string;
  category: FileCategory;
  status: 'analyzing' | 'preview' | 'importing' | 'success' | 'error';
  progress: number;
  preview?: ImportPreview;
  parseResult?: {
    data: unknown[];
    rawData: Record<string, unknown>[];
    warnings: string[];
  };
  importResult?: {
    updatedProducts: string[];
    anomalies: string[];
    warnings: string[];
  };
  error?: string;
}

const fileTypes = [
  {
    id: 'netvalue' as FileCategory,
    name: '产品净值表',
    description: '包含产品代码、净值日期、单位净值等字段',
    icon: FileSpreadsheet,
  },
  {
    id: 'redemption' as FileCategory,
    name: '申赎状态表',
    description: '包含产品代码、申赎状态、限制说明等字段',
    icon: FileSpreadsheet,
  },
  {
    id: 'warning' as FileCategory,
    name: '预警线配置表',
    description: '包含产品代码、预警线、止损线等字段',
    icon: FileSpreadsheet,
  },
  {
    id: 'valuation' as FileCategory,
    name: '持仓估值表',
    description: '包含持仓名称、市值、占比等字段',
    icon: FileSpreadsheet,
  },
];

const categoryLabels: Record<FileCategory, string> = {
  netvalue: '产品净值',
  valuation: '持仓估值',
  redemption: '申赎状态',
  warning: '预警线配置',
  unknown: '未知类型',
};

export default function Import() {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  
  const importNetValues = useStore((state) => state.importNetValues);
  const importRedemptions = useStore((state) => state.importRedemptions);
  const importWarningLines = useStore((state) => state.importWarningLines);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = async (file: File): Promise<FileUpload> => {
    const uploadId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const upload: FileUpload = {
      id: uploadId,
      file,
      name: file.name,
      category: 'unknown',
      status: 'analyzing',
      progress: 10,
    };

    try {
      const preview = await analyzeFile(file);
      upload.category = preview.category;
      upload.preview = preview;
      upload.status = 'preview';
      upload.progress = 50;

      const rawData = await parseExcelFile(file);
      
      if (preview.category === 'netvalue') {
        const result = await parseNetValueFile(rawData);
        upload.parseResult = {
          data: result.data,
          rawData,
          warnings: result.warnings,
        };
      } else if (preview.category === 'redemption') {
        const result = await parseRedemptionFile(rawData);
        upload.parseResult = {
          data: result.data,
          rawData,
          warnings: result.warnings,
        };
      } else if (preview.category === 'warning') {
        const result = await parseWarningLineFile(rawData);
        upload.parseResult = {
          data: result.data,
          rawData,
          warnings: result.warnings,
        };
      } else {
        upload.parseResult = {
          data: rawData,
          rawData,
          warnings: ['无法自动识别文件类型，请手动确认'],
        };
      }
    } catch (error) {
      upload.status = 'error';
      upload.error = error instanceof Error ? error.message : '文件解析失败';
    }

    return upload;
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    for (const file of droppedFiles) {
      const upload = await processFile(file);
      setFiles((prev) => [...prev, upload]);
    }
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    for (const file of selectedFiles) {
      const upload = await processFile(file);
      setFiles((prev) => [...prev, upload]);
    }
    e.target.value = '';
  }, []);

  const handleImport = async (uploadId: string) => {
    const upload = files.find((f) => f.id === uploadId);
    if (!upload || !upload.parseResult) return;

    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadId ? { ...f, status: 'importing', progress: 70 } : f
      )
    );

    try {
      let result;
      
      if (upload.category === 'netvalue') {
        result = importNetValues(
          upload.parseResult.data as Parameters<typeof importNetValues>[0],
          upload.name,
          upload.parseResult.rawData
        );
      } else if (upload.category === 'redemption') {
        result = importRedemptions(
          upload.parseResult.data as Parameters<typeof importRedemptions>[0],
          upload.name,
          upload.parseResult.rawData
        );
      } else if (upload.category === 'warning') {
        result = importWarningLines(
          upload.parseResult.data as Parameters<typeof importWarningLines>[0],
          upload.name,
          upload.parseResult.rawData
        );
      } else {
        throw new Error('不支持的文件类型');
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadId
            ? {
                ...f,
                status: 'success',
                progress: 100,
                importResult: {
                  updatedProducts: result.updatedProducts,
                  anomalies: result.anomalies.map((a) => a.description),
                  warnings: result.warnings,
                },
              }
            : f
        )
      );
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadId
            ? {
                ...f,
                status: 'error',
                error: error instanceof Error ? error.message : '导入失败',
              }
            : f
        )
      );
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const previewCount = files.filter((f) => f.status === 'preview').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">数据导入</h1>
        <p className="text-sm text-gray-500 mt-1">
          导入净值、估值、申赎等数据，系统将保留原始口径并进行异常检测
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              dragActive
                ? 'border-navy-500 bg-navy-50'
                : 'border-gray-300 hover:border-gray-400'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload
              className={cn(
                'w-12 h-12 mx-auto mb-4',
                dragActive ? 'text-navy-500' : 'text-gray-400'
              )}
            />
            <p className="text-lg font-medium text-gray-700 mb-2">
              拖拽文件到此处，或
            </p>
            <label className="inline-block px-4 py-2 bg-navy-600 text-white rounded-lg cursor-pointer hover:bg-navy-700 transition-colors">
              选择文件
              <input
                type="file"
                multiple
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
            <p className="text-sm text-gray-500 mt-3">
              支持 .xlsx, .xls, .csv 格式
            </p>
          </div>

          {files.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  已上传 {files.length} 个文件
                </h3>
                <div className="flex items-center gap-4 text-sm">
                  {previewCount > 0 && (
                    <span className="flex items-center gap-1 text-info">
                      <Eye className="w-4 h-4" />
                      {previewCount} 待确认
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle className="w-4 h-4" />
                    {successCount} 成功
                  </span>
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1 text-danger">
                      <AlertTriangle className="w-4 h-4" />
                      {errorCount} 失败
                    </span>
                  )}
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {files.map((file) => (
                  <div key={file.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'p-2 rounded-lg',
                          file.status === 'success'
                            ? 'bg-success/10'
                            : file.status === 'error'
                            ? 'bg-danger/10'
                            : file.status === 'preview'
                            ? 'bg-info/10'
                            : 'bg-gray-100'
                        )}
                      >
                        <FileSpreadsheet
                          className={cn(
                            'w-5 h-5',
                            file.status === 'success'
                              ? 'text-success'
                              : file.status === 'error'
                              ? 'text-danger'
                              : file.status === 'preview'
                              ? 'text-info'
                              : 'text-gray-500'
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 truncate">
                            {file.name}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {categoryLabels[file.category]}
                          </span>
                        </div>
                        
                        {file.status === 'analyzing' && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2 text-sm text-info">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              正在解析文件...
                            </div>
                            <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-navy-500 transition-all duration-300"
                                style={{ width: `${file.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {file.status === 'importing' && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2 text-sm text-info">
                              <Database className="w-4 h-4 animate-pulse" />
                              正在导入数据...
                            </div>
                            <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-navy-500 transition-all duration-300"
                                style={{ width: `${file.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {file.status === 'preview' && file.preview && (
                          <div className="mt-2 space-y-2">
                            <div className="text-sm text-gray-600">
                              <span className="text-gray-500">检测到 </span>
                              <span className="font-medium">{file.preview.recordCount}</span>
                              <span className="text-gray-500"> 条记录，涉及 </span>
                              <span className="font-medium">{file.preview.affectedProducts.length}</span>
                              <span className="text-gray-500"> 个产品</span>
                            </div>
                            {file.parseResult?.warnings && file.parseResult.warnings.length > 0 && (
                              <div className="flex items-start gap-1 text-sm text-warning">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{file.parseResult.warnings[0]}</span>
                              </div>
                            )}
                            {file.preview.anomalies.length > 0 && (
                              <div className="flex items-start gap-1 text-sm text-danger">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>检测到 {file.preview.anomalies.length} 个异常</span>
                              </div>
                            )}
                          </div>
                        )}

                        {file.status === 'success' && file.importResult && (
                          <div className="mt-2 space-y-1">
                            <div className="text-sm text-success">
                              ✓ 成功更新 {file.importResult.updatedProducts.length} 个产品
                            </div>
                            {file.importResult.anomalies.length > 0 && (
                              <div className="text-sm text-warning">
                                ⚠ 检测到 {file.importResult.anomalies.length} 个异常
                              </div>
                            )}
                            {file.importResult.warnings.length > 0 && (
                              <div className="text-sm text-gray-500">
                                {file.importResult.warnings.length} 条提示
                              </div>
                            )}
                          </div>
                        )}

                        {file.status === 'error' && file.error && (
                          <p className="text-sm text-danger mt-2">{file.error}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {file.status === 'preview' && (
                          <>
                            <button
                              onClick={() => setShowPreview(showPreview === file.id ? null : file.id)}
                              className="p-2 hover:bg-gray-100 rounded transition-colors"
                              title="预览数据"
                            >
                              <Table className="w-5 h-5 text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleImport(file.id)}
                              className="px-4 py-2 bg-navy-600 text-white text-sm rounded-lg hover:bg-navy-700 transition-colors"
                            >
                              确认导入
                            </button>
                          </>
                        )}
                        {file.status !== 'analyzing' && file.status !== 'importing' && (
                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-2 hover:bg-gray-100 rounded transition-colors"
                          >
                            <X className="w-5 h-5 text-gray-400" />
                          </button>
                        )}
                      </div>
                    </div>

                    {showPreview === file.id && file.preview && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">数据预览（前5条）</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-100">
                                {file.preview.detectedColumns.slice(0, 6).map((col) => (
                                  <th key={col} className="px-2 py-2 text-left text-gray-600 font-medium">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {file.preview.sampleData.map((row, idx) => (
                                <tr key={idx} className="border-b border-gray-200">
                                  {file.preview!.detectedColumns.slice(0, 6).map((col) => (
                                    <td key={col} className="px-2 py-2 text-gray-700 truncate max-w-32">
                                      {String(row[col] ?? '')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 text-xs text-gray-500">
                          <p>原始口径已保留，可在历史记录中查看</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">支持的文件类型</h3>
            </div>
            <div className="p-4 space-y-3">
              {fileTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <div
                    key={type.id}
                    className="p-4 bg-gray-50 rounded-lg flex items-start gap-4"
                  >
                    <div className="p-2 bg-navy-100 rounded-lg">
                      <Icon className="w-5 h-5 text-navy-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{type.name}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">导入说明</h3>
            </div>
            <div className="p-4">
              <div className="p-3 bg-navy-50 rounded-lg flex items-start gap-3">
                <Info className="w-5 h-5 text-navy-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-navy-700">
                  <p className="font-medium mb-2">数据处理规则</p>
                  <ul className="space-y-2 text-navy-600">
                    <li className="flex items-start gap-2">
                      <Database className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>原始数据完整保留，可追溯来源</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>手工备注不会被导入覆盖</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>自动检测：日期错位、预警线变更、暂停赎回</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Eye className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>所有操作记录版本历史，可回溯对比</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-warning/5 rounded-lg border border-warning/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-warning-700">
                    <p className="font-medium">注意</p>
                    <p className="mt-1">导入前请确认数据列名正确，系统会自动匹配常见别名</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

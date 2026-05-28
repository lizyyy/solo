import { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  X,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

interface FileUpload {
  id: string;
  name: string;
  type: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  records?: number;
}

const fileTypes = [
  {
    id: 'netvalue',
    name: '产品净值表',
    description: '包含产品代码、净值日期、单位净值等字段',
    icon: FileSpreadsheet,
  },
  {
    id: 'valuation',
    name: '持仓估值表',
    description: '包含持仓名称、市值、占比等字段',
    icon: FileSpreadsheet,
  },
  {
    id: 'redemption',
    name: '申赎状态表',
    description: '包含产品代码、申赎状态、限制说明等字段',
    icon: FileSpreadsheet,
  },
  {
    id: 'warning',
    name: '预警线配置表',
    description: '包含产品代码、预警线、止损线等字段',
    icon: FileSpreadsheet,
  },
];

export default function Import() {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const recordVersion = useStore((state) => state.recordVersion);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    simulateUpload(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    simulateUpload(selectedFiles);
    e.target.value = '';
  };

  const simulateUpload = (fileList: File[]) => {
    const newFiles: FileUpload[] = fileList.map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      name: file.name,
      type: file.name.includes('净值')
        ? 'netvalue'
        : file.name.includes('估值')
        ? 'valuation'
        : file.name.includes('申赎')
        ? 'redemption'
        : 'warning',
      status: 'uploading',
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((file, index) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          
          const isSuccess = Math.random() > 0.2;
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    status: isSuccess ? 'success' : 'error',
                    progress: 100,
                    records: isSuccess ? Math.floor(Math.random() * 50) + 10 : undefined,
                    error: isSuccess ? undefined : '数据格式不匹配，请检查文件模板',
                  }
                : f
            )
          );

          if (isSuccess) {
            recordVersion(
              'p001',
              'import',
              {},
              { fileName: file.name },
              `导入${file.name}成功`
            );
          }
        } else {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, progress: Math.floor(progress) } : f
            )
          );
        }
      }, 300 + index * 100);
    });
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

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
                  <div key={file.id} className="p-4 flex items-center gap-4">
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        file.status === 'success'
                          ? 'bg-success/10'
                          : file.status === 'error'
                          ? 'bg-danger/10'
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
                            : 'text-gray-500'
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 truncate">
                          {file.name}
                        </span>
                        {file.status === 'success' && (
                          <span className="text-xs text-gray-500">
                            ({file.records} 条记录)
                          </span>
                        )}
                      </div>
                      {file.status === 'uploading' && (
                        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-navy-500 transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      )}
                      {file.status === 'error' && (
                        <p className="text-sm text-danger mt-1">{file.error}</p>
                      )}
                    </div>
                    {file.status !== 'uploading' && (
                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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

          <div className="p-4 border-t border-gray-200">
            <div className="p-3 bg-navy-50 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-navy-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-navy-700">
                <p className="font-medium mb-1">导入说明</p>
                <ul className="space-y-1 text-navy-600">
                  <li>• 导入数据将保留原始口径，不会覆盖手工备注</li>
                  <li>• 系统自动检测异常：日期错位、预警线变更等</li>
                  <li>• 所有导入操作均会记录版本历史</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

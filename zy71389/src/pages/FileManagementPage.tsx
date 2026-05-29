import React, { useCallback, useRef, useState } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  FolderOpen,
  Plus,
  Database,
  AlertTriangle
} from 'lucide-react';
import { PageHeader, Card, EmptyState } from '../components/layout/MainLayout';
import { ContaminationBadge, ProcessStatusBadge } from '../components/common/StatusBadge';
import { LogViewer } from '../components/common/LogViewer';
import { useFileStore } from '../stores/fileStore';
import { FileType, LogEntry, ProcessStatus } from '../types';
import { formatFileSize, formatTimestamp } from '../utils/format';
import { mockSampleCSVFiles } from '../data/mockData';
import { FileParserEngine, FileParseResult } from '../engines/FileParserEngine';

export const FileManagementPage: React.FC = () => {
  const {
    files,
    userBuckets,
    exposureLogs,
    operationChanges,
    conversionData,
    parseLogs,
    uploadFile,
    uploadDirectory,
    removeFile,
    clearAllData,
    addParseLog,
    processFiles,
    isScanning
  } = useFileStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  
  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info', details?: string) => {
    addParseLog({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      message,
      details
    });
  }, [addParseLog]);
  
  const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    addLog(`开始处理 ${selectedFiles.length} 个文件...`);
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      try {
        await uploadFile(file);
      } catch (error) {
        addLog(`处理文件时出错: ${file.name}`, 'error',
          error instanceof Error ? error.message : '未知错误');
      }
    }
    
    addLog(`全部文件处理完成`, 'success');
  }, [addLog, uploadFile]);
  
  const handleDirectorySelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    const filesArray = Array.from(selectedFiles);
    await uploadDirectory(filesArray);
  }, [uploadDirectory]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);
  
  const handleRemoveFile = useCallback((fileId: string) => {
    removeFile(fileId);
    addLog(`已移除文件`, 'info');
  }, [removeFile, addLog]);
  
  const downloadSampleFile = useCallback((type: FileType) => {
    const sampleMap: Record<FileType, string> = {
      [FileType.USER_BUCKET]: mockSampleCSVFiles.userBuckets,
      [FileType.EXPOSURE_LOG]: mockSampleCSVFiles.exposureLogs,
      [FileType.OPERATION_CHANGE]: mockSampleCSVFiles.operationChanges,
      [FileType.CONVERSION_DATA]: mockSampleCSVFiles.conversionData,
      [FileType.EXPERIMENT_CONFIG]: mockSampleCSVFiles.experimentConfig,
      [FileType.CONTAMINATION_REPORT]: '',
      [FileType.UNKNOWN]: ''
    };
    
    const content = sampleMap[type];
    const filenameMap: Record<FileType, string> = {
      [FileType.USER_BUCKET]: 'user_buckets_sample.csv',
      [FileType.EXPOSURE_LOG]: 'exposure_logs_sample.csv',
      [FileType.OPERATION_CHANGE]: 'operation_changes_sample.csv',
      [FileType.CONVERSION_DATA]: 'conversion_data_sample.csv',
      [FileType.EXPERIMENT_CONFIG]: 'experiment_config_sample.csv',
      [FileType.CONTAMINATION_REPORT]: 'contamination_report_sample.csv',
      [FileType.UNKNOWN]: 'sample.csv'
    };
    
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameMap[type];
    link.click();
    URL.revokeObjectURL(url);
    
    addLog(`已下载样本文件: ${filenameMap[type]}`, 'success');
    setShowSampleModal(false);
  }, [addLog]);
  
  const fileTypeLabels: Record<FileType, string> = {
    [FileType.USER_BUCKET]: '用户分桶',
    [FileType.EXPOSURE_LOG]: '曝光日志',
    [FileType.OPERATION_CHANGE]: '运营变更',
    [FileType.CONVERSION_DATA]: '转化数据',
    [FileType.EXPERIMENT_CONFIG]: '实验配置',
    [FileType.CONTAMINATION_REPORT]: '污染报告',
    [FileType.UNKNOWN]: '未知类型'
  };
  
  const fileTypeColors: Record<FileType, string> = {
    [FileType.USER_BUCKET]: 'bg-primary-100 text-primary-700',
    [FileType.EXPOSURE_LOG]: 'bg-success-100 text-success-700',
    [FileType.OPERATION_CHANGE]: 'bg-warning-100 text-warning-700',
    [FileType.CONVERSION_DATA]: 'bg-info-100 text-info-700',
    [FileType.EXPERIMENT_CONFIG]: 'bg-purple-100 text-purple-700',
    [FileType.CONTAMINATION_REPORT]: 'bg-orange-100 text-orange-700',
    [FileType.UNKNOWN]: 'bg-gray-100 text-gray-700'
  };
  
  const dataCounts = [
    { type: FileType.USER_BUCKET, label: '用户分桶', count: userBuckets.length, icon: <Database className="w-5 h-5" /> },
    { type: FileType.EXPOSURE_LOG, label: '曝光日志', count: exposureLogs.length, icon: <FileText className="w-5 h-5" /> },
    { type: FileType.OPERATION_CHANGE, label: '运营变更', count: operationChanges.length, icon: <AlertTriangle className="w-5 h-5" /> },
    { type: FileType.CONVERSION_DATA, label: '转化数据', count: conversionData.length, icon: <FileText className="w-5 h-5" /> },
  ];
  
  return (
    <div>
      <PageHeader
        title="文件管理"
        description="上传实验数据文件，支持CSV、Excel、JSON格式，可批量上传整个目录"
        breadcrumbs={[{ label: '首页', path: '/' }, { label: '文件管理' }]}
        actions={
          <>
            <button
              onClick={() => directoryInputRef.current?.click()}
              disabled={isScanning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FolderOpen className="w-4 h-4" />
              上传目录
            </button>
            <button
              onClick={() => setShowSampleModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              下载样本
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              上传文件
            </button>
          </>
        }
      />
      
      {/* Data Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {dataCounts.map((item) => (
          <Card key={item.type} className="flex items-center gap-4">
            <div className={`p-2.5 rounded-lg ${fileTypeColors[item.type]}`}>
              {item.icon}
            </div>
            <div>
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-xl font-bold font-mono text-gray-900">{item.count.toLocaleString()}</p>
            </div>
          </Card>
        ))}
      </div>
      
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-6 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        }`}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
          <Upload className="w-8 h-8 text-primary-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          拖拽文件到此处或点击上传
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          支持 CSV、Excel (.xlsx, .xls)、JSON 格式，可一次上传多个文件
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
          <span>用户分桶</span>
          <span>曝光日志</span>
          <span>运营变更</span>
          <span>转化数据</span>
        </div>
      </div>
      
      {/* File List */}
      <Card
        title="已上传文件"
        subtitle={`${files.length} 个文件已上传`}
        actions={
          files.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={processFiles}
                disabled={isScanning}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? '处理中...' : '重新处理'}
              </button>
              <button
                onClick={clearAllData}
                className="text-sm text-danger-600 hover:text-danger-700 font-medium"
              >
                清空全部
              </button>
            </div>
          )
        }
      >
        {files.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title="暂无上传文件"
            description="上传用户分桶、曝光日志、运营变更、转化数据等文件开始检查"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    文件名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    类型
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    大小
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    记录数
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    上传时间
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-900 font-medium truncate">
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${fileTypeColors[file.type]}`}>
                        {fileTypeLabels[file.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {file.rowCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <ProcessStatusBadge status={file.status} />
                      {file.errorMessage && (
                        <p className="text-xs text-danger-600 mt-1">{file.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatTimestamp(file.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      
      {/* Log Viewer */}
      <div className="mt-6">
        <LogViewer logs={parseLogs} title="解析日志" maxHeight="300px" />
      </div>
      
      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.json"
        className="hidden"
        onChange={(e) => {
          handleFileSelect(e.target.files);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />
      
      <input
        ref={directoryInputRef}
        type="file"
        multiple
        // @ts-ignore - webkitdirectory is a non-standard attribute
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={(e) => {
          handleDirectorySelect(e.target.files);
          if (directoryInputRef.current) directoryInputRef.current.value = '';
        }}
      />
      
      {/* Sample File Modal */}
      {showSampleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">下载样本文件</h3>
            <p className="text-sm text-gray-500 mb-4">
              选择需要的样本文件类型，了解各数据文件的格式要求
            </p>
            <div className="space-y-2">
              {[FileType.USER_BUCKET, FileType.EXPOSURE_LOG, FileType.OPERATION_CHANGE, FileType.CONVERSION_DATA].map((type) => (
                <button
                  key={type}
                  onClick={() => downloadSampleFile(type)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-primary-300 transition-colors text-left"
                >
                  <div className={`p-2 rounded-lg ${fileTypeColors[type]}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{fileTypeLabels[type]}</p>
                    <p className="text-xs text-gray-500">CSV 格式样本</p>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 ml-auto" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSampleModal(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

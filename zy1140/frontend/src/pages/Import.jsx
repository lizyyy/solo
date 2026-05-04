import { useState, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  FileCode, 
  FileSpreadsheet,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  Info
} from 'lucide-react';
import useStore from '../store';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingOverlay, Spinner } from '../components/ui/Loading';
import { Badge } from '../components/ui/Badge';
import { cn } from '../utils/cn';

const fileTypeIcons = {
  xml: FileCode,
  gpx: FileText,
  csv: FileSpreadsheet,
  json: FileCode,
  unknown: FileText,
};

const fileTypeColors = {
  xml: 'text-orange-500',
  gpx: 'text-green-500',
  csv: 'text-blue-500',
  json: 'text-purple-500',
  unknown: 'text-gray-500',
};

const Import = () => {
  const { 
    importHistory, 
    importLoading, 
    fetchImportHistory, 
    uploadFiles,
    showNotification,
  } = useStore();
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);
  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }, []);
  
  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };
  
  const addFiles = (files) => {
    const newFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: detectFileType(file.name),
      status: 'pending',
    }));
    
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };
  
  const detectFileType = (filename) => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.xml')) return 'xml';
    if (lower.endsWith('.gpx')) return 'gpx';
    if (lower.endsWith('.csv')) return 'csv';
    if (lower.endsWith('.json')) return 'json';
    return 'unknown';
  };
  
  const removeFile = (id) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };
  
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      showNotification('请选择要上传的文件', 'warning');
      return;
    }
    
    try {
      const files = selectedFiles.map(f => f.file);
      await uploadFiles(files, (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress({ current: progress });
      });
      setSelectedFiles([]);
      setUploadProgress({});
      await fetchImportHistory();
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };
  
  const statusIcons = {
    pending: Clock,
    uploading: Spinner,
    success: CheckCircle,
    error: AlertCircle,
  };
  
  const statusColors = {
    pending: 'text-gray-400',
    uploading: 'text-blue-500',
    success: 'text-green-500',
    error: 'text-red-500',
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">数据导入</h1>
        <Button variant="outline" onClick={() => fetchImportHistory()}>
          刷新历史
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                上传文件
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                支持 Apple Health export.xml、GPX 路线、daily-notes.csv、thresholds.json
              </p>
            </div>
            <div className="flex gap-2">
              {selectedFiles.length > 0 && (
                <Button variant="outline" onClick={() => setSelectedFiles([])}>
                  清空
                </Button>
              )}
              <Button 
                onClick={handleUpload} 
                loading={importLoading}
                disabled={selectedFiles.length === 0}
              >
                <Upload className="w-4 h-4 mr-2" />
                导入 ({selectedFiles.length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            )}
          >
            <Upload className={cn(
              'w-12 h-12 mx-auto mb-4',
              dragActive ? 'text-blue-500' : 'text-gray-400'
            )} />
            <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
              拖拽文件到此处，或
              <label className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline ml-1">
                点击选择文件
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".xml,.gpx,.csv,.json"
                  onChange={handleFileInput}
                />
              </label>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              支持的格式: .xml, .gpx, .csv, .json
            </p>
          </div>
          
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                已选择 {selectedFiles.length} 个文件
              </p>
              {selectedFiles.map((fileItem) => {
                const Icon = fileTypeIcons[fileItem.type] || fileTypeIcons.unknown;
                const StatusIcon = statusIcons[fileItem.status];
                
                return (
                  <div
                    key={fileItem.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={cn(
                        'w-8 h-8 flex-shrink-0',
                        fileTypeColors[fileItem.type] || fileTypeColors.unknown
                      )} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {fileItem.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(fileItem.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={fileItem.type === 'unknown' ? 'warning' : 'default'}>
                        {fileItem.type.toUpperCase()}
                      </Badge>
                      <StatusIcon className={cn(
                        'w-5 h-5',
                        statusColors[fileItem.status],
                        fileItem.status === 'uploading' && 'animate-spin'
                      )} />
                      <button
                        onClick={() => removeFile(fileItem.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            支持的文件类型
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                type: 'export.xml',
                icon: FileCode,
                color: 'text-orange-500',
                bgColor: 'bg-orange-50 dark:bg-orange-900/20',
                desc: 'Apple Health 导出的主数据文件，包含步数、心率、睡眠等记录',
              },
              {
                type: '*.gpx',
                icon: FileText,
                color: 'text-green-500',
                bgColor: 'bg-green-50 dark:bg-green-900/20',
                desc: '运动路线文件，包含 GPS 轨迹、心率、步频等运动细节',
              },
              {
                type: 'daily-notes.csv',
                icon: FileSpreadsheet,
                color: 'text-blue-500',
                bgColor: 'bg-blue-50 dark:bg-blue-900/20',
                desc: '自定义每日备注，记录熬夜、喝酒、出差、生病等影响因素',
              },
              {
                type: 'thresholds.json',
                icon: FileCode,
                color: 'text-purple-500',
                bgColor: 'bg-purple-50 dark:bg-purple-900/20',
                desc: '阈值配置文件，自定义睡眠、心率、步数等异常检测阈值',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.type} className={cn('p-4 rounded-lg', item.bgColor)}>
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className={cn('w-6 h-6', item.color)} />
                    <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                      {item.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              导入历史
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          {(!importHistory || importHistory.length === 0) ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无导入历史</p>
            </div>
          ) : (
            <div className="space-y-3">
              {importHistory.map((record, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {record.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {record.fileName || record.name || '未知文件'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(record.createdAt || record.timestamp || Date.now()).toLocaleString('zh-CN')}
                        {record.recordsImported > 0 && ` · 导入 ${record.recordsImported} 条记录`}
                        {record.error && ` · 错误: ${record.error}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant={record.success ? 'success' : 'danger'}>
                    {record.success ? '成功' : '失败'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Import;

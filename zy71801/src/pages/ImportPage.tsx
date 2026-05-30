import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  File, 
  X, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Image,
  Mail,
  Loader2
} from 'lucide-react';

interface UploadedFile {
  id: string;
  file: File;
  type: 'transaction' | 'screenshot' | 'email' | 'unknown';
  status: 'pending' | 'parsing' | 'success' | 'error';
  progress: number;
}

export function ImportPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [packName, setPackName] = useState('');
  const [description, setDescription] = useState('');

  const detectFileType = (file: File): UploadedFile['type'] => {
    const name = file.name.toLowerCase();
    if (name.includes('transaction') || name.includes('流水') || name.includes('tx')) {
      return 'transaction';
    }
    if (name.includes('screenshot') || name.includes('截图') || name.includes('approval')) {
      return 'screenshot';
    }
    if (name.includes('email') || name.includes('邮件') || name.includes('mail')) {
      return 'email';
    }
    return 'unknown';
  };

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const uploaded: UploadedFile[] = fileArray.map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      file,
      type: detectFileType(file),
      status: 'pending',
      progress: 0
    }));
    setFiles(prev => [...prev, ...uploaded]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const getTypeIcon = (type: UploadedFile['type']) => {
    switch (type) {
      case 'transaction': return FileText;
      case 'screenshot': return Image;
      case 'email': return Mail;
      default: return File;
    }
  };

  const getTypeName = (type: UploadedFile['type']) => {
    switch (type) {
      case 'transaction': return '交易流水';
      case 'screenshot': return '审批截图';
      case 'email': return '补充邮件';
      default: return '未识别';
    }
  };

  const simulateParse = async () => {
    for (let i = 0; i < files.length; i++) {
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'parsing' as const } : f
      ));

      await new Promise(resolve => setTimeout(resolve, 500));
      
      for (let p = 0; p <= 100; p += 20) {
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, progress: p } : f
        ));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'success' as const, progress: 100 } : f
      ));
    }
  };

  const handleSubmit = async () => {
    await simulateParse();
    
    setTimeout(() => {
      navigate('/evidence');
    }, 1000);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-gray-900">材料包导入</h1>
        <p className="mt-1 text-gray-500">上传交易流水、审批截图和补充邮件</p>
      </div>

      <div className="max-w-3xl">
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">基本信息</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                材料包名称
              </label>
              <input
                type="text"
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                placeholder="例如：2024年5月银企回单重挂-营业部A"
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                描述说明
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="可选：输入材料包的描述说明..."
                className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">上传文件</h2>
          
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging 
                ? 'border-primary-500 bg-primary-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-700 mb-2">
              拖拽文件到此处，或
              <label className="text-primary-600 cursor-pointer hover:underline ml-1">
                点击上传
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </label>
            </p>
            <p className="text-sm text-gray-500">
              支持 Excel、PDF、图片、邮件等格式
            </p>
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">
                已选择 {files.length} 个文件
              </h3>
              {files.map((file) => {
                const Icon = getTypeIcon(file.type);
                return (
                  <div 
                    key={file.id}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="w-10 h-10 bg-white rounded border flex items-center justify-center">
                      <Icon className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.file.name}
                        </p>
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                          {getTypeName(file.type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {(file.file.size / 1024).toFixed(1)} KB
                        </span>
                        {file.status === 'parsing' && (
                          <div className="flex items-center gap-1 text-xs text-primary-600">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            解析中 {file.progress}%
                          </div>
                        )}
                        {file.status === 'success' && (
                          <div className="flex items-center gap-1 text-xs text-success-600">
                            <CheckCircle className="w-3 h-3" />
                            解析成功
                          </div>
                        )}
                        {file.status === 'error' && (
                          <div className="flex items-center gap-1 text-xs text-danger-500">
                            <AlertCircle className="w-3 h-3" />
                            解析失败
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-4">
          <button
            onClick={() => navigate('/evidence')}
            className="btn-secondary"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={files.length === 0}
            className="btn-primary"
          >
            开始解析
          </button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-800 mb-2">
            材料包说明
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 系统会自动识别文件类型并归类到证据链中</li>
            <li>• 支持检测重复项、晚到附件和人工更正记录</li>
            <li>• 解析完成后将自动执行风控规则判断</li>
            <li>• 所有数据将保存在本地，确保核心证据不丢失</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

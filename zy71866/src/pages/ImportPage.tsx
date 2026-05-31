import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FileText, 
  Clock, 
  Copy, 
  Edit3, 
  Play,
  Database,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Record } from '@/types';

export default function ImportPage() {
  const navigate = useNavigate();
  const { loadMockData, loadMockDataV2, currentPack, isAnalyzing, versionHistory } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

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
    const files = Array.from(e.dataTransfer.files);
    setUploadedFiles(prev => [...prev, ...files]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleLoadDemo = () => {
    loadMockData();
    setTimeout(() => navigate('/matrix'), 500);
  };

  const handleLoadDemoV2 = () => {
    loadMockDataV2();
    setTimeout(() => navigate('/matrix'), 500);
  };

  const stats = currentPack ? {
    total: currentPack.records.length,
    normal: currentPack.records.filter(r => r.source === 'normal').length,
    late: currentPack.records.filter(r => r.source === 'late').length,
    duplicate: currentPack.records.filter(r => r.isDuplicate).length,
    correction: currentPack.records.filter(r => r.corrections.length > 0).length,
  } : null;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">材料导入</h1>
        <p className="text-slate-500 mt-1">上传错题材料包，系统将自动进行预处理和分析</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div
            className={`upload-zone ${isDragging ? 'upload-zone-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              className="hidden"
              id="file-input"
              onChange={handleFileInput}
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <p className="text-lg font-medium text-slate-700">拖拽文件到此处</p>
              <p className="text-sm text-slate-500 mt-1">或点击选择文件</p>
              <p className="text-xs text-slate-400 mt-4">
                支持 Excel、CSV、图片、PDF 等格式
              </p>
            </label>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h3 className="font-medium">已上传文件</h3>
                <span className="text-sm text-slate-500">{uploadedFiles.length} 个文件</span>
              </div>
              <div className="card-body space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-slate-200 rounded"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card bg-slate-50 border-dashed">
            <div className="card-body">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-primary-500" />
                快速体验
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                使用演示数据立即体验系统功能
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleLoadDemo}
                  disabled={isAnalyzing}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  加载演示数据
                </button>
                <button
                  onClick={handleLoadDemoV2}
                  disabled={isAnalyzing}
                  className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  加载V2（含变更）
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">预处理预览</h3>
            </div>
            <div className="card-body">
              {stats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-primary-50 rounded-lg">
                      <p className="text-2xl font-bold text-primary-600">{stats.total}</p>
                      <p className="text-sm text-primary-700">总记录数</p>
                    </div>
                    <div className="p-4 bg-success-50 rounded-lg">
                      <p className="text-2xl font-bold text-success-600">{stats.normal}</p>
                      <p className="text-sm text-success-700">正常记录</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <p className="text-2xl font-bold text-orange-600">{stats.late}</p>
                      </div>
                      <p className="text-sm text-orange-700">晚到附件</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Copy className="w-4 h-4 text-purple-500" />
                        <p className="text-2xl font-bold text-purple-600">{stats.duplicate}</p>
                      </div>
                      <p className="text-sm text-purple-700">重复项</p>
                    </div>
                  </div>
                  
                  {stats.correction > 0 && (
                    <div className="p-4 bg-pending-50 rounded-lg border border-pending-200">
                      <div className="flex items-start gap-3">
                        <Edit3 className="w-5 h-5 text-pending-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-pending-800">
                            检测到 {stats.correction} 条人工更正记录
                          </p>
                          <p className="text-sm text-pending-600 mt-1">
                            系统将保留更正历史，便于后续溯源
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>上传材料后将显示预处理结果</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-medium">分析说明</h3>
            </div>
            <div className="card-body space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">等价答案误判检测</p>
                  <p className="text-xs text-slate-500">自动识别不同表述但语义等价的答案</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">空集边界检测</p>
                  <p className="text-xs text-slate-500">标记空集与单元素集合{0}的边界混淆情况</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">分步得分偏差检测</p>
                  <p className="text-xs text-slate-500">分析得分与答案完整度的匹配合理性</p>
                </div>
              </div>
            </div>
          </div>

          {versionHistory.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-medium">版本历史</h3>
              </div>
              <div className="card-body">
                <div className="space-y-2">
                  {versionHistory.map((pack, index) => (
                    <div key={pack.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">
                        v{pack.version}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{pack.name}</p>
                        <p className="text-xs text-slate-500">
                          {pack.records.length} 条记录 · {pack.createdAt}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { getMockPackage } from '@/data/mockData';
import { Upload, FileJson, CheckCircle, AlertTriangle, Clock, FileWarning, ArrowRight, Package, Database } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

const ImportPage = () => {
  const navigate = useNavigate();
  const importPackage = useStore(state => state.importPackage);
  const importResult = useStore(state => state.importResult);
  const clearImportResult = useStore(state => state.clearImportResult);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);

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
    const jsonFile = files.find(f => f.name.endsWith('.json'));
    
    if (jsonFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setImporting(true);
          setTimeout(() => {
            importPackage(data);
            setImporting(false);
          }, 1000);
        } catch (error) {
          alert('文件解析失败，请确保是有效的JSON文件');
        }
      };
      reader.readAsText(jsonFile);
    }
  }, [importPackage]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setImporting(true);
          setTimeout(() => {
            importPackage(data);
            setImporting(false);
          }, 1000);
        } catch (error) {
          alert('文件解析失败，请确保是有效的JSON文件');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleLoadDemo = () => {
    setImporting(true);
    setTimeout(() => {
      const mockData = getMockPackage();
      importPackage(mockData);
      setImporting(false);
    }, 1500);
  };

  const handleClear = () => {
    clearImportResult();
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-serif font-bold text-primary-800 mb-2">材料导入</h2>
        <p className="text-primary-600">上传混合材料包，系统将自动解析并构建完整证据链</p>
      </div>

      {!importResult ? (
        <div className="space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
              isDragging 
                ? 'border-accent-500 bg-accent-50' 
                : 'border-primary-300 bg-white hover:border-primary-400'
            }`}
          >
            <input
              type="file"
              accept=".json"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            {importing ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <p className="text-primary-600 font-medium">正在解析材料包...</p>
              </div>
            ) : (
              <>
                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-colors duration-300 ${
                  isDragging ? 'bg-accent-100' : 'bg-primary-100'
                }`}>
                  <Upload className={`w-10 h-10 transition-colors duration-300 ${
                    isDragging ? 'text-accent-500' : 'text-primary-500'
                  }`} />
                </div>
                <p className="text-lg font-medium text-primary-700 mb-2">
                  拖拽 JSON 材料包到此处，或点击选择文件
                </p>
                <p className="text-sm text-primary-500">
                  支持格式：.json | 包含学生错题、讲义截图、人工更正、讲评稿
                </p>
              </>
            )}
          </div>

          <div className="text-center">
            <p className="text-primary-500 mb-4">或</p>
            <button
              onClick={handleLoadDemo}
              disabled={importing}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-white font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              <Package className="w-5 h-5" />
              <span>加载演示材料包</span>
            </button>
            <p className="mt-2 text-sm text-primary-500">
              演示材料包含：正常记录、晚到附件、重复项、人工更正、缺截图等边界情况
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white rounded-xl p-5 border border-primary-100 shadow-sm">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-primary-800 mb-1">正常记录</h3>
              <p className="text-sm text-primary-600">标准学生错题录入，附带完整讲义截图</p>
            </div>
            
            <div className="bg-white rounded-xl p-5 border border-primary-100 shadow-sm">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-primary-800 mb-1">晚到附件</h3>
              <p className="text-sm text-primary-600">后续补充上传的讲义截图和补充材料</p>
            </div>
            
            <div className="bg-white rounded-xl p-5 border border-primary-100 shadow-sm">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mb-3">
                <FileWarning className="w-5 h-5 text-yellow-600" />
              </div>
              <h3 className="font-semibold text-primary-800 mb-1">重复项</h3>
              <p className="text-sm text-primary-600">同一学生同一题目的多次录入记录</p>
            </div>
            
            <div className="bg-white rounded-xl p-5 border border-primary-100 shadow-sm">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-semibold text-primary-800 mb-1">人工更正</h3>
              <p className="text-sm text-primary-600">教师对难度标签或内容的人工修改</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-slide-in">
          <div className="bg-white rounded-2xl shadow-sm border border-primary-100 overflow-hidden">
            <div className="bg-primary-800 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Database className="w-6 h-6 text-accent-400" />
                  <h3 className="text-lg font-semibold">材料导入完成</h3>
                </div>
                <button
                  onClick={handleClear}
                  className="text-primary-300 hover:text-white transition-colors text-sm"
                >
                  重新导入
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="text-center p-4 bg-primary-50 rounded-xl">
                  <p className="text-3xl font-bold text-primary-800">{importResult.total}</p>
                  <p className="text-sm text-primary-600">总记录数</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <p className="text-3xl font-bold text-green-700">{importResult.normal}</p>
                  <p className="text-sm text-green-600">正常记录</p>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-xl">
                  <p className="text-3xl font-bold text-amber-700">{importResult.late}</p>
                  <p className="text-sm text-amber-600">晚到附件</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-xl">
                  <p className="text-3xl font-bold text-yellow-700">{importResult.duplicates.length}</p>
                  <p className="text-sm text-yellow-600">重复项</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-xl">
                  <p className="text-3xl font-bold text-red-700">{importResult.conflicts.length}</p>
                  <p className="text-sm text-red-600">冲突项</p>
                </div>
              </div>

              {importResult.missingSnapshots.length > 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">缺少讲义截图</p>
                      <p className="text-sm text-amber-700 mt-1">
                        以下 {importResult.missingSnapshots.length} 条记录没有对应的讲义截图：
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {importResult.missingSnapshots.slice(0, 5).map((id, idx) => (
                          <span key={idx} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                            {id.substring(0, 8)}...
                          </span>
                        ))}
                        {importResult.missingSnapshots.length > 5 && (
                          <span className="text-xs text-amber-600">
                            还有 {importResult.missingSnapshots.length - 5} 条
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-primary-100">
                <div className="flex items-center space-x-4">
                  <span className="text-primary-600">处理状态：</span>
                  <div className="flex items-center space-x-2">
                    <StatusBadge status="confirmed" />
                    <span className="text-sm text-primary-600">
                      {importResult.chains.filter(c => c.status === 'confirmed').length} 条已确认
                    </span>
                  </div>
                  {importResult.chains.some(c => c.status === 'pending') && (
                    <div className="flex items-center space-x-2">
                      <StatusBadge status="pending" />
                      <span className="text-sm text-primary-600">
                        {importResult.chains.filter(c => c.status === 'pending').length} 条待处理
                      </span>
                    </div>
                  )}
                  {importResult.chains.some(c => c.status === 'conflict') && (
                    <div className="flex items-center space-x-2">
                      <StatusBadge status="conflict" />
                      <span className="text-sm text-primary-600">
                        {importResult.chains.filter(c => c.status === 'conflict').length} 条有冲突
                      </span>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => navigate('/overview')}
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg transition-colors duration-200"
                >
                  <span>查看回放总览</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportPage;

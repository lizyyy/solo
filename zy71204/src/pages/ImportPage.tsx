import { useState, useCallback } from 'react';
import { Upload, File, CheckCircle, XCircle, AlertTriangle, Trash2, Play } from 'lucide-react';
import useBillStore from '@/store/useBillStore';
import { parseFile } from '@/services/fileParser';
import { FileUploadItem } from '@/types/bill';


export default function ImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const { uploadFiles, addUploadFile, updateUploadFile, clearUploadFiles, importBills, isLoading } = useBillStore();

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    for (const file of Array.from(files)) {
      const uploadItem: FileUploadItem = {
        file,
        name: file.name,
        size: file.size,
        status: 'pending',
        progress: 0,
      };
      addUploadFile(uploadItem);
    }
  }, [addUploadFile]);

  const processFile = async (item: FileUploadItem) => {
    updateUploadFile(item.name, { status: 'processing', progress: 10 });

    try {
      updateUploadFile(item.name, { progress: 30 });
      
      const result = await parseFile(item.file);
      
      updateUploadFile(item.name, { progress: 70 });
      
      await importBills(result, item.name);
      
      updateUploadFile(item.name, { 
        status: 'success', 
        progress: 100,
        result 
      });
    } catch (error) {
      updateUploadFile(item.name, { 
        status: 'error', 
        progress: 100,
        error: error instanceof Error ? error.message : '处理失败'
      });
    }
  };

  const processAll = async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    for (const file of pendingFiles) {
      await processFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      <div className={`dropzone ${isDragging ? 'dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-lg font-medium text-slate-700 mb-2">
            拖拽文件到此处或点击上传
          </p>
          <p className="text-sm text-slate-500">
            支持 Excel (.xlsx, .xls) 和 CSV 文件
          </p>
          <div className="mt-4 flex justify-center gap-4 text-xs text-slate-400">
            <span>必需字段: 票据编号、到期日、保证金</span>
            <span>|</span>
            <span>可选字段: 质押状态、释放申请、占用报告</span>
          </div>
        </label>
      </div>

      {uploadFiles.length > 0 && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">待处理文件</h3>
            <div className="flex gap-3">
              <button onClick={clearUploadFiles} className="btn btn-secondary text-sm">
                <Trash2 className="w-4 h-4 mr-2" />
                清空列表
              </button>
              <button 
                onClick={processAll} 
                className="btn btn-primary text-sm"
                disabled={isLoading || !uploadFiles.some(f => f.status === 'pending')}
              >
                <Play className="w-4 h-4 mr-2" />
                批量处理
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {uploadFiles.map((item, index) => (
              <div key={index} className="card">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                        <File className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{item.name}</p>
                        <p className="text-sm text-slate-500">{formatSize(item.size)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {item.status === 'pending' && (
                        <button 
                          onClick={() => processFile(item)}
                          className="btn btn-primary text-sm"
                          disabled={isLoading}
                        >
                          处理
                        </button>
                      )}
                      
                      {item.status === 'processing' && (
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary-600 transition-all duration-300"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-500">{item.progress}%</span>
                        </div>
                      )}
                      
                      {item.status === 'success' && item.result && (
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                          <div className="text-sm">
                            <span className="text-emerald-600 font-medium">成功</span>
                            <span className="text-slate-500 ml-2">
                              共 {item.result.total} 条，
                              <span className="text-emerald-600">有效 {item.result.validCount}</span>，
                              <span className="text-amber-600">脏数据 {item.result.dirtyCount}</span>
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {item.status === 'error' && (
                        <div className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-500" />
                          <span className="text-sm text-red-600">{item.error}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {item.result && (item.result.errors.length > 0 || item.result.warnings.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      {item.result.errors.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 text-red-600 text-sm font-medium mb-2">
                            <XCircle className="w-4 h-4" />
                            错误 ({item.result.errors.length})
                          </div>
                          <ul className="text-sm text-red-600/80 space-y-1 max-h-24 overflow-y-auto">
                            {item.result.errors.slice(0, 5).map((err, i) => (
                              <li key={i}>• {err}</li>
                            ))}
                            {item.result.errors.length > 5 && (
                              <li>... 还有 {item.result.errors.length - 5} 条错误</li>
                            )}
                          </ul>
                        </div>
                      )}
                      
                      {item.result.warnings.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 text-amber-600 text-sm font-medium mb-2">
                            <AlertTriangle className="w-4 h-4" />
                            警告 ({item.result.warnings.length})
                          </div>
                          <ul className="text-sm text-amber-600/80 space-y-1 max-h-24 overflow-y-auto">
                            {item.result.warnings.slice(0, 5).map((warn, i) => (
                              <li key={i}>• {warn}</li>
                            ))}
                            {item.result.warnings.length > 5 && (
                              <li>... 还有 {item.result.warnings.length - 5} 条警告</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {item.result && item.result.dirtyBills.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2 text-amber-600 text-sm font-medium mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        脏数据预览 ({item.result.dirtyBills.length} 条)
                      </div>
                      <div className="bg-amber-50 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-amber-100/50">
                                <th className="px-3 py-2 text-left text-amber-700">票据编号</th>
                                <th className="px-3 py-2 text-left text-amber-700">到期日</th>
                                <th className="px-3 py-2 text-left text-amber-700">保证金</th>
                                <th className="px-3 py-2 text-left text-amber-700">问题原因</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.result.dirtyBills.slice(0, 3).map(bill => (
                                <tr key={bill.id} className="border-t border-amber-100">
                                  <td className="px-3 py-2 text-amber-800">{bill.billNo}</td>
                                  <td className="px-3 py-2 text-amber-800">{bill.maturityDate}</td>
                                  <td className="px-3 py-2 text-amber-800">{bill.margin}</td>
                                  <td className="px-3 py-2 text-red-600">{bill.dirtyReason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-800">文件格式说明</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-slate-700 mb-3">必需字段</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-medium">• 票据编号</span>
                  <span>票据唯一标识</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-medium">• 到期日</span>
                  <span>格式: YYYY-MM-DD 或 YYYY/MM/DD</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-medium">• 保证金</span>
                  <span>数字金额</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-slate-700 mb-3">可选字段</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• 质押状态: 已质押/待质押</li>
                <li>• 原始到期日: 用于展期判断</li>
                <li>• 释放申请: 释放申请编号</li>
                <li>• 占用报告: 占用报告编号</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-700 mb-3">示例数据</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white">
                    <th className="px-3 py-2 text-left border border-slate-200">票据编号</th>
                    <th className="px-3 py-2 text-left border border-slate-200">质押状态</th>
                    <th className="px-3 py-2 text-left border border-slate-200">到期日</th>
                    <th className="px-3 py-2 text-left border border-slate-200">保证金</th>
                    <th className="px-3 py-2 text-left border border-slate-200">释放申请</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 border border-slate-200">BP202401001</td>
                    <td className="px-3 py-2 border border-slate-200">已质押</td>
                    <td className="px-3 py-2 border border-slate-200">2024-06-30</td>
                    <td className="px-3 py-2 border border-slate-200">500000</td>
                    <td className="px-3 py-2 border border-slate-200"></td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 border border-slate-200">BP202401002</td>
                    <td className="px-3 py-2 border border-slate-200">已质押</td>
                    <td className="px-3 py-2 border border-slate-200">2024-05-15</td>
                    <td className="px-3 py-2 border border-slate-200">800000</td>
                    <td className="px-3 py-2 border border-slate-200">REL2024051001</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, AlertCircle, CheckCircle, ArrowRight, X } from 'lucide-react';
import { UploadZone } from '@/components/upload/UploadZone';
import { DataGapAlert } from '@/components/common/DataGapAlert';
import { useWorkStore } from '@/store/useWorkStore';
import { DataGaps } from '@/types';
import { detectDataGaps } from '@/lib/gapDetector';

interface PendingImport {
  file: File;
  preview: string;
  studentName: string;
  className: string;
  workTitle: string;
  theme: string;
  dataGaps?: DataGaps;
}

export default function ImportPage() {
  const navigate = useNavigate();
  const { importWork, isLoading, error } = useWorkStore();

  const [pendingImports, setPendingImports] = useState<PendingImport[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [importResults, setImportResults] = useState<Array<{
    success: boolean;
    workId?: string;
    error?: string;
    dataGaps?: DataGaps;
    requiresConfirmation?: boolean;
  }>>([]);

  const handleFileSelect = useCallback((file: File, preview: string) => {
    setPendingImports(prev => [...prev, {
      file,
      preview,
      studentName: '',
      className: '',
      workTitle: file.name.replace(/\.[^/.]+$/, ''),
      theme: ''
    }]);
  }, []);

  const updatePendingImport = useCallback((index: number, updates: Partial<PendingImport>) => {
    setPendingImports(prev => prev.map((item, i) => {
      if (i !== index) return item;

      const updated = { ...item, ...updates };
      const gaps = detectDataGaps({
        studentName: updated.studentName,
        className: updated.className,
        workTitle: updated.workTitle,
        theme: updated.theme,
        hasImage: true
      });

      return { ...updated, dataGaps: gaps };
    }));
  }, []);

  const removePendingImport = useCallback((index: number) => {
    setPendingImports(prev => prev.filter((_, i) => i !== index));
    if (currentIndex >= pendingImports.length - 1) {
      setCurrentIndex(Math.max(0, currentIndex - 1));
    }
  }, [currentIndex, pendingImports.length]);

  const doImport = useCallback(async (item: PendingImport, forceImport: boolean = false) => {
    try {
      const result = await importWork({
        file: item.file,
        studentName: item.studentName,
        className: item.className,
        workTitle: item.workTitle,
        theme: item.theme || undefined,
        forceImport
      });

      setImportResults(prev => [...prev, {
        success: true,
        workId: result.workId,
        dataGaps: result.dataGaps,
        requiresConfirmation: result.requiresConfirmation
      }]);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '导入失败';
      setImportResults(prev => [...prev, {
        success: false,
        error: message
      }]);
      return null;
    }
  }, [importWork]);

  const handleImportCurrent = useCallback(async (forceImport: boolean = false) => {
    const current = pendingImports[currentIndex];
    if (!current) return;

    const result = await doImport(current, forceImport);

    if (result && !result.requiresConfirmation) {
      if (currentIndex < pendingImports.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        navigate('/');
      }
    }
  }, [pendingImports, currentIndex, doImport, navigate]);

  const handleImportAll = useCallback(async () => {
    for (let i = 0; i < pendingImports.length; i++) {
      setCurrentIndex(i);
      const item = pendingImports[i];
      const gaps = item.dataGaps || detectDataGaps({
        studentName: item.studentName,
        className: item.className,
        workTitle: item.workTitle,
        theme: item.theme,
        hasImage: true
      });

      if (gaps.incomplete) {
        setImportResults(prev => [...prev, {
          success: false,
          error: `跳过"${item.workTitle}"：缺少必填字段 - ${gaps.missingFields.join('、')}`,
          dataGaps: gaps,
          requiresConfirmation: true
        }]);
        continue;
      }

      await doImport(item, false);
    }
  }, [pendingImports, doImport]);

  const current = pendingImports[currentIndex];
  const allHaveData = pendingImports.every(item =>
    item.studentName && item.className && item.workTitle
  );

  if (pendingImports.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">导入作品</h1>
          <p className="text-slate-600">上传学生作品图片，自动分析色彩质量</p>
        </div>

        <UploadZone onFileSelect={handleFileSelect} maxFiles={20} />

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            导入须知
          </h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>支持 JPG、PNG 格式图片</li>
            <li>必填字段：学生姓名、班级、作品标题</li>
            <li>透明图层、背景色、极端色会自动排除，不参与分析</li>
            <li>每次导入生成独立版本，历史数据永不覆盖</li>
            <li>数据缺口会被明确标记，不会假装完整</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">导入作品</h1>
        <p className="text-slate-600">
          已选择 {pendingImports.length} 张图片，正在填写第 {currentIndex + 1} 张的信息
        </p>
      </div>

      {pendingImports.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {pendingImports.map((item, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`
                relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all
                ${index === currentIndex
                  ? 'border-indigo-500 ring-2 ring-indigo-200'
                  : 'border-slate-200 hover:border-slate-300'
                }
              `}
            >
              <img
                src={item.preview}
                alt=""
                className="w-full h-full object-cover"
              />
              {item.dataGaps && !item.dataGaps.incomplete && (
                <div className="absolute top-1 right-1">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
              )}
              {item.dataGaps?.incomplete && (
                <div className="absolute top-1 right-1">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                </div>
              )}
              <button
                className="absolute top-1 left-1 p-0.5 bg-black/50 rounded-full text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  removePendingImport(index);
                }}
              >
                <X className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>
      )}

      {current && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <img
                src={current.preview}
                alt={current.workTitle}
                className="w-full max-h-80 object-contain rounded-lg bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">作品信息</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    学生姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={current.studentName}
                    onChange={e => updatePendingImport(currentIndex, { studentName: e.target.value })}
                    placeholder="请输入学生姓名"
                    className={`
                      w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500
                      ${current.dataGaps?.missingFields.includes('学生姓名')
                        ? 'border-red-300 bg-red-50'
                        : 'border-slate-300'
                      }
                    `}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    班级 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={current.className}
                    onChange={e => updatePendingImport(currentIndex, { className: e.target.value })}
                    placeholder="如：三年级1班"
                    className={`
                      w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500
                      ${current.dataGaps?.missingFields.includes('班级')
                        ? 'border-red-300 bg-red-50'
                        : 'border-slate-300'
                      }
                    `}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    作品标题 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={current.workTitle}
                    onChange={e => updatePendingImport(currentIndex, { workTitle: e.target.value })}
                    placeholder="请输入作品标题"
                    className={`
                      w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500
                      ${current.dataGaps?.missingFields.includes('作品标题')
                        ? 'border-red-300 bg-red-50'
                        : 'border-slate-300'
                      }
                    `}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    主题 <span className="text-slate-400 text-xs">（可选）</span>
                  </label>
                  <input
                    type="text"
                    value={current.theme}
                    onChange={e => updatePendingImport(currentIndex, { theme: e.target.value })}
                    placeholder="如：秋天的景色、我的梦想"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {current.dataGaps && (current.dataGaps.incomplete || current.dataGaps.warnings.length > 0) && (
              <DataGapAlert
                gaps={current.dataGaps}
                onForceImport={() => handleImportCurrent(true)}
                onDismiss={() => {}}
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleImportCurrent(false)}
                disabled={isLoading}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span>导入中...</span>
                ) : (
                  <>
                    保存并继续 <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {pendingImports.length > 1 && (
                <button
                  onClick={handleImportAll}
                  disabled={isLoading || !allHaveData}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                >
                  批量导入全部
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {importResults.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-3">导入结果</h3>
          <div className="space-y-2">
            {importResults.map((result, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-sm p-2 rounded ${
                  result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{result.success ? '导入成功' : result.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

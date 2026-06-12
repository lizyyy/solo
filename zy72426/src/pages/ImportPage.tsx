import { useState } from 'react';
import { Card } from '@/components/common/Card';
import { FileUploader } from '@/components/import/FileUploader';
import { ImportPreview } from '@/components/import/ImportPreview';
import { ImportHistory } from '@/components/import/ImportHistory';
import { useEmotionLabelStore } from '@/store/useEmotionLabelStore';
import { Upload, Play, AlertCircle, CheckCircle2, RefreshCcw, Plus, FileDown, Info } from 'lucide-react';

export const ImportPage = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const {
    previewCSV, importCSV, clearPreview, previewRows, importHistory, isLoading,
    runSelfCheck, lastImportInfo, runConsistencyCheck,
  } = useEmotionLabelStore();

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    await previewCSV(file);
  };

  const handleClear = () => {
    setSelectedFile(null);
    clearPreview();
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    try {
      await importCSV(selectedFile, '新人运营');
      setSelectedFile(null);
      clearPreview();
      runSelfCheck();
      runConsistencyCheck();
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败，请检查文件格式');
    }
  };

  const hasIssues = previewRows.some((r) => r.isDuplicate || r.isNameMapping);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            第一步：票务导出表导入
          </h1>
          <p className="text-gray-500 mt-1">上传票务系统导出的CSV或Excel文件，系统将自动检测重复和同名记录</p>
        </div>
      </div>

      {lastImportInfo && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              上次导入结果详情
            </span>
          }
          subtitle={`批次 #${lastImportInfo.importBatch} · 操作人：${lastImportInfo.operator} · ${new Date(lastImportInfo.importedAt).toLocaleString('zh-CN')}`}
        >
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-xs text-gray-500">CSV原始行数</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{lastImportInfo.rawRows}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded border border-blue-100">
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <RefreshCcw className="w-3 h-3" /> 复用记录（不重复入库）
              </p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{lastImportInfo.reusedRows}</p>
            </div>
            <div className="p-3 bg-green-50 rounded border border-green-100">
              <p className="text-xs text-green-600 flex items-center gap-1">
                <Plus className="w-3 h-3" /> 真新增记录（首次出现）
              </p>
              <p className="text-2xl font-bold text-green-700 mt-1">{lastImportInfo.newRows}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded border border-amber-100">
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> 导入后待复核
              </p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{lastImportInfo.resultingReviewCount}</p>
            </div>
          </div>

          {(lastImportInfo.reusedPairs.length > 0 || lastImportInfo.rejectedDuplicates.length > 0) && (
            <div className="space-y-3 mt-4 border-t pt-4">
              {lastImportInfo.reusedPairs.length > 0 && (
                <div className="p-3 bg-blue-50/50 rounded border border-blue-100">
                  <p className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                    <RefreshCcw className="w-4 h-4" />
                    以下 {lastImportInfo.reusedPairs.length} 条已存在，直接复用现有记录与之前的复核结果：
                  </p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto text-xs">
                    {lastImportInfo.reusedPairs.map((p) => (
                      <li key={p.newKey} className="flex gap-3 text-gray-600 px-2 py-1 hover:bg-blue-50">
                        <span className="font-mono text-blue-600">#{p.existingOriginalRow}</span>
                        <span className="truncate flex-1">
                          <span className="font-medium">{p.liveName || '(无现场名)'}</span>
                          {p.liveName !== p.copyrightName && p.copyrightName && (
                            <span className="text-gray-400"> → {p.copyrightName}</span>
                          )}
                        </span>
                        <span className="text-amber-600 flex-shrink-0">
                          组内记录数: {p.existingGroupCount}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lastImportInfo.rejectedDuplicates.length > 0 && (
                <div className="p-3 bg-red-50/50 rounded border border-red-100">
                  <p className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    以下 {lastImportInfo.rejectedDuplicates.length} 条完全重复已跳过：
                  </p>
                  <ul className="space-y-1 max-h-24 overflow-y-auto text-xs">
                    {lastImportInfo.rejectedDuplicates.map((r) => (
                      <li key={r.row} className="flex gap-3 text-gray-600 px-2 py-1">
                        <span className="font-mono text-red-600">行{r.row}</span>
                        <span>{r.liveName || '(无现场名)'}</span>
                        <span className="text-gray-400">与 #{r.duplicateOfOriginalRow} 行完全相同</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-50 rounded flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-600">
              复用判断逻辑：基于「现场名 + 版权名」组合唯一键匹配。同一首歌导入过第二次时，
              之前的人工复核结果（情绪标签、误差说明、备注）会直接沿用，无需重复操作。
              如需覆盖历史结果，请在第二步「情绪标签」页修改对应记录。
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card title="文件上传" subtitle="支持票务系统导出的标准格式">
            <FileUploader
              onFileSelect={handleFileSelect}
              isLoading={isLoading}
              selectedFile={selectedFile}
              onClear={handleClear}
            />

            {previewRows.length > 0 && (
              <div className="mt-6">
                {hasIssues && (
                  <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">检测到潜在问题</p>
                      <p className="text-sm text-amber-700 mt-1">
                        系统检测到可能存在重复导入或现场名/版权名映射的记录，导入后需音乐老师复核确认
                      </p>
                    </div>
                  </div>
                )}

                <h4 className="font-medium text-gray-700 mb-3">导入预览（前20行）</h4>
                <ImportPreview rows={previewRows} />
              </div>
            )}

            {selectedFile && (
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleClear}
                  className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleImport}
                  disabled={isLoading}
                  className="px-5 py-2.5 text-white bg-[#1e3a5f] rounded hover:bg-[#2c5282] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      导入中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      确认导入
                    </>
                  )}
                </button>
              </div>
            )}
          </Card>

          <Card title="操作指引" subtitle="新人操作必读">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-[#1e3a5f] text-white rounded flex items-center justify-center flex-shrink-0 font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-800">从票务系统导出原始数据</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    确保导出文件包含「现场名」「版权名」两列，保存为CSV或Excel格式
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-[#2c5282] text-white rounded flex items-center justify-center flex-shrink-0 font-bold">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-800">上传并预览数据</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    系统自动检测重复记录和疑似现场名/版权名映射，橙色高亮行需重点关注
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-[#dd6b20] text-white rounded flex items-center justify-center flex-shrink-0 font-bold">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-800">确认导入后通知许老师复核</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    导入完成后，现场名/版权名待确认记录会自动标记，不急着归正常，留给音乐老师复核
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="导入历史" subtitle="按时间倒序显示">
            <ImportHistory history={importHistory} />
          </Card>

          <Card title="快速开始" subtitle="想快速体验？">
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-700 font-medium">系统已预置样例数据</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">包含现场名/版权名映射场景</p>
              <button
                onClick={() => window.location.href = '/labels'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#dd6b20] text-white rounded hover:bg-[#c05621] transition-colors"
              >
                <Play className="w-4 h-4" />
                查看样例数据
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

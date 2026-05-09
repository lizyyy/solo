import { useState, useRef } from 'react';
import { useAppContext } from '../context';
import type { ImportResult } from '../types';

export function ImportExport() {
  const { importFromFile, exportToJSON, exportToCSV, certificates } = useAppContext();
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File | null) => {
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    const result = await importFromFile(file);
    setImportResult(result);
    setIsImporting(false);
  };

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

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };



  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">导入与导出</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>📥</span>
            导入数据
          </h3>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {isImporting ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                <p className="text-gray-600">正在导入数据...</p>
              </div>
            ) : (
              <>
                <p className="text-4xl mb-3">📁</p>
                <p className="text-gray-600 mb-2">拖拽文件到此处，或</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition mb-2"
                >
                  选择文件
                </button>
                <p className="text-sm text-gray-400">支持 JSON 和 CSV 格式</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </>
            )}
          </div>

          {importResult && (
            <div className={`mt-4 rounded-lg p-4 ${
              importResult.success > 0 && importResult.failed === 0
                ? 'bg-green-50 border border-green-200'
                : importResult.failed > 0
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-red-50 border border-red-200'
            }`}>
              <h4 className={`font-medium mb-2 ${
                importResult.success > 0 && importResult.failed === 0
                  ? 'text-green-700'
                  : importResult.failed > 0
                    ? 'text-yellow-700'
                    : 'text-red-700'
              }`}>
                导入结果
              </h4>
              <div className="space-y-1 text-sm">
                <p>✅ 成功导入：{importResult.success} 条</p>
                <p>❌ 失败/跳过：{importResult.failed} 条</p>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium text-sm text-gray-700 mb-1">错误详情：</p>
                  <ul className="text-sm text-red-600 list-disc list-inside max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importResult.duplicates.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium text-sm text-gray-700 mb-1">重复/冲突记录：</p>
                  <ul className="text-sm text-orange-600 list-disc list-inside max-h-32 overflow-y-auto">
                    {importResult.duplicates.map((dup, i) => (
                      <li key={i}>{dup}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">支持的格式</h4>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <p className="font-medium text-gray-700 mb-1">JSON 格式示例：</p>
                <pre className="bg-gray-800 text-green-400 p-2 rounded text-xs overflow-x-auto">
{`[{
  "证照编号": "LIC001",
  "证照类型": "store_license",
  "证照名称": "食品经营许可证",
  "持证人/单位": "某某门店",
  "发证日期": "2024-01-01",
  "到期日期": "2026-01-01"
}]`}
                </pre>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-1">CSV 格式示例：</p>
                <pre className="bg-gray-800 text-green-400 p-2 rounded text-xs overflow-x-auto">
{`证照编号,证照类型,证照名称,持证人/单位,发证日期,到期日期
LIC001,store_license,食品经营许可证,某某门店,2024-01-01,2026-01-01
HLT001,health_certificate,健康证,张三,2024-06-01,2025-06-01`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>📤</span>
            导出数据
          </h3>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-3">
                当前共有 <strong className="text-blue-600">{certificates.length}</strong> 条证照数据可导出
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={exportToJSON}
                  disabled={certificates.length === 0}
                  className="px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center"
                >
                  <span className="text-xl mb-1">📋</span>
                  <span>导出为 JSON</span>
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={certificates.length === 0}
                  className="px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center"
                >
                  <span className="text-xl mb-1">📊</span>
                  <span>导出为 CSV</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-700 mb-2">💡 导出说明</h4>
              <ul className="text-sm text-yellow-600 space-y-1 list-disc list-inside">
                <li>JSON 格式包含完整数据，可用于备份和数据迁移</li>
                <li>CSV 格式可直接用 Excel 打开，便于打印和分享</li>
                <li>导出文件将自动以当天日期命名</li>
              </ul>
            </div>

            <div className="p-4 border border-dashed border-gray-300 rounded-lg">
              <h4 className="font-medium text-gray-700 mb-2">📝 证照类型说明</h4>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span>🏪</span>
                  <span className="text-gray-600">store_license - 门店许可证</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💊</span>
                  <span className="text-gray-600">health_certificate - 员工健康证</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📋</span>
                  <span className="text-gray-600">supplier_qualification - 供应商资质</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

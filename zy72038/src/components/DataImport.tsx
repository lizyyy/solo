import React, { useState, useCallback } from 'react';
import { Upload, AlertTriangle, CheckCircle, XCircle, FileJson, FileSpreadsheet, Info } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { parseJSONData, parseCSVData, getDefaultGameConfig, validateGameConfig } from '@/utils/gameUtils';
import { ImportResult, ValidationError } from '@/types/game';

export const DataImport: React.FC = () => {
  const { setConfig, config, setImportConflicts } = useGameStore();
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      let result: ImportResult;

      if (file.name.endsWith('.json')) {
        result = parseJSONData(content);
      } else if (file.name.endsWith('.csv')) {
        result = parseCSVData(content);
      } else {
        result = {
          config: null,
          errors: [
            {
              type: 'missing_field',
              field: 'file',
              message: '不支持的文件格式，请使用 JSON 或 CSV',
              suggestion: '请转换为 .json 或 .csv 格式后重新导入',
            },
          ],
          warnings: [],
          conflicts: [],
          rawData: content,
        };
      }

      setImportResult(result);
      setImportConflicts(result.conflicts || []);

      if (result.config && result.errors.length === 0) {
        setConfig(result.config);
      }
    };
    reader.readAsText(file);
  }, [setConfig, setImportConflicts]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const loadDefaultConfig = useCallback(() => {
    const defaultConfig = getDefaultGameConfig();
    const result = validateGameConfig(defaultConfig);
    setImportResult(result);
    setConfig(defaultConfig);
  }, [setConfig]);

  const applyConfigWithWarnings = useCallback(() => {
    if (importResult?.config) {
      setConfig(importResult.config);
    }
  }, [importResult, setConfig]);

  const getErrorIcon = (type: ValidationError['type']) => {
    switch (type) {
      case 'empty_level':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'duplicate_event':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'out_of_bounds':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur rounded-xl p-6 space-y-6 border border-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">数据导入</h2>
        {config && (
          <span className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            已加载配置
          </span>
        )}
      </div>

      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
          ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500'}
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".json,.csv"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
        <p className="text-slate-300 mb-2">拖拽文件到此处或点击上传</p>
        <p className="text-slate-500 text-sm">支持 JSON 和 CSV 格式的课堂计分表</p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-700/50 rounded-lg text-slate-400">
          <FileJson className="w-4 h-4" />
          <span className="text-sm">JSON</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-700/50 rounded-lg text-slate-400">
          <FileSpreadsheet className="w-4 h-4" />
          <span className="text-sm">CSV</span>
        </div>
      </div>

      <button
        onClick={loadDefaultConfig}
        className="w-full py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-all"
      >
        加载默认演示配置
      </button>

      {importResult && (
        <div className="space-y-4">
          <div className="border-t border-slate-700 pt-4">
            <h3 className="text-sm font-medium text-slate-400 mb-3">导入结果</h3>

            {importResult.errors.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <XCircle className="w-4 h-4" />
                  <span className="font-medium">错误 ({importResult.errors.length})</span>
                </div>
                <div className="space-y-2">
                  {importResult.errors.map((error, index) => (
                    <div
                      key={index}
                      className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                    >
                      <div className="flex items-start gap-2">
                        {getErrorIcon(error.type)}
                        <div className="flex-1">
                          <p className="text-red-300 text-sm">{error.message}</p>
                          {error.scoreboardValue && error.importedValue && (
                            <div className="mt-2 text-xs space-y-1">
                              <div className="flex gap-2">
                                <span className="text-slate-400">计分表:</span>
                                <span className="text-green-400">{error.scoreboardValue}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-slate-400">导入值:</span>
                                <span className="text-yellow-400">{error.importedValue}</span>
                              </div>
                            </div>
                          )}
                          <p className="text-slate-400 text-xs mt-1 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            建议: {error.suggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.warnings.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">警告 ({importResult.warnings.length})</span>
                </div>
                <div className="space-y-2">
                  {importResult.warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
                    >
                      <div className="flex items-start gap-2">
                        {getErrorIcon(warning.type)}
                        <div className="flex-1">
                          <p className="text-yellow-300 text-sm">{warning.message}</p>
                          {warning.scoreboardValue && warning.importedValue && (
                            <div className="mt-2 text-xs space-y-1">
                              <div className="flex gap-2">
                                <span className="text-slate-400">计分表:</span>
                                <span className="text-green-400">{warning.scoreboardValue}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-slate-400">导入值:</span>
                                <span className="text-yellow-400">{warning.importedValue}</span>
                              </div>
                            </div>
                          )}
                          <p className="text-slate-400 text-xs mt-1 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            建议: {warning.suggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {importResult.config && importResult.errors.length === 0 && (
                  <button
                    onClick={applyConfigWithWarnings}
                    className="mt-3 w-full py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-500 transition-all"
                  >
                    仍使用此配置（保留警告）
                  </button>
                )}
              </div>
            )}

            {importResult.conflicts && importResult.conflicts.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 text-purple-400 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">数据冲突 ({importResult.conflicts.length})</span>
                </div>
                <p className="text-slate-400 text-xs mb-3">
                  检测到课堂计分表与导入数据存在差异，请仔细核对后再决定使用哪个值
                </p>
                <div className="space-y-3">
                  {importResult.conflicts.map((conflict, index) => (
                    <div
                      key={index}
                      className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg"
                    >
                      <p className="text-purple-300 text-sm font-medium mb-3">
                        字段: {conflict.field}
                      </p>
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex-1 p-3 bg-slate-900/70 rounded-lg">
                          <div className="text-xs text-slate-400 mb-1">课堂计分表值</div>
                          <div className="text-green-400 font-mono text-sm font-medium">
                            {conflict.scoreboardValue}
                          </div>
                        </div>
                        <div className="text-slate-500 text-xl">≠</div>
                        <div className="flex-1 p-3 bg-slate-900/70 rounded-lg">
                          <div className="text-xs text-slate-400 mb-1">导入数据值</div>
                          <div className="text-yellow-400 font-mono text-sm font-medium">
                            {conflict.importedValue}
                          </div>
                        </div>
                      </div>
                      {conflict.evidence && conflict.evidence.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-slate-400 mb-2">证据记录:</p>
                          {conflict.evidence.map((ev, i) => (
                            <div key={i} className="text-xs text-slate-300 bg-slate-800/50 p-2 rounded mb-1">
                              {ev.description}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-slate-300 text-xs flex items-center gap-1">
                        <Info className="w-3 h-3 text-cyan-400" />
                        <span className="text-slate-400">建议:</span> {conflict.suggestion}
                      </p>
                    </div>
                  ))}
                </div>

                {importResult.config && importResult.errors.length === 0 && (
                  <button
                    onClick={applyConfigWithWarnings}
                    className="mt-3 w-full py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 transition-all"
                  >
                    仍使用此配置（保留冲突记录）
                  </button>
                )}
              </div>
            )}

            {importResult.errors.length === 0 && importResult.warnings.length === 0 && (!importResult.conflicts || importResult.conflicts.length === 0) && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">数据校验通过</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowRawData(!showRawData)}
              className="mt-2 text-sm text-slate-400 hover:text-slate-300 flex items-center gap-1"
            >
              <Info className="w-4 h-4" />
              {showRawData ? '隐藏' : '显示'}原始数据
            </button>

            {showRawData && (
              <pre className="mt-2 p-3 bg-slate-900 rounded-lg text-xs text-slate-400 overflow-auto max-h-40">
                {importResult.rawData}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

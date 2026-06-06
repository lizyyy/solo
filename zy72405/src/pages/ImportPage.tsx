import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { parseContractText, generateMockContractText, generateMockContractTextV2 } from '@/utils/contractParser';
import { ParsedContractLine } from '@/types';
import { Upload, FileText, CheckCircle, AlertTriangle, Hash, Layers, RefreshCw } from 'lucide-react';

export function ImportPage() {
  const [text, setText] = useState('');
  const [parsedLines, setParsedLines] = useState<ParsedContractLine[]>([]);
  const [importResult, setImportResult] = useState<{ newCount: number; duplicateCount: number } | null>(null);
  const [fileName, setFileName] = useState('合同页截图.txt');

  const currentUser = useStore(state => state.currentUser);
  const importContractLines = useStore(state => state.importContractLines);
  const existingRecords = useStore(state => state.records);

  const handleParse = () => {
    if (!text.trim()) return;
    const lines = parseContractText(text);
    setParsedLines(lines);
    setImportResult(null);
  };

  const handleImport = () => {
    if (parsedLines.length === 0) return;
    const result = importContractLines(parsedLines, fileName, currentUser.name);
    setImportResult(result);
  };

  const loadMockData = () => {
    setText(generateMockContractText());
    setFileName('2024夏季巡演合同页01.txt');
    setParsedLines([]);
    setImportResult(null);
  };

  const loadMockDataV2 = () => {
    setText(generateMockContractTextV2());
    setFileName('2024夏季巡演合同页01-更新版.txt');
    setParsedLines([]);
    setImportResult(null);
  };

  const isDuplicate = (line: ParsedContractLine) => {
    return existingRecords.some(
      r => r.originalLineNumber === line.lineNumber &&
           r.originalContent.trim() === line.content.trim()
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800 mb-1">合同页截图导入</h1>
        <p className="text-stone-500 text-sm">支持去重检测，重复导入不会导致数量翻倍</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                合同页内容（模拟OCR识别结果）
              </label>
              <div className="flex gap-2">
                <button
                  onClick={loadMockData}
                  className="px-2.5 py-1 text-xs bg-stone-100 text-stone-600 rounded hover:bg-stone-200 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  加载示例数据
                </button>
                <button
                  onClick={loadMockDataV2}
                  className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors flex items-center gap-1"
                >
                  <Layers className="w-3 h-3" />
                  加载更新版（含重复）
                </button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setParsedLines([]); setImportResult(null); }}
              placeholder="粘贴合同页OCR识别内容，每行一条记录..."
              className="w-full h-64 p-3 border border-stone-200 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            <div className="mt-3">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="文件名"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <button
              onClick={handleParse}
              disabled={!text.trim()}
              className="mt-3 w-full py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              解析并预览
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
            <div className="p-4 border-b border-stone-100">
              <h3 className="font-medium text-stone-800 flex items-center gap-2">
                <Hash className="w-4 h-4 text-amber-600" />
                导入预览
                {parsedLines.length > 0 && (
                  <span className="text-xs font-normal text-stone-500">
                    共 {parsedLines.length} 条
                  </span>
                )}
              </h3>
            </div>

            {parsedLines.length === 0 ? (
              <div className="p-12 text-center text-stone-400">
                <Upload className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">解析后将在此处显示预览</p>
              </div>
            ) : (
              <>
                <div className="max-h-80 overflow-y-auto">
                  {parsedLines.map((line, idx) => {
                    const dup = isDuplicate(line);
                    return (
                      <div
                        key={idx}
                        className={`px-4 py-3 border-b border-stone-100 last:border-0 ${
                          dup ? 'bg-red-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-amber-600 font-bold">
                                第{line.lineNumber}行
                              </span>
                              {dup && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                  <AlertTriangle className="w-3 h-3" />
                                  重复记录
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-stone-700 font-mono truncate">{line.content}</p>
                            <div className="mt-1 text-xs text-stone-500">
                              曲目: {line.trackName} | 数量: {line.quantity} 张
                            </div>
                          </div>
                          {dup ? (
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-stone-100">
                  {importResult ? (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 text-green-800 font-medium mb-1">
                        <CheckCircle className="w-4 h-4" />
                        导入完成
                      </div>
                      <p className="text-sm text-green-700">
                        新增 {importResult.newCount} 条记录，跳过 {importResult.duplicateCount} 条重复记录
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleImport}
                      className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      确认导入（去重模式）
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              去重规则
            </h4>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li>通过原始行号 + 原始内容精确匹配去重</li>
              <li>重复导入同一批合同页截图不会导致数量翻倍</li>
              <li>重复的记录会被跳过，只新增新的记录</li>
              <li>所有操作都保留在变更历史中，可追溯</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

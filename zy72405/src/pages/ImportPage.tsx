import { useState, useMemo } from 'react';
import { useStore, ImportExecutionResult } from '@/store/useStore';
import { parseContractText, generateMockContractText, generateMockContractTextV2 } from '@/utils/contractParser';
import { ParsedContractLine } from '@/types';
import { ClassifiedImportResult, ClassifiedImportLine } from '@/utils/deduplication';
import { getFieldDisplayName, formatValue } from '@/utils/changeTracker';
import { Link } from 'react-router-dom';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Hash,
  Layers,
  RefreshCw,
  CopyPlus,
  Edit3,
  Sparkles,
  ArrowRight,
  Download,
  XCircle
} from 'lucide-react';

export function ImportPage() {
  const [text, setText] = useState('');
  const [parsedLines, setParsedLines] = useState<ParsedContractLine[]>([]);
  const [classifiedPreview, setClassifiedPreview] = useState<ClassifiedImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportExecutionResult | null>(null);
  const [fileName, setFileName] = useState('合同页截图.txt');

  const currentUser = useStore(state => state.currentUser);
  const previewImport = useStore(state => state.previewImport);
  const importContractLines = useStore(state => state.importContractLines);

  const handleParse = () => {
    if (!text.trim()) return;
    const lines = parseContractText(text);
    setParsedLines(lines);
    setImportResult(null);
    const classified = previewImport(lines);
    setClassifiedPreview(classified);
  };

  const handleImport = () => {
    if (parsedLines.length === 0) return;
    const result = importContractLines(parsedLines, fileName, currentUser.name);
    setImportResult(result);
    setClassifiedPreview(result.details);
  };

  const loadMockData = () => {
    setText(generateMockContractText());
    setFileName('2024夏季巡演合同页01.txt');
    setParsedLines([]);
    setClassifiedPreview(null);
    setImportResult(null);
  };

  const loadMockDataV2 = () => {
    setText(generateMockContractTextV2());
    setFileName('2024夏季巡演合同页01-更新版.txt');
    setParsedLines([]);
    setClassifiedPreview(null);
    setImportResult(null);
  };

  const summary = useMemo(() => {
    if (!classifiedPreview) return null;
    return {
      total: classifiedPreview.reused.length + classifiedPreview.modified.length + classifiedPreview.added.length,
      reused: classifiedPreview.reused.length,
      modified: classifiedPreview.modified.length,
      added: classifiedPreview.added.length
    };
  }, [classifiedPreview]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800 mb-1">合同页截图导入</h1>
        <p className="text-stone-500 text-sm">自动区分「完全复用」「内容变更」「真正新增」三类记录，变更自动写入证据链</p>
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
                  加载初次导入数据
                </button>
                <button
                  onClick={loadMockDataV2}
                  className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors flex items-center gap-1"
                >
                  <Layers className="w-3 h-3" />
                  加载重复导入数据
                </button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setParsedLines([]); setClassifiedPreview(null); setImportResult(null); }}
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
              解析并预览分类结果
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
            <div className="p-4 border-b border-stone-100">
              <h3 className="font-medium text-stone-800 flex items-center gap-2">
                <Hash className="w-4 h-4 text-amber-600" />
                导入预览与分类报告
                {summary && (
                  <span className="text-xs font-normal text-stone-500 ml-2">
                    共 {summary.total} 条记录
                  </span>
                )}
              </h3>
            </div>

            {!classifiedPreview ? (
              <div className="p-12 text-center text-stone-400">
                <Upload className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">解析后将在此处显示分类预览</p>
              </div>
            ) : (
              <>
                {summary && (
                  <div className="p-4 border-b border-stone-100 bg-stone-50">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                          <CopyPlus className="w-4 h-4 text-gray-500" />
                          <span className="text-xs text-gray-600">完全复用</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-700">{summary.reused}</div>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Edit3 className="w-4 h-4 text-amber-600" />
                          <span className="text-xs text-amber-700">内容变更</span>
                        </div>
                        <div className="text-2xl font-bold text-amber-700">{summary.modified}</div>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="w-4 h-4 text-green-600" />
                          <span className="text-xs text-green-700">真正新增</span>
                        </div>
                        <div className="text-2xl font-bold text-green-700">{summary.added}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="max-h-96 overflow-y-auto">
                  {classifiedPreview.reused.length > 0 && (
                    <ImportCategorySection
                      title="完全复用（无变化）"
                      icon={<CopyPlus className="w-4 h-4" />}
                      tone="gray"
                      items={classifiedPreview.reused}
                    />
                  )}
                  {classifiedPreview.modified.length > 0 && (
                    <ImportCategorySection
                      title="内容变更（同一行号，内容有修改）"
                      icon={<Edit3 className="w-4 h-4" />}
                      tone="amber"
                      items={classifiedPreview.modified}
                    />
                  )}
                  {classifiedPreview.added.length > 0 && (
                    <ImportCategorySection
                      title="真正新增（首次出现的行号）"
                      icon={<Sparkles className="w-4 h-4" />}
                      tone="green"
                      items={classifiedPreview.added}
                    />
                  )}
                </div>

                <div className="p-4 border-t border-stone-100">
                  {importResult ? (
                    <div>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200 mb-3">
                        <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                          <CheckCircle className="w-4 h-4" />
                          导入完成 - 处理报告
                        </div>
                        <ul className="text-sm text-green-700 space-y-1">
                          <li>• 完全复用记录：{importResult.reused} 条（未做任何修改）</li>
                          <li>• 内容变更记录：{importResult.modified} 条（自动同步并生成变更日志）</li>
                          <li>• 真正新增记录：{importResult.added} 条（创建新记录并初始化证据链）</li>
                        </ul>
                        {importResult.modifiedRecordIds.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-green-200">
                            <p className="text-xs text-green-600 mb-1">变更的记录可在详情中查看改动历史：</p>
                            <div className="flex flex-wrap gap-1.5">
                              {importResult.modifiedRecordIds.slice(0, 5).map(id => (
                                <Link
                                  key={id}
                                  to={`/record/${id}`}
                                  className="px-2 py-0.5 bg-white text-green-700 rounded text-xs border border-green-300 hover:bg-green-100 transition-colors"
                                >
                                  查看记录 #{id.slice(-4)}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <Link
                        to="/"
                        className="w-full block text-center py-2.5 bg-stone-100 text-stone-700 rounded-lg font-medium hover:bg-stone-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <ArrowRight className="w-4 h-4" />
                        返回缺货提醒列表
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={handleImport}
                      className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      确认导入（按分类规则处理）
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              分类匹配规则
            </h4>
            <ul className="text-xs text-amber-700 space-y-1.5 list-disc list-inside">
              <li><b>完全复用</b>：原始行号 + 原始内容 精确匹配 → 跳过，不产生任何变更</li>
              <li><b>内容变更</b>：原始行号 相同，但内容/数量/备注有变化 → 更新原有记录，自动写入证据链</li>
              <li><b>真正新增</b>：原始行号 未出现过 → 创建新记录，初始化完整证据链</li>
              <li>同一批合同页截图重复导入不会导致数量翻倍</li>
              <li>音乐老师许老师只改了一条备注 → 会被识别为「内容变更」写入历史</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportCategorySection({
  title,
  icon,
  tone,
  items
}: {
  title: string;
  icon: React.ReactNode;
  tone: 'gray' | 'amber' | 'green';
  items: ClassifiedImportLine[];
}) {
  const toneConfig = {
    gray: {
      bg: 'bg-gray-50',
      border: 'border-gray-100',
      text: 'text-gray-700',
      icon: 'text-gray-500',
      badge: 'bg-gray-100 text-gray-600'
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      text: 'text-amber-800',
      icon: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-700'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-100',
      text: 'text-green-800',
      icon: 'text-green-600',
      badge: 'bg-green-100 text-green-700'
    }
  }[tone];

  return (
    <div className={`border-b border-stone-100 last:border-0`}>
      <div className={`px-4 py-2.5 ${toneConfig.bg} ${toneConfig.border} border-b flex items-center justify-between`}>
        <div className={`flex items-center gap-2 text-sm font-medium ${toneConfig.text}`}>
          <span className={toneConfig.icon}>{icon}</span>
          {title}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${toneConfig.badge}`}>
          {items.length} 条
        </span>
      </div>
      <div className="divide-y divide-stone-50">
        {items.map((item, idx) => (
          <div key={idx} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-amber-600 font-bold">
                  第{item.line.lineNumber}行
                </span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${toneConfig.badge}`}>
                  {tone === 'gray' ? '复用' : tone === 'amber' ? '变更' : '新增'}
                </span>
              </div>
              <div className="text-xs text-stone-500">
                曲目: {item.line.trackName} · {item.line.quantity} 张
              </div>
            </div>

            {tone === 'amber' && item.changedFields && item.changedFields.length > 0 ? (
              <div className="ml-2 space-y-1.5 mt-2">
                {item.changedFields.map((change, cIdx) => (
                  <div key={cIdx} className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-stone-600 min-w-[80px]">
                      {getFieldDisplayName(change.field)}:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded line-through">
                        {formatValue(change.field, change.oldValue)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-stone-400" />
                      <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-medium">
                        {formatValue(change.field, change.newValue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-600 font-mono truncate ml-2">
                {item.line.content}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

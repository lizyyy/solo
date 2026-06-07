import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  Layers,
  ArrowLeft,
  RefreshCw,
  FileText,
  Check,
  X,
  Info,
} from 'lucide-react';
import { useConflictStore } from '@/store/useConflictStore';
import { parseKnowledgeLinks, detectDuplicatesAndChanges } from '@/utils/deduplicator';
import type { KnowledgeLink, Conflict } from '@/types';
import { cn } from '@/lib/utils';

const sampleLinks = `https://wiki.example.com/knowledge/IMG-2024-00123?v=3.2.0
https://wiki.example.com/knowledge/IMG-2024-00178?v=3.2.0
https://wiki.example.com/knowledge/IMG-2024-00234?v=3.2.0
https://wiki.example.com/knowledge/IMG-2024-00300?v=3.1.5`;

export default function ImportPage() {
  const navigate = useNavigate();
  const { conflicts, knowledgeLinks, addConflicts, addKnowledgeLinks } = useConflictStore();
  const [inputText, setInputText] = useState('');
  const [parsedLinks, setParsedLinks] = useState<KnowledgeLink[]>([]);
  const [previewResult, setPreviewResult] = useState<{
    newConflicts: Conflict[];
    updatedConflicts: Conflict[];
    duplicateCount: number;
    modelChangedCount: number;
  } | null>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'done'>('input');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = () => {
    if (!inputText.trim()) return;
    
    setIsAnalyzing(true);
    
    setTimeout(() => {
      const links = parseKnowledgeLinks(inputText);
      setParsedLinks(links);
      
      const result = detectDuplicatesAndChanges(links, conflicts, knowledgeLinks);
      setPreviewResult(result);
      setStep('preview');
      setIsAnalyzing(false);
    }, 800);
  };

  const handleConfirm = () => {
    if (!previewResult) return;
    
    const allNewConflicts = [...previewResult.newConflicts, ...previewResult.updatedConflicts];
    addConflicts(allNewConflicts);
    addKnowledgeLinks(parsedLinks);
    setStep('done');
  };

  const handleFillSample = () => {
    setInputText(sampleLinks);
  };

  const handleReset = () => {
    setInputText('');
    setParsedLinks([]);
    setPreviewResult(null);
    setStep('input');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-800">知识库导入</h1>
          <p className="text-sm text-slate-500 mt-1">批量导入知识库引用链接，自动检测冲突</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          {['粘贴链接', '预览结果', '导入完成'].map((label, index) => {
            const stepIndex = step === 'input' ? 0 : step === 'preview' ? 1 : 2;
            const isActive = index <= stepIndex;
            const isCurrent = index === stepIndex;
            
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  )}
                >
                  {index < stepIndex ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCurrent ? 'text-primary-600' : isActive ? 'text-slate-700' : 'text-slate-400'
                  )}
                >
                  {label}
                </span>
                {index < 2 && (
                  <div
                    className={cn(
                      'w-16 h-0.5 mx-2',
                      index < stepIndex ? 'bg-primary-500' : 'bg-slate-200'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                知识库引用链接
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="每行一个链接，例如：&#10;https://wiki.example.com/knowledge/IMG-2024-00123?v=3.2.0&#10;https://wiki.example.com/knowledge/IMG-2024-00145?v=3.2.0"
                rows={10}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none font-mono"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <button
                onClick={handleFillSample}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                填充示例数据
              </button>
              <div className="text-xs text-slate-400">
                支持自动解析样本编号和模型版本
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700 space-y-1">
                  <p className="font-medium">导入说明</p>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                    <li>系统会自动检测重复导入，不会导致冲突数量翻倍</li>
                    <li>模型版本更换但样本编号不变的记录会被标记为待复核</li>
                    <li>所有标记为版本变更的记录都需要运营复核人最终确认</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!inputText.trim() || isAnalyzing}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                inputText.trim() && !isAnalyzing
                  ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:-translate-y-0.5'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  分析并预览结果
                </>
              )}
            </button>
          </div>
        )}

        {step === 'preview' && previewResult && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700">新增冲突</span>
                </div>
                <p className="text-2xl font-bold text-emerald-700 font-mono">
                  {previewResult.newConflicts.length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-700">版本变更</span>
                </div>
                <p className="text-2xl font-bold text-purple-700 font-mono">
                  {previewResult.modelChangedCount}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <X className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">重复跳过</span>
                </div>
                <p className="text-2xl font-bold text-slate-600 font-mono">
                  {previewResult.duplicateCount}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">链接总数</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 font-mono">
                  {parsedLinks.length}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">
                检测结果详情
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">样本编号</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">模型版本</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedLinks.map((link, index) => {
                        const isUpdated = previewResult.updatedConflicts.some(
                          (c) => c.sampleNumber === link.sampleNumber && c.modelVersion === link.modelVersion
                        );
                        const isNew = previewResult.newConflicts.some(
                          (c) => c.sampleNumber === link.sampleNumber && c.modelVersion === link.modelVersion
                        );
                        const isDuplicate = !isUpdated && !isNew;

                        return (
                          <tr key={index} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono text-sm text-slate-700">
                              {link.sampleNumber}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-mono text-slate-600">{link.modelVersion}</span>
                            </td>
                            <td className="px-4 py-3">
                              {isUpdated ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                                  <Layers className="w-3 h-3" />
                                  版本变更
                                </span>
                              ) : isNew ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
                                  <Check className="w-3 h-3" />
                                  新增冲突
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 text-slate-500 text-xs font-medium border border-slate-200">
                                  <X className="w-3 h-3" />
                                  重复跳过
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {previewResult.modelChangedCount > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">
                      检测到 {previewResult.modelChangedCount} 条模型版本变更记录
                    </p>
                    <p className="text-amber-700">
                      这些记录样本编号未变但模型版本已更新，系统不会自动归为正常，将标记为待复核状态，交由运营复核人处理。
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                返回修改
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-medium shadow-lg shadow-primary-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                确认导入
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">导入成功！</h2>
            <p className="text-slate-500 mb-6">
              知识库链接已成功导入，冲突记录已更新
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                继续导入
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-medium shadow-lg shadow-primary-500/25 hover:shadow-xl transition-all"
              >
                查看冲突列表
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

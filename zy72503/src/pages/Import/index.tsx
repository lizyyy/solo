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
  ExternalLink,
  Clock,
  Hash,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useConflictStore } from '@/store/useConflictStore';
import { parseKnowledgeLinks, detectDuplicatesAndChanges, getBatches } from '@/utils/deduplicator';
import type { KnowledgeLink, ImportResultItem } from '@/types';
import { cn } from '@/lib/utils';

const sampleLinks = `https://wiki.example.com/knowledge/IMG-2024-00301?v=3.2.0
https://wiki.example.com/knowledge/IMG-2024-00302?v=3.2.0
https://wiki.example.com/knowledge/IMG-2024-00303?v=3.2.0
https://wiki.example.com/knowledge/IMG-2024-00301?v=3.3.0
https://wiki.example.com/knowledge/IMG-2024-00304?v=3.1.5`;

const statusConfig = {
  new: { label: '新增冲突', icon: CheckCircle, color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  model_changed: { label: '版本变更', icon: Layers, color: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  duplicate: { label: '重复跳过', icon: X, color: 'slate', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  no_conflict: { label: '无冲突', icon: Check, color: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

export default function ImportPage() {
  const navigate = useNavigate();
  const { conflicts, knowledgeLinks, addConflicts, addKnowledgeLinks } = useConflictStore();
  const [inputText, setInputText] = useState('');
  const [parsedLinks, setParsedLinks] = useState<KnowledgeLink[]>([]);
  const [previewResult, setPreviewResult] = useState<{
    newConflicts: any[];
    updatedConflicts: any[];
    duplicateCount: number;
    modelChangedCount: number;
    noConflictCount: number;
    items: ImportResultItem[];
  } | null>(null);
  const [step, setStep] = useState<'input' | 'preview' | 'done'>('input');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const batches = getBatches(knowledgeLinks);

  const handleAnalyze = () => {
    if (!inputText.trim()) return;
    
    setIsAnalyzing(true);
    
    setTimeout(() => {
      const batchId = `batch_${Date.now()}`;
      const links = parseKnowledgeLinks(inputText, batchId);
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
    setExpandedItem(null);
    setFilterStatus('all');
  };

  const filteredItems = previewResult?.items.filter(
    (item) => filterStatus === 'all' || item.status === filterStatus
  ) || [];

  const renderStatusBadge = (status: keyof typeof statusConfig) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border',
        config.bg,
        config.text,
        config.border
      )}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-800">知识库导入</h1>
          <p className="text-sm text-slate-500 mt-1">批量导入知识库引用链接，自动检测冲突和版本变更</p>
        </div>
      </div>

      {step !== 'input' && batches.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">历史导入批次</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {batches.slice(0, 5).map((batch) => (
              <div
                key={batch.batchId}
                className="px-3 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200"
              >
                <Hash className="w-3 h-3 inline mr-1" />
                {batch.batchId.substring(0, 18)}...
                <span className="ml-2 text-slate-400">{batch.count}条</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                placeholder="每行一个链接，支持以下格式：&#10;• https://wiki.example.com/knowledge/IMG-2024-00123?v=3.2.0&#10;• https://wiki.example.com/knowledge/v3.3.0/IMG-2024-00145&#10;• 纯文本编号 IMG_2024_00300 （默认v3.2.0）&#10;&#10;系统会自动解析样本编号和模型版本"
                rows={10}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none font-mono"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <button
                onClick={handleFillSample}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                填充示例数据（含版本变更换样例）
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
                    <li>同一批链接重复导入，结果完全一致，可追溯</li>
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">链接总数</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 font-mono">
                  {parsedLinks.length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700">新增冲突</span>
                </div>
                <p className="text-2xl font-bold text-emerald-700 font-mono">
                  {previewResult.newConflicts.length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-700">版本变更</span>
                </div>
                <p className="text-2xl font-bold text-amber-700 font-mono">
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
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">无冲突</span>
                </div>
                <p className="text-2xl font-bold text-slate-600 font-mono">
                  {previewResult.noConflictCount}
                </p>
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
                      这些记录样本编号未变但模型版本已更新，标签结果发生了变化。系统不会自动归为正常，将标记为待复核状态，交由运营复核人处理。
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-slate-800">
                  检测结果详情
                </h3>
                <div className="flex items-center gap-1">
                  {['all', 'new', 'model_changed', 'duplicate', 'no_conflict'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                        filterStatus === status
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      {status === 'all' ? '全部' : statusConfig[status as keyof typeof statusConfig]?.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 w-10"></th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">样本编号</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">模型版本</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">状态</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item, index) => (
                        <>
                          <tr 
                            key={index} 
                            className="hover:bg-slate-50/50 cursor-pointer"
                            onClick={() => setExpandedItem(expandedItem === index ? null : index)}
                          >
                            <td className="px-4 py-3">
                              {expandedItem === index 
                                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                                : <ChevronDown className="w-4 h-4 text-slate-400" />
                              }
                            </td>
                            <td className="px-4 py-3 font-mono text-sm text-slate-700">
                              {item.sampleNumber}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-slate-600">{item.modelVersion}</span>
                                {item.previousModelVersion && (
                                  <span className="text-xs text-slate-400">
                                    ← {item.previousModelVersion}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {renderStatusBadge(item.status)}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                              {item.reason}
                            </td>
                          </tr>
                          {expandedItem === index && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={5} className="px-4 py-4">
                                <div className="pl-6 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4 text-slate-400" />
                                    <a 
                                      href={item.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary-600 hover:underline truncate"
                                    >
                                      {item.url}
                                    </a>
                                  </div>
                                  
                                  {item.status === 'duplicate' && item.duplicateSourceBatch && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                      <span className="text-slate-400">重复来源批次：</span>
                                      <span className="font-mono text-slate-700">{item.duplicateSourceBatch}</span>
                                    </div>
                                  )}

                                  {item.previousLabel && item.newLabel && (
                                    <div className="flex items-center gap-4 text-sm">
                                      <div>
                                        <span className="text-slate-400">旧标签：</span>
                                        <span className={cn(
                                          'px-2 py-0.5 rounded text-xs font-medium',
                                          item.status === 'model_changed' ? 'bg-red-100 text-red-700 line-through' : 'bg-slate-100 text-slate-600'
                                        )}>
                                          {item.previousLabel}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400">新标签：</span>
                                        <span className={cn(
                                          'px-2 py-0.5 rounded text-xs font-medium',
                                          item.status === 'no_conflict' ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-100 text-emerald-700'
                                        )}>
                                          {item.newLabel}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {item.conflictId && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-slate-400">冲突记录ID：</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/conflict/${item.conflictId}`);
                                        }}
                                        className="font-mono text-primary-600 hover:underline"
                                      >
                                        {item.conflictId.substring(0, 20)}...
                                      </button>
                                    </div>
                                  )}

                                  <div className="text-xs text-slate-500 bg-slate-100 rounded-lg px-3 py-2">
                                    <span className="font-medium">处理结论：</span>
                                    {item.reason}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

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
            
            <div className="max-w-md mx-auto mb-6 p-4 bg-slate-50 rounded-xl text-left">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">导入链接数</span>
                  <span className="font-medium text-slate-700">{parsedLinks.length} 条</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">新增冲突</span>
                  <span className="font-medium text-emerald-600">{previewResult?.newConflicts.length || 0} 条</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">版本变更待复核</span>
                  <span className="font-medium text-amber-600">{previewResult?.modelChangedCount || 0} 条</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">重复跳过</span>
                  <span className="font-medium text-slate-600">{previewResult?.duplicateCount || 0} 条</span>
                </div>
              </div>
            </div>

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

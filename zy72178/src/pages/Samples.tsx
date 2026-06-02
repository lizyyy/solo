import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileJson,
  CheckSquare,
  Square,
  Trash2,
  Eye,
  Search,
  Filter,
  Download,
  X,
  FileText,
  MessageSquare,
  User,
  Clock,
} from 'lucide-react';
import { Sidebar } from '../components/Layout/Sidebar';
import { Header } from '../components/Layout/Header';
import { JudgmentBadge } from '../components/JudgmentBadge';
import { useSampleStore } from '../store/sampleStore';
import { useCheckupStore } from '../store/checkupStore';
import { useAppStore } from '../store/appStore';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../utils/date';
import { cn } from '../lib/utils';
import type { Sample, ImportSampleInput } from '../types';

export default function Samples() {
  const navigate = useNavigate();
  const {
    samples,
    loading,
    fetchSamples,
    importSamples,
    toggleSampleSelection,
    selectAllSamples,
    clearSelection,
    selectedSampleIds,
  } = useSampleStore();
  const { currentRun, fetchRuns } = useCheckupStore();
  const { sidebarOpen } = useAppStore();
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSamples();
    fetchRuns();
  }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.jsonl') || f.name.endsWith('.json'));
    if (files.length > 0) {
      try {
        await importSamples(files[0]);
      } catch (error) {
        alert('导入失败: ' + (error as Error).message);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        await importSamples(files[0]);
      } catch (error) {
        alert('导入失败: ' + (error as Error).message);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredSamples = samples.filter(s => {
    const matchesSearch = s.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.knowledgeSource.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterSource === 'all' || s.knowledgeSource === filterSource;
    return matchesSearch && matchesFilter;
  });

  const sources = Array.from(new Set(samples.map(s => s.knowledgeSource)));

  const allSelected = filteredSamples.length > 0 &&
    filteredSamples.every(s => selectedSampleIds.includes(s.id));

  const downloadSampleTemplate = () => {
    const template: ImportSampleInput[] = [
      {
        question: "示例问题1？",
        reference_answer: "参考答案1",
        model_output: "模型输出1",
        manual_correction: "人工修正（可选）",
        online_feedback: "线上反馈（可选）",
        knowledge_source: "docs/source.md",
        original_data: { conversation_id: "conv_001" }
      },
      {
        question: "示例问题2？",
        reference_answer: "参考答案2",
        model_output: "模型输出2",
        knowledge_source: "docs/source2.md",
      }
    ];
    const content = template.map(t => JSON.stringify(t)).join('\n');
    const blob = new Blob([content], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_template.jsonl';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className={cn(
        "transition-all duration-300 min-h-screen",
        sidebarOpen ? "ml-[260px]" : "ml-[72px]"
      )}>
        <Header
          title="样本管理"
          subtitle="管理RAG引用体检的样本数据，支持导入、查看和批量操作"
        />

        <main className="p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                dragOver
                  ? "border-primary-400 bg-primary-50"
                  : "border-slate-300 hover:border-primary-300 hover:bg-slate-50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jsonl,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className={cn(
                "w-12 h-12 mx-auto mb-3",
                dragOver ? "text-primary-500" : "text-slate-400"
              )} />
              <p className="text-lg font-medium text-slate-700 mb-1">
                {dragOver ? "释放文件开始导入" : "拖拽JSONL文件到此处"}
              </p>
              <p className="text-sm text-slate-500 mb-3">
                或点击选择文件，支持 .jsonl 和 .json 格式
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); downloadSampleTemplate(); }}
                  className="btn btn-secondary gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  下载模板
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-4 mb-4"
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-64 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  className="input pl-10"
                  placeholder="搜索问题或知识库来源..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  className="input w-48"
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                >
                  <option value="all">全部来源</option>
                  {sources.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={allSelected ? clearSelection : selectAllSamples}
                  className="btn btn-secondary gap-2 text-sm"
                >
                  {allSelected ? (
                    <><Square className="w-4 h-4" /> 取消全选</>
                  ) : (
                    <><CheckSquare className="w-4 h-4" /> 全选</>
                  )}
                </button>
                {selectedSampleIds.length > 0 && (
                  <span className="text-sm text-slate-600">
                    已选择 {selectedSampleIds.length} 条
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card overflow-hidden"
          >
            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3" />
                加载中...
              </div>
            ) : filteredSamples.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无样本数据</p>
                <p className="text-sm mt-1">导入JSONL文件开始使用</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">
                        <button
                          onClick={allSelected ? clearSelection : selectAllSamples}
                          className="text-slate-500 hover:text-primary-600"
                        >
                          {allSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                        问题
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                        知识库来源
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                        导入信息
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredSamples.map((sample, idx) => {
                      const isSelected = selectedSampleIds.includes(sample.id);
                      return (
                        <motion.tr
                          key={sample.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          className={cn(
                            "hover:bg-slate-50 transition-colors",
                            isSelected && "bg-primary-50/50"
                          )}
                        >
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleSampleSelection(sample.id)}
                              className="text-slate-500 hover:text-primary-600"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-primary-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-slate-800 font-medium line-clamp-2 max-w-md">
                              {sample.question}
                            </p>
                            {sample.referenceAnswer && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                参考: {sample.referenceAnswer}
                              </p>
                            )}
                            {sample.onlineFeedback && (
                              <div className="flex items-center gap-1 mt-1">
                                <MessageSquare className="w-3 h-3 text-accent-amber-500" />
                                <span className="text-xs text-accent-amber-600 line-clamp-1">
                                  {sample.onlineFeedback}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">
                              {sample.knowledgeSource}
                            </code>
                            <p className="text-xs text-slate-500 mt-1">
                              {sample.sourceFile}:{sample.sourceLine}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <User className="w-3 h-3" />
                              {sample.importedBy}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {formatDateTime(sample.importedAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setSelectedSample(sample)}
                              className="btn btn-secondary gap-1 text-xs py-1 px-2"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              详情
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </main>
      </div>

      {selectedSample && (
        <SampleDetailModal
          sample={selectedSample}
          onClose={() => setSelectedSample(null)}
        />
      )}
    </div>
  );
}

function SampleDetailModal({ sample, onClose }: { sample: Sample; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-serif font-bold text-slate-800">样本详情</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="label">问题</label>
            <p className="text-slate-800">{sample.question}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">知识库来源</label>
              <code className="text-sm bg-slate-100 px-2 py-1 rounded text-slate-700 block">
                {sample.knowledgeSource}
              </code>
            </div>
            <div>
              <label className="label">源文件位置</label>
              <p className="text-slate-700 text-sm">{sample.sourceFile}:{sample.sourceLine}</p>
            </div>
          </div>
          {sample.referenceAnswer && (
            <div>
              <label className="label">参考答案</label>
              <div className="quote-block">{sample.referenceAnswer}</div>
            </div>
          )}
          {sample.modelOutput && (
            <div>
              <label className="label">模型输出</label>
              <div className="quote-block border-l-accent-amber-300 bg-accent-amber-50">
                {sample.modelOutput}
              </div>
            </div>
          )}
          {sample.manualCorrection && (
            <div>
              <label className="label">人工修正</label>
              <div className="quote-block border-l-accent-emerald-300 bg-accent-emerald-50">
                {sample.manualCorrection}
              </div>
            </div>
          )}
          {sample.onlineFeedback && (
            <div>
              <label className="label">线上反馈</label>
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700">
                {sample.onlineFeedback}
              </div>
            </div>
          )}
          {Object.keys(sample.originalData).length > 0 && (
            <div>
              <label className="label">原始数据</label>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto">
                {JSON.stringify(sample.originalData, null, 2)}
              </pre>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200">
            <div>
              <label className="label">导入人</label>
              <p className="text-slate-700 text-sm">{sample.importedBy}</p>
            </div>
            <div>
              <label className="label">导入时间</label>
              <p className="text-slate-700 text-sm">{formatDateTime(sample.importedAt)}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

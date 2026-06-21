import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  RotateCcw,
  FilePlus,
  CheckCircle,
  AlertCircle,
  Save,
  Network,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import type { ErrorRecord, AttributionType, RecordStatus } from '@/types';

type ImportType = 'answer' | 'withdrawn' | 'supplement';

const importTypeLabels: Record<ImportType, string> = {
  answer: '历史答案',
  withdrawn: '撤回记录',
  supplement: '补充说明',
};

const sampleTemplates: Record<ImportType, string> = {
  answer: `// 历史答案示例
学生姓名：林小雅
学生ID：s001
题目：图的遍历-BFS与DFS
学生答案：BFS用栈，DFS用队列
正确答案：BFS用队列，DFS用栈
知识点：n1
归因类型：concept
归因标签：概念误解`,
  withdrawn: `// 撤回记录（用于复算）
学生姓名：林小雅
学生ID：s001
题目ID：q101
题目：有向图中最短路径的 Dijkstra 算法应用
学生答案：使用 Floyd 算法，时间复杂度 O(n³)
正确答案：使用 Dijkstra 算法，时间复杂度 O((n+m)logn)
知识点：n2
归因类型：concept
归因标签：算法选型错误
备注：从历史答案库撤回补录，此前该生提交过同一题
状态：withdrawn`,
  supplement: `// 补充说明
学生姓名：陈思琪
学生ID：s003
题目：带负权边的最短路径求解
学生答案：直接用 Dijkstra 算法求解
正确答案：负权边图需用 Bellman-Ford 或 SPFA
知识点：n2
归因类型：thinking
归因标签：思路偏差
备注：之前漏记了负权边的特殊情况说明`,
};

export default function TopBar() {
  const {
    resetToSeed,
    caliberCheckPassed,
    lastRecalcTime,
    importRawRecord,
  } = useAppStore();

  const [toast, setToast] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importType, setImportType] = useState<ImportType>('withdrawn');
  const [parseError, setParseError] = useState<string | null>(null);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleReset = () => {
    if (confirm('确定要重置为演示数据吗？当前所有操作都会丢失。')) {
      resetToSeed();
      showToastMsg('已重置为演示数据');
    }
  };

  const loadTemplate = () => {
    setImportText(sampleTemplates[importType]);
    setParseError(null);
  };

  const parseRecord = (text: string, type: ImportType): ErrorRecord | null => {
    const get = (key: string) => {
      const regex = new RegExp(`(?:${key})[：:](.+)$`, 'm');
      const match = text.match(regex);
      return match ? match[1].trim() : '';
    };

    const studentName = get('学生姓名') || get('姓名');
    const studentId = get('学生ID') || get('学号') || get('id');
    const questionId = get('题目ID') || get('题号');
    const questionTitle = get('题目') || get('题干');
    const studentAnswer = get('学生答案') || get('作答');
    const correctAnswer = get('正确答案') || get('参考答案');
    const nodeId = get('知识点') || get('节点');
    const attributionTypeRaw = (get('归因类型') || 'concept') as AttributionType;
    const attribution = get('归因标签') || get('归因');
    const note = get('备注') || get('说明');
    const statusRaw = get('状态');

    if (!studentName || !questionTitle) {
      setParseError('请至少填写「学生姓名」和「题目」');
      return null;
    }

    if (!nodeId || !['n1', 'n2', 'n3', 'n4', 'n5'].includes(nodeId)) {
      setParseError('知识点必须是 n1-n5 之间：n1=图论基础, n2=最短路径, n3=拓扑排序, n4=最小生成树, n5=网络流');
      return null;
    }

    if (!['concept', 'calculation', 'thinking', 'reading'].includes(attributionTypeRaw)) {
      setParseError('归因类型必须是：concept / calculation / thinking / reading');
      return null;
    }

    const isWithdrawn = type === 'withdrawn' || statusRaw === 'withdrawn';
    const status: RecordStatus = type === 'answer' ? 'processed' : 'pending';

    const record: ErrorRecord = {
      id: 'r' + Date.now().toString(36).slice(-6),
      studentId: studentId || ('s' + Math.random().toString(36).slice(2, 6)),
      studentName,
      questionId: questionId || ('q' + Math.random().toString(36).slice(2, 6)),
      questionTitle,
      studentAnswer: studentAnswer || '（未填写）',
      correctAnswer: correctAnswer || '（未填写）',
      nodeId,
      status,
      attribution: attribution || '待确认',
      attributionType: attributionTypeRaw,
      note: note || (type === 'withdrawn' ? '从历史答案库撤回补录' : ''),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isWithdrawn,
      isDuplicate: false,
      duplicateReason: '',
    };

    setParseError(null);
    return record;
  };

  const handleImport = () => {
    if (!importText.trim()) {
      setParseError('请先粘贴或填写样本内容');
      return;
    }

    let record: ErrorRecord | null = null;

    try {
      const parsed = JSON.parse(importText);
      if (parsed && typeof parsed === 'object') {
        record = {
          id: parsed.id || ('r' + Date.now().toString(36).slice(-6)),
          studentId: parsed.studentId || ('s' + Math.random().toString(36).slice(2, 6)),
          studentName: parsed.studentName,
          questionId: parsed.questionId || ('q' + Math.random().toString(36).slice(2, 6)),
          questionTitle: parsed.questionTitle,
          studentAnswer: parsed.studentAnswer || '（未填写）',
          correctAnswer: parsed.correctAnswer || '（未填写）',
          nodeId: parsed.nodeId,
          status: parsed.status || (importType === 'answer' ? 'processed' : 'pending'),
          attribution: parsed.attribution || '待确认',
          attributionType: parsed.attributionType || 'concept',
          note: parsed.note || '',
          createdAt: parsed.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isWithdrawn: importType === 'withdrawn' || parsed.isWithdrawn || false,
          isDuplicate: false,
          duplicateReason: '',
        };
      }
    } catch {
      record = parseRecord(importText, importType);
    }

    if (!record) return;

    const result = importRawRecord(record, importType);
    showToastMsg(result.message);

    if (result.success) {
      setImportText('');
      setShowImport(false);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <header className="bg-white/70 backdrop-blur-md border-b border-paper-200/80 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-ink-800 flex items-center justify-center text-white shadow-md">
            <Network size={20} />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-ink-800 leading-tight">
              图论路径错题归因
            </h1>
            <p className="text-xs text-ink-500">
              教研编辑工作台 · 持久化存储
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {caliberCheckPassed ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle size={12} />
                口径校验通过
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-ochre-600 bg-ochre-50 px-2.5 py-1 rounded-full border border-ochre-200">
                <AlertCircle size={12} />
                口径不一致
              </span>
            )}
            {lastRecalcTime && (
              <span className="text-ink-400 flex items-center gap-1">
                <Save size={12} />
                复算 {formatTime(lastRecalcTime)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="btn-secondary text-xs !px-3 !py-1.5 flex items-center gap-1.5"
            >
              <FilePlus size={14} />
              导入样本
            </button>
            <button
              onClick={handleReset}
              className="btn-secondary text-xs !px-3 !py-1.5 flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              重置演示
            </button>
          </div>
        </div>
      </div>

      {showImport && (
        <div className="border-t border-paper-200/80 bg-paper-50/80 px-5 py-4 animate-fade-in">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <p className="text-sm text-ink-700 font-medium mb-1">
                  导入小包材料
                </p>
                <p className="text-xs text-ink-500">
                  支持粘贴文本或 JSON，支持「历史答案」「撤回记录」「补充说明」三类，导入后进入同一套归因、去重、撤回复算流程
                </p>
              </div>
              <button
                onClick={() => setShowImport(false)}
                className="text-ink-400 hover:text-ink-600 p-1"
              >
                ×
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs text-ink-600">样本类型：</span>
              {(Object.keys(importTypeLabels) as ImportType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setImportType(t);
                    setParseError(null);
                  }}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    importType === t
                      ? 'bg-ink-800 text-white border-ink-800'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                  }`}
                >
                  {importTypeLabels[t]}
                </button>
              ))}
              <button
                onClick={loadTemplate}
                className="ml-auto text-xs text-ink-500 hover:text-ink-700 flex items-center gap-1"
              >
                <FileText size={12} />
                加载示例
              </button>
            </div>

            <textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setParseError(null);
              }}
              placeholder={`粘贴${importTypeLabels[importType]}的文本或 JSON...`}
              className="w-full h-36 px-3 py-2 text-sm border border-ink-200 rounded-md bg-white font-mono text-ink-700 focus:outline-none focus:ring-2 focus:ring-ink-400/30 focus:border-ink-400 resize-y scrollbar-thin"
            />

            {parseError && (
              <div className="mt-2 text-xs text-ochre-700 bg-ochre-50 border border-ochre-200 rounded-md px-3 py-2 flex items-start gap-1.5">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowImport(false)}
                className="btn-secondary text-xs !px-4 !py-2"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                className="btn-primary text-xs !px-4 !py-2 flex items-center gap-1.5"
              >
                <FilePlus size={13} />
                导入
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full mt-2 bg-ink-800 text-white text-sm px-4 py-2 rounded-md shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </header>
  );
}

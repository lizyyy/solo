import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  RotateCcw,
  FilePlus,
  CheckCircle,
  AlertCircle,
  Save,
  Network,
} from 'lucide-react';

export default function TopBar() {
  const {
    resetToSeed,
    caliberCheckPassed,
    lastRecalcTime,
    importWithdrawnRecord,
  } = useAppStore();

  const [toast, setToast] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleReset = () => {
    if (confirm('确定要重置为演示数据吗？当前所有操作都会丢失。')) {
      resetToSeed();
      showToastMsg('已重置为演示数据');
    }
  };

  const handleImportSample = () => {
    const sampleRecord = {
      id: 'r' + Math.random().toString(36).slice(2, 7),
      studentId: 's004',
      studentName: '张明远',
      questionId: 'q301',
      questionTitle: '拓扑排序的环检测与序列输出',
      studentAnswer: '直接DFS输出后序即可',
      correctAnswer: '需先检测有向环，再进行拓扑排序',
      nodeId: 'n3',
      status: 'pending' as const,
      attribution: '思路偏差',
      attributionType: 'thinking' as const,
      note: '从历史答案库撤回补录，需人工确认',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isWithdrawn: true,
      isDuplicate: false,
      duplicateReason: '',
    };
    const result = importWithdrawnRecord(sampleRecord);
    showToastMsg(result.message);
    setShowImport(false);
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
              导入撤回记录
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
        <div className="border-t border-paper-200/80 bg-paper-50/60 px-5 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-ink-700 font-medium mb-1">
                导入撤回记录复算
              </p>
              <p className="text-xs text-ink-500">
                将撤回的历史答案记录重新纳入归因计算，系统会自动检测重复样本并校验图表与明细口径
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleImportSample}
                className="btn-primary text-xs !px-4 !py-2 flex items-center gap-1.5"
              >
                <FilePlus size={13} />
                导入示例撤回记录
              </button>
              <button
                onClick={() => setShowImport(false)}
                className="btn-secondary text-xs !px-4 !py-2"
              >
                取消
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

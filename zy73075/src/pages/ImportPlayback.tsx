import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, AlertTriangle, CheckCircle, ShieldCheck, FileJson, ArrowRight, Play } from 'lucide-react';
import ImportDropzone from '@/components/import/ImportDropzone';
import ImportPreview from '@/components/import/ImportPreview';
import { useWorkorderStore } from '@/store/workorderStore';
import { parseDataset } from '@/utils/exporter';
import type { FullDataset } from '@/types';
import { SAMPLE_DATA } from '@/data/sampleData';

type ImportPhase = 'idle' | 'parsed' | 'importing' | 'done';

export default function ImportPlayback() {
  const navigate = useNavigate();
  const { importDataset, workorders } = useWorkorderStore();
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [dataset, setDataset] = useState<FullDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    duplicateCount: number;
    preservedNotes: number;
    newRecallCount: number;
    totalImported: number;
  } | null>(null);

  const handleFile = (text: string) => {
    const parsed = parseDataset(text);
    if ('error' in parsed) {
      setError(parsed.error);
      setPhase('idle');
      return;
    }
    setError(null);
    setDataset(parsed);
    setPhase('parsed');
  };

  const loadSampleForImport = () => {
    setError(null);
    setDataset(structuredClone(SAMPLE_DATA));
    setPhase('parsed');
  };

  const result = useMemo(() => {
    if (!dataset) return null;
    const existingIds = new Set(workorders.map(w => w.id));
    const duplicates = dataset.workorders.filter(w => existingIds.has(w.id)).length;
    const notePreserved = dataset.workorders.filter(w => {
      const old = workorders.find(o => o.id === w.id);
      return old && old.handover_note && old.handover_note !== w.handover_note;
    }).length;
    return { duplicates, notePreserved, total: dataset.workorders.length };
  }, [dataset, workorders]);

  const confirmImport = () => {
    if (!dataset) return;
    setPhase('importing');
    const r = importDataset(dataset);
    setLastResult({
      duplicateCount: r.duplicateCount,
      preservedNotes: r.preservedNotes,
      newRecallCount: r.newRecallCount,
      totalImported: dataset.workorders.length,
    });
    setPhase('done');
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UploadCloud className="w-6 h-6 text-shield-400" /> 导入回放工作台
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          支持 JSON 文件拖拽、粘贴或文件选择。重复工单<strong className="text-amber-300">不会翻倍</strong>，
          人工备注<strong className="text-emerald-300">不会被覆盖</strong>，异常记录将自动归因到公式/单位/阈值。
        </p>
      </div>

      {phase !== 'done' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <ImportDropzone onFile={handleFile} />

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Play className="w-4 h-4 text-shield-400" />
                <h3 className="font-semibold text-sm">快速回放样例</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                将固定的 4 条样例工单（含重复设备编号 SDJ-001、临时材料、三类异常）导入，用于验证重复检测与备注保护。
              </p>
              <button className="btn-primary w-full" onClick={loadSampleForImport}>
                <FileJson className="w-4 h-4" /> 加载固定样例数据包
              </button>
            </div>

            {error && (
              <div className="card p-4 border-rose-500/60 bg-rose-500/5">
                <div className="flex items-start gap-2 text-rose-300">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">解析失败</div>
                    <div className="text-xs mt-0.5">{error}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="card p-4 text-xs text-slate-400 space-y-2 border-slate-600/50">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-shield-400" /> 导入保护策略
              </div>
              <ul className="space-y-1 list-disc list-inside">
                <li>相同<strong className="text-amber-300">工单编号</strong>的记录：不新增、只更新，防止数据翻倍</li>
                <li><strong className="text-emerald-300">人工备注</strong>字段：保留已有值，导入新值不覆盖旧值</li>
                <li>设备编号允许重复（同一台盾构机多次工单），用「重复导入」视图集中查看</li>
                <li>异常自动归因到 🔴公式 / 🟠单位 / 🟣阈值，单独留痕不藏在备注</li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-3">
            {phase === 'idle' ? (
              <div className="card p-12 text-center min-h-[420px] flex flex-col items-center justify-center text-slate-500">
                <UploadCloud className="w-16 h-16 mb-4 opacity-40" />
                <div className="text-lg mb-1">等待导入数据</div>
                <div className="text-sm">左侧拖拽 JSON 文件，或点击「加载固定样例」一键回放</div>
              </div>
            ) : (
              <div className="space-y-4">
                {result && (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard label="总工单" value={result.total} accent="text-slate-200" />
                    <StatCard
                      label={`已存在（不翻倍）`}
                      value={result.duplicates}
                      accent={result.duplicates > 0 ? 'text-amber-300' : 'text-slate-400'}
                    />
                    <StatCard
                      label="备注被保护"
                      value={result.notePreserved}
                      accent={result.notePreserved > 0 ? 'text-emerald-300' : 'text-slate-400'}
                    />
                  </div>
                )}
                <ImportPreview dataset={dataset!} />
                <div className="flex justify-end gap-3">
                  <button className="btn-ghost" onClick={() => { setPhase('idle'); setDataset(null); setError(null); }}>
                    取消
                  </button>
                  <button className="btn-primary" onClick={confirmImport} disabled={phase === 'importing'}>
                    <CheckCircle className="w-4 h-4" /> 确认导入
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'done' && lastResult && (
        <div className="card p-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-emerald-300">导入回放完成</h2>
              <p className="text-slate-400 mt-0.5 text-sm">数据已写入本地存储（localStorage），刷新页面不丢失</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <ResultCell label="导入工单" value={lastResult.totalImported} />
            <ResultCell label="重复（未翻倍）" value={lastResult.duplicateCount} warn={lastResult.duplicateCount > 0} />
            <ResultCell label="备注保留" value={lastResult.preservedNotes} success={lastResult.preservedNotes > 0} />
            <ResultCell label="新异常归因" value={lastResult.newRecallCount} />
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={() => navigate('/')}>
              <ArrowRight className="w-4 h-4" /> 返回工单总览
            </button>
            <button className="btn-ghost" onClick={() => navigate('/review')}>
              查看异常复核
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setPhase('idle');
                setDataset(null);
                setLastResult(null);
                setError(null);
              }}
            >
              再导入一次（用于测试重复导入保护）
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-mono font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

function ResultCell({
  label,
  value,
  warn,
  success,
}: {
  label: string;
  value: number;
  warn?: boolean;
  success?: boolean;
}) {
  const color = success ? 'text-emerald-300' : warn ? 'text-amber-300' : 'text-slate-200';
  return (
    <div className="border border-slate-700/70 bg-slate-900/40 px-4 py-3 rounded-sm">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-mono font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

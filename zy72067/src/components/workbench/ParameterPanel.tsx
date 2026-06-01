import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Scheme } from '@/types';

export default function ParameterPanel() {
  const { currentScheme, parameterChanges, updateSchemeParams, fetchParameterChanges } = useStore();
  const [warningVal, setWarningVal] = useState<number>(80);
  const [criticalVal, setCriticalVal] = useState<number>(120);
  const [reason, setReason] = useState('');
  const [changedBy, setChangedBy] = useState('许姐');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scheme, setScheme] = useState<Scheme | null>(null);

  useEffect(() => {
    fetch('/api/schemes/demo-001')
      .then((r) => r.json())
      .then((data: Scheme) => {
        setScheme(data);
        setWarningVal(data.warningThreshold);
        setCriticalVal(data.criticalThreshold);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (currentScheme) {
      setWarningVal(currentScheme.warningThreshold);
      setCriticalVal(currentScheme.criticalThreshold);
    }
  }, [currentScheme]);

  async function handleApply() {
    if (!scheme && !currentScheme) return;
    const sid = currentScheme?.id ?? scheme?.id ?? 'demo-001';
    await updateSchemeParams(sid, { warningThreshold: warningVal, criticalThreshold: criticalVal }, changedBy, reason);
    setReason('');
    fetchParameterChanges(sid);
  }

  const displayScheme = currentScheme ?? scheme;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="text-sm font-semibold text-gray-200">参数调整</div>

      {displayScheme && (
        <div className="rounded bg-gray-800/50 p-3 text-xs text-gray-400">
          当前方案: <span className="text-gray-200">{displayScheme.name}</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-400">Warning 阈值 (°C)</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={200}
              value={warningVal}
              onChange={(e) => setWarningVal(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <input
              type="number"
              min={0}
              max={200}
              value={warningVal}
              onChange={(e) => setWarningVal(Number(e.target.value))}
              className="w-16 rounded border border-gray-600 bg-[#1a1a2e] px-2 py-1 text-xs text-gray-200 text-center"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">Critical 阈值 (°C)</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={200}
              value={criticalVal}
              onChange={(e) => setCriticalVal(Number(e.target.value))}
              className="flex-1 accent-red-400"
            />
            <input
              type="number"
              min={0}
              max={200}
              value={criticalVal}
              onChange={(e) => setCriticalVal(Number(e.target.value))}
              className="w-16 rounded border border-gray-600 bg-[#1a1a2e] px-2 py-1 text-xs text-gray-200 text-center"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">修改原因</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请输入修改原因..."
            className="w-full rounded border border-gray-600 bg-[#1a1a2e] px-2 py-1.5 text-xs text-gray-200"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">修改人</label>
          <input
            type="text"
            value={changedBy}
            onChange={(e) => setChangedBy(e.target.value)}
            className="w-full rounded border border-gray-600 bg-[#1a1a2e] px-2 py-1.5 text-xs text-gray-200"
          />
        </div>

        <button
          onClick={handleApply}
          className="rounded bg-amber-500 px-4 py-2 text-xs font-medium text-gray-900 hover:bg-amber-400 transition-colors"
        >
          应用变更
        </button>
      </div>

      <div className="border-t border-gray-700 pt-3">
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          className="flex w-full items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
        >
          {historyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          参数变更历史
        </button>
        {historyOpen && (
          <div className="mt-2 flex flex-col gap-2">
            {parameterChanges.length === 0 && (
              <div className="text-[10px] text-gray-500">暂无变更记录</div>
            )}
            {parameterChanges.map((pc) => (
              <div key={pc.id} className="relative pl-4 border-l-2 border-gray-700 pb-2">
                <div className="absolute -left-1 top-0 h-2 w-2 rounded-full bg-amber-400" />
                <div className="text-xs text-gray-300">{pc.parameterName}</div>
                <div className="text-[10px] text-gray-400">
                  {pc.oldValue} → <span className="text-amber-400">{pc.newValue}</span>
                </div>
                <div className="text-[10px] text-gray-500">
                  {pc.changedBy} · {new Date(pc.changedAt).toLocaleString('zh-CN')}
                </div>
                {pc.reason && (
                  <div className="text-[10px] text-gray-500 mt-0.5">原因: {pc.reason}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

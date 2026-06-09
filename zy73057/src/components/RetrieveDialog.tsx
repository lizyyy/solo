import { useState } from 'react';
import { SearchCheck, AlertCircle, CheckCircle2, Copy, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useScheduleStore } from '@/store/scheduleStore';
import { cn } from '@/lib/utils';

export default function RetrieveDialog() {
  const { applySignatureFilters, loading, items, batches } = useScheduleStore();
  const [signature, setSignature] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    matchedBatchIds: string[];
    matchedItemIds: string[];
  } | null>(null);

  const navigate = useNavigate();

  const handleApply = async () => {
    const sig = signature.trim();
    if (!sig) {
      setError('请输入筛选签名');
      setResult(null);
      return;
    }
    setError(null);
    try {
      const res = await applySignatureFilters(sig);
      setResult({
        matchedBatchIds: res.matchedBatchIds,
        matchedItemIds: res.matchedItemIds,
      });
    } catch (e: any) {
      setError(e.message || '签名无效，请检查后重试');
      setResult(null);
    }
  };

  const matchedBatches = result
    ? batches.filter((b) => result.matchedBatchIds.includes(b.batchId))
    : [];
  const matchedCount = result?.matchedItemIds.length || 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-ink-800/80 border-2 border-ink-500 rounded-sm p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-warn-400/15 border border-warn-400/50 rounded-sm">
            <SearchCheck className="w-5 h-5 text-warn-400" />
          </div>
          <div>
            <h1 className="text-xl font-display font-semibold text-ink-100">按筛选签名追回</h1>
            <p className="text-sm text-ink-300 mt-0.5">
              粘贴导出时生成的筛选签名，还原当时的筛选条件并定位同批数据
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-ink-300 mb-2 font-medium">
              筛选签名（粘贴到下方文本域）
            </label>
            <textarea
              value={signature}
              onChange={(e) => {
                setSignature(e.target.value);
                if (error) setError(null);
              }}
              rows={4}
              placeholder="在此粘贴筛选签名，例如：sig_abc123xyz789..."
              className={cn(
                'w-full bg-ink-900/60 border-2 rounded-sm px-4 py-3 text-sm font-mono text-ink-100 focus:outline-none resize-none',
                error ? 'border-rust-400 focus:border-rust-400' : 'border-ink-500 focus:border-warn-400'
              )}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-rust-400/10 border border-rust-400/50 rounded-sm">
              <AlertCircle className="w-4 h-4 text-rust-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-rust-300">签名无效</div>
                <div className="text-xs text-rust-400/80 mt-0.5">{error}</div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleApply}
              disabled={loading || !signature.trim()}
              className="btn-industrial border-warn-400 text-warn-100 bg-warn-400/15 text-sm"
            >
              <SearchCheck className="w-4 h-4" />
              还原筛选并定位同批
            </button>
          </div>

          {result && !error && (
            <div className="mt-4 p-4 bg-mint-400/10 border border-mint-300/50 rounded-sm space-y-3 animate-fadeInStagger">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-mint-300" />
                <span className="text-sm font-medium text-mint-200">签名匹配成功</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-ink-800/60 border border-ink-600 rounded-sm p-3">
                  <div className="text-xs text-ink-400 mb-1">命中批次</div>
                  <div className="font-mono text-2xl font-semibold text-mint-200">
                    {matchedBatches.length}
                  </div>
                </div>
                <div className="bg-ink-800/60 border border-ink-600 rounded-sm p-3">
                  <div className="text-xs text-ink-400 mb-1">命中排程行数</div>
                  <div className="font-mono text-2xl font-semibold text-mint-200">
                    {matchedCount || items.length}
                  </div>
                </div>
              </div>

              {matchedBatches.length > 0 && (
                <div>
                  <div className="text-xs text-ink-400 mb-2 font-medium">命中批次号列表</div>
                  <div className="flex flex-wrap gap-2">
                    {matchedBatches.map((b) => (
                      <button
                        key={b.batchId}
                        onClick={() => navigate(`/analysis/${b.batchId}`)}
                        className="group inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-ink-700 text-ink-100 border border-ink-500 rounded-sm hover:border-mint-300 hover:bg-mint-400/10 transition-colors"
                      >
                        {b.batchId}
                        <Copy className="w-3 h-3 text-ink-400 group-hover:text-mint-300" />
                        <ArrowRight className="w-3 h-3 text-ink-400 group-hover:text-mint-300" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-mint-300/20 flex justify-end">
                <button
                  onClick={() => navigate('/')}
                  className="btn-industrial border-mint-300 text-mint-100 bg-mint-400/10 text-xs"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  前往排程列表查看
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

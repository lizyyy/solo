import { useState, useEffect } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';

export default function SubmitSimulator() {
  const trialAggregates = useScheduleStore((s) => s.trialAggregates());
  const submitDuplicate = useScheduleStore((s) => s.submitDuplicate);
  const trialMode = useScheduleStore((s) => s.trialMode);
  const trialVersions = useScheduleStore((s) => s.trialVersions);

  const [beforeCount, setBeforeCount] = useState(trialAggregates.length);
  const [afterCount, setAfterCount] = useState(trialAggregates.length);
  const [bizKey, setBizKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const count = trialAggregates.length;
    setBeforeCount(count);
    setAfterCount(count);
  }, [trialMode, trialVersions.length]);

  useEffect(() => {
    if (!trialAggregates.length) return;
    if (!bizKey) {
      setBizKey(trialAggregates[0]?.bizKey || '');
    }
  }, [trialAggregates, bizKey]);

  const options = trialAggregates.slice(0, 3);

  const handleSubmit = async () => {
    if (!bizKey || loading) return;

    const currentBefore = trialAggregates.length;
    setBeforeCount(currentBefore);
    setAfterCount(currentBefore);
    setLoading(true);
    setAnimating(true);

    await new Promise((r) => setTimeout(r, 200));
    submitDuplicate(bizKey);

    await new Promise((r) => setTimeout(r, 800));
    submitDuplicate(bizKey);

    await new Promise((r) => setTimeout(r, 200));

    const after = trialAggregates.length;
    setAfterCount(after);
    setBeforeCount(after);

    await new Promise((r) => setTimeout(r, 500));
    setAnimating(false);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-5">提交模拟器</h3>

      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-6 mb-6">
        <div className="flex flex-col items-center flex-1">
          <span className="text-sm text-gray-500 mb-2">提交前</span>
          <span
            className={`text-4xl font-bold text-blue-600 transition-all duration-500 ${animating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}
          >
            {beforeCount}
          </span>
          <span className="text-xs text-gray-400 mt-1">条聚合记录</span>
        </div>

        <div className="flex flex-col items-center px-4">
          <div className={`relative transition-all duration-500 ${animating ? 'translate-x-2 scale-110' : ''}`}>
            <ArrowRight
              className={`w-12 h-12 text-green-500 transition-all duration-300 ${animating ? 'animate-pulse text-green-600' : ''}`}
              strokeWidth={2.5}
            />
            {animating && (
              <ArrowRight
                className="w-12 h-12 text-green-400 absolute top-0 left-0 animate-ping opacity-50"
                strokeWidth={2.5}
              />
            )}
          </div>
          <span className="text-xs text-gray-400 mt-3">去重聚合</span>
        </div>

        <div className="flex flex-col items-center flex-1">
          <span className="text-sm text-gray-500 mb-2">提交后</span>
          <span
            className={`text-4xl font-bold text-green-600 transition-all duration-500 ${animating ? 'opacity-100 scale-105' : 'opacity-100 scale-100'}`}
          >
            {afterCount}
          </span>
          <span className="text-xs text-gray-400 mt-1">条聚合记录</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择要模拟重复提交的 bizKey
          </label>
          <select
            value={bizKey}
            onChange={(e) => setBizKey(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {options.map((opt) => (
              <option key={opt.bizKey} value={opt.bizKey}>
                {opt.latest.pipelineNo} / {opt.latest.partName} ({opt.latest.partModel})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !bizKey}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              正在连续提交...
            </>
          ) : (
            '连续提交 2 次相同请求'
          )}
        </button>

        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 leading-relaxed">
            ✅ 两次提交完成后，列表总数不变，版本号 +2
          </p>
          <p className="text-xs text-green-600 mt-1">
            系统会自动识别重复 bizKey 并合并为一条，仅增加版本历史
          </p>
        </div>
      </div>
    </div>
  );
}

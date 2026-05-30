
import { Filter } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const FilterOptionsPanel = () => {
  const filterOptions = useAppStore((state) => state.filterOptions);
  const setFilterOptions = useAppStore((state) => state.setFilterOptions);

  const toggleToken = (token: string) => {
    const currentTokens = filterOptions.selectedTokens;
    const newTokens = currentTokens.includes(token)
      ? currentTokens.filter((t) => t !== token)
      : [...currentTokens, token];
    setFilterOptions({ selectedTokens: newTokens });
  };

  const statusFilters = [
    { key: 'showNormal', label: '正常', color: 'text-blue-400' },
    { key: 'showWarning', label: '警告', color: 'text-amber-400' },
    { key: 'showAnomaly', label: '异常', color: 'text-red-400' },
    { key: 'showPending', label: '待审', color: 'text-purple-400' },
  ];

  const tokens = ['ETH', 'USDC', 'USDT', 'WBTC', 'LINK'];

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <Filter size={16} className="text-indigo-400" />
        <span className="text-white text-sm font-semibold">筛选选项</span>
      </div>

      <div className="mb-4">
        <div className="text-slate-400 text-xs mb-2">地址状态</div>
        <div className="grid grid-cols-2 gap-2">
          {statusFilters.map(({ key, label, color }) => (
            <label
              key={key}
              className="flex items-center gap-2 p-2 bg-slate-800/50 rounded cursor-pointer hover:bg-slate-700/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={filterOptions[key as keyof typeof filterOptions] as boolean}
                onChange={(e) =>
                  setFilterOptions({ [key]: e.target.checked } as Partial<typeof filterOptions>)
                }
                className="accent-indigo-500"
              />
              <span className={`text-xs ${color}`}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-slate-400 text-xs mb-2">代币类型</div>
        <div className="flex flex-wrap gap-2">
          {tokens.map((token) => (
            <button
              key={token}
              onClick={() => toggleToken(token)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                filterOptions.selectedTokens.includes(token)
                  ? 'bg-indigo-500/30 border-indigo-500 text-indigo-300'
                  : 'bg-slate-800/50 border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              {token}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-xs">最小金额</span>
          <span className="text-slate-300 text-xs font-mono">
            ${filterOptions.minAmount.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100000}
          step={1000}
          value={filterOptions.minAmount}
          onChange={(e) =>
            setFilterOptions({ minAmount: parseFloat(e.target.value) })
          }
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
      </div>
    </div>
  );
};

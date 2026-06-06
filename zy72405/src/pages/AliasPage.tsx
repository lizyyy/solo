import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Music2, Plus, Trash2, User, Clock } from 'lucide-react';

export function AliasPage() {
  const aliases = useStore(state => state.aliases);
  const addAlias = useStore(state => state.addAlias);
  const deleteAlias = useStore(state => state.deleteAlias);
  const currentUser = useStore(state => state.currentUser);

  const [standardName, setStandardName] = useState('');
  const [aliasName, setAliasName] = useState('');

  const handleAdd = () => {
    if (!standardName.trim() || !aliasName.trim()) return;
    addAlias(standardName.trim(), aliasName.trim(), currentUser.name);
    setStandardName('');
    setAliasName('');
  };

  const groupedByStandard = aliases.reduce((acc, alias) => {
    if (!acc[alias.standardName]) {
      acc[alias.standardName] = [];
    }
    acc[alias.standardName].push(alias);
    return acc;
  }, {} as Record<string, typeof aliases>);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800 mb-1">曲目别名表</h1>
        <p className="text-stone-500 text-sm">音乐老师许老师补看后在此维护，曲目核对时自动映射</p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-4 mb-6 shadow-sm">
        <h3 className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-600" />
          新增别名映射
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={standardName}
            onChange={(e) => setStandardName(e.target.value)}
            placeholder="标准曲目名"
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
          <span className="text-stone-400 self-center">→</span>
          <input
            type="text"
            value={aliasName}
            onChange={(e) => setAliasName(e.target.value)}
            placeholder="别名（合同中出现的名称）"
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
          <button
            onClick={handleAdd}
            disabled={!standardName.trim() || !aliasName.trim()}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            添加
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-100">
          <h3 className="font-medium text-stone-800 flex items-center gap-2">
            <Music2 className="w-4 h-4 text-amber-600" />
            已配置的别名映射
            <span className="text-xs font-normal text-stone-500 ml-2">
              共 {aliases.length} 条
            </span>
          </h3>
        </div>

        <div className="divide-y divide-stone-100">
          {Object.entries(groupedByStandard).map(([standard, items]) => (
            <div key={standard} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-stone-800">{standard}</span>
                <span className="text-xs text-stone-500">（标准名）</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {items.map(alias => (
                  <div
                    key={alias.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg group"
                  >
                    <span className="text-sm text-amber-800">{alias.aliasName}</span>
                    <button
                      onClick={() => deleteAlias(alias.id)}
                      className="opacity-0 group-hover:opacity-100 text-amber-400 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-stone-400 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  添加人: {items[0]?.addedBy}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(items[0]?.addedAt || '').toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {aliases.length === 0 && (
          <div className="p-12 text-center text-stone-400">
            <Music2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无曲目别名配置</p>
          </div>
        )}
      </div>
    </div>
  );
}

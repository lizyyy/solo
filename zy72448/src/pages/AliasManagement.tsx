import { useState } from 'react';
import {
  Plus,
  Tags,
  Search,
  Trash2,
  Filter,
  BookOpen,
} from 'lucide-react';
import { useAppStore } from '../store';
import { TrackAlias } from '../types';
import { formatDateTime } from '../utils/helpers';

export default function AliasManagement() {
  const { trackAliases, addTrackAlias } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'全部' | '现场名' | '版权名'>('全部');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    canonicalName: '',
    aliasName: '',
    aliasType: '现场名' as '现场名' | '版权名',
    source: '人工' as '合同' | '别名表' | '人工',
  });

  const filteredAliases = trackAliases.filter((a) => {
    const matchesSearch =
      a.canonicalName.includes(searchTerm) || a.aliasName.includes(searchTerm);
    const matchesType = filterType === '全部' || a.aliasType === filterType;
    return matchesSearch && matchesType;
  });

  const handleSubmit = () => {
    if (!formData.canonicalName.trim() || !formData.aliasName.trim()) {
      alert('请填写标准名和别名');
      return;
    }
    addTrackAlias(formData);
    setFormData({ canonicalName: '', aliasName: '', aliasType: '现场名', source: '人工' });
    setShowForm(false);
  };

  const groupedByCanonical = filteredAliases.reduce((acc, alias) => {
    if (!acc.has(alias.canonicalName)) {
      acc.set(alias.canonicalName, []);
    }
    acc.get(alias.canonicalName)!.push(alias);
    return acc;
  }, new Map<string, TrackAlias[]>());

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Tags className="w-5 h-5 text-slate-600" />
            第二步：曲目别名管理
          </h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs px-3 py-1.5 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            添加别名映射
          </button>
        </div>

        {showForm && (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-3">添加新的别名映射</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">标准名 *</label>
                <input
                  type="text"
                  value={formData.canonicalName}
                  onChange={(e) => setFormData({ ...formData, canonicalName: e.target.value })}
                  placeholder="例如：月光奏鸣曲"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">别名 *</label>
                <input
                  type="text"
                  value={formData.aliasName}
                  onChange={(e) => setFormData({ ...formData, aliasName: e.target.value })}
                  placeholder="例如：月光现场版"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">别名类型</label>
                <select
                  value={formData.aliasType}
                  onChange={(e) =>
                    setFormData({ ...formData, aliasType: e.target.value as '现场名' | '版权名' })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="现场名">现场名</option>
                  <option value="版权名">版权名</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">来源</label>
                <select
                  value={formData.source}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      source: e.target.value as '合同' | '别名表' | '人工',
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="合同">合同</option>
                  <option value="别名表">别名表</option>
                  <option value="人工">人工</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-1.5 text-sm text-slate-600 hover:text-slate-800"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-1.5 bg-slate-800 text-white text-sm rounded-md hover:bg-slate-700"
              >
                确认添加
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索标准名或别名..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {(['全部', '现场名', '版权名'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  filterType === type
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {Array.from(groupedByCanonical.entries()).map(([canonicalName, aliases]) => (
            <div
              key={canonicalName}
              className="border border-slate-200 rounded-lg overflow-hidden"
            >
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-semibold text-slate-800">{canonicalName}</span>
                  <span className="text-xs text-slate-500">（{aliases.length} 个别名）</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left py-2.5 px-4 font-medium text-slate-600 w-[30%]">
                      别名
                    </th>
                    <th className="text-left py-2.5 px-4 font-medium text-slate-600 w-[15%]">
                      类型
                    </th>
                    <th className="text-left py-2.5 px-4 font-medium text-slate-600 w-[15%]">
                      来源
                    </th>
                    <th className="text-left py-2.5 px-4 font-medium text-slate-600">添加时间</th>
                  </tr>
                </thead>
                <tbody>
                  {aliases.map((alias) => (
                    <tr key={alias.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 px-4 font-medium text-slate-700">
                        {alias.aliasName}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            alias.aliasType === '现场名'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-violet-100 text-violet-700'
                          }`}
                        >
                          {alias.aliasType}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{alias.source}</td>
                      <td className="py-2.5 px-4 text-slate-500 text-xs">
                        {formatDateTime(new Date(alias.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {filteredAliases.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Tags className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无别名映射数据</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { BookOpen, Plus, Edit3, Save, X, Search, Tag } from 'lucide-react';
import { useRoyaltyStore } from '../store/useRoyaltyStore';
import type { TrackAlias } from '../types';

export default function AliasManager() {
  const { aliases, initData, addAlias, updateAlias } = useRoyaltyStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAlias, setNewAlias] = useState({
    officialName: '',
    aliases: '',
    oldCaliber: '',
  });
  const [editAlias, setEditAlias] = useState({
    officialName: '',
    aliases: '',
    oldCaliber: '',
  });

  useEffect(() => {
    initData();
  }, [initData]);

  const filteredAliases = aliases.filter(
    a =>
      a.officialName.includes(searchTerm) ||
      a.aliases.some(al => al.includes(searchTerm)) ||
      (a.oldCaliber && a.oldCaliber.includes(searchTerm))
  );

  const handleAddAlias = () => {
    if (!newAlias.officialName.trim()) return;
    
    const alias: TrackAlias = {
      id: `alias-${Date.now()}`,
      officialName: newAlias.officialName,
      aliases: newAlias.aliases.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      oldCaliber: newAlias.oldCaliber || undefined,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    
    addAlias(alias);
    setNewAlias({ officialName: '', aliases: '', oldCaliber: '' });
    setShowAddForm(false);
  };

  const handleSaveEdit = (id: string) => {
    updateAlias(id, {
      officialName: editAlias.officialName,
      aliases: editAlias.aliases.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      oldCaliber: editAlias.oldCaliber || undefined,
    });
    setEditingId(null);
  };

  const startEditing = (alias: TrackAlias) => {
    setEditingId(alias.id);
    setEditAlias({
      officialName: alias.officialName,
      aliases: alias.aliases.join(', '),
      oldCaliber: alias.oldCaliber || '',
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-primary-800">曲目别名表</h1>
          <p className="text-primary-500 mt-1">管理曲目官方名称、别名和旧口径映射</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-700 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          新增别名
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-card border border-primary-100 overflow-hidden">
        <div className="p-4 border-b border-primary-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索官方名称、别名或旧口径..."
              className="w-full pl-10 pr-4 py-2.5 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>

        {showAddForm && (
          <div className="p-4 bg-accent-goldLight/30 border-b border-primary-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1">官方名称</label>
                <input
                  type="text"
                  value={newAlias.officialName}
                  onChange={e => setNewAlias({ ...newAlias, officialName: e.target.value })}
                  placeholder="输入官方名称"
                  className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1">别名（多个用逗号分隔）</label>
                <input
                  type="text"
                  value={newAlias.aliases}
                  onChange={e => setNewAlias({ ...newAlias, aliases: e.target.value })}
                  placeholder="英文名、其他译名等"
                  className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1">旧口径（可选）</label>
                <input
                  type="text"
                  value={newAlias.oldCaliber}
                  onChange={e => setNewAlias({ ...newAlias, oldCaliber: e.target.value })}
                  placeholder="历史使用名称"
                  className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewAlias({ officialName: '', aliases: '', oldCaliber: '' });
                }}
                className="px-4 py-2 text-primary-500 hover:text-primary-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddAlias}
                disabled={!newAlias.officialName.trim()}
                className="px-4 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-primary-100">
          {filteredAliases.map(alias => (
            <div key={alias.id} className="p-4">
              {editingId === alias.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1">官方名称</label>
                      <input
                        type="text"
                        value={editAlias.officialName}
                        onChange={e => setEditAlias({ ...editAlias, officialName: e.target.value })}
                        className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1">别名（逗号分隔）</label>
                      <input
                        type="text"
                        value={editAlias.aliases}
                        onChange={e => setEditAlias({ ...editAlias, aliases: e.target.value })}
                        className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-primary-500 mb-1">旧口径</label>
                      <input
                        type="text"
                        value={editAlias.oldCaliber}
                        onChange={e => setEditAlias({ ...editAlias, oldCaliber: e.target.value })}
                        className="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 text-primary-400 hover:text-primary-600 rounded-lg hover:bg-primary-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSaveEdit(alias.id)}
                      className="p-2 text-accent-success hover:bg-accent-successLight rounded-lg"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-primary-800">{alias.officialName}</h3>
                      {alias.oldCaliber && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary-100 text-primary-600">
                          旧口径：{alias.oldCaliber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <Tag className="w-3.5 h-3.5 text-accent-gold" />
                      {alias.aliases.map((a, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-accent-goldLight text-amber-700"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-primary-400 mt-2">
                      更新时间：{alias.updatedAt}
                    </p>
                  </div>
                  <button
                    onClick={() => startEditing(alias)}
                    className="p-2 text-primary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredAliases.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-primary-200 mx-auto mb-3" />
            <p className="text-primary-400">未找到匹配的曲目别名</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { UserPlus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useWorkspace } from '../store/context';
import type { Player } from '../types';

const PLAYER_COLORS = [
  '#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16',
];

export function PlayerPanel() {
  const { workspace, dispatch } = useWorkspace();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', role: '', description: '', color: PLAYER_COLORS[0] });

  const handleAdd = () => {
    if (!formData.name || !formData.role) return;
    
    dispatch({
      type: 'ADD_PLAYER',
      payload: formData,
    });
    setFormData({ name: '', role: '', description: '', color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)] });
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('删除玩家将同时删除其关联线索，确定继续？')) {
      dispatch({ type: 'REMOVE_PLAYER', payload: id });
    }
  };

  const handleSaveEdit = (player: Player) => {
    if (!formData.name || !formData.role) return;
    dispatch({
      type: 'UPDATE_PLAYER',
      payload: { ...player, ...formData },
    });
    setEditingId(null);
  };

  const startEdit = (player: Player) => {
    setFormData({
      name: player.name,
      role: player.role,
      description: player.description,
      color: player.color,
    });
    setEditingId(player.id);
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">玩家角色</h2>
        <button
          onClick={() => {
            setIsAdding(true);
            setFormData({ name: '', role: '', description: '', color: PLAYER_COLORS[0] });
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>添加</span>
        </button>
      </div>

      <div className="space-y-3">
        {workspace.players.length === 0 && !isAdding && (
          <div className="text-center py-8 text-slate-400">
            <p>暂无玩家</p>
            <p className="text-sm">点击上方添加第一个玩家</p>
          </div>
        )}

        {workspace.players.map((player) => {
          const clueCount = workspace.clues.filter(c => c.playerId === player.id).length;
          
          return (
            <div key={player.id}>
              {editingId === player.id ? (
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-600">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="玩家名称"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                      />
                      <input
                        type="text"
                        placeholder="角色"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-8 h-8 cursor-pointer"
                    />
                    <textarea
                      placeholder="描述"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(player)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm"
                      >
                        <Check className="w-4 h-4" />
                        <span>保存</span>
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
                      >
                        <X className="w-4 h-4" />
                        <span>取消</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: player.color }}
                      >
                        {player.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{player.name}</span>
                          <span className="text-sm text-slate-400">({player.role})</span>
                          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                            {clueCount} 线索</span>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{player.description || '暂无描述'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(player)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(player.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {isAdding && (
          <div className="p-3 bg-slate-900 rounded-lg border border-indigo-500">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="玩家名称"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                />
                <input
                  type="text"
                  placeholder="角色"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-8 h-8 cursor-pointer"
                />
                <span className="text-sm text-slate-400">选择颜色</span>
              </div>
              <textarea
                placeholder="角色描述（可选）"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>添加</span>
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
                >
                  <X className="w-4 h-4" />
                  <span>取消</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

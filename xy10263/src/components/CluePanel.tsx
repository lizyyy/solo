import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Search } from 'lucide-react';
import { useWorkspace } from '../store/context';
import type { Clue, ClueStatus, ClueType } from '../types';

const STATUS_OPTIONS: { value: ClueStatus; label: string; color: string }[] = [
  { value: 'found', label: '发现', color: 'bg-slate-600' },
  { value: 'analyzed', label: '已分析', color: 'bg-blue-600' },
  { value: 'unresolved', label: '未解决', color: 'bg-yellow-600' },
  { value: 'resolved', label: '已解决', color: 'bg-emerald-600' },
];

const TYPE_OPTIONS: { value: ClueType; label: string; color: string }[] = [
  { value: 'physical', label: '物证', color: 'border-slate-500' },
  { value: 'testimony', label: '证词', color: 'border-blue-500' },
  { value: 'document', label: '文档', color: 'border-purple-500' },
  { value: 'special', label: '特殊', color: 'border-amber-500' },
];

export function CluePanel() {
  const { workspace, dispatch } = useWorkspace();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlayer, setFilterPlayer] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [formData, setFormData] = useState({
    playerId: '',
    title: '',
    content: '',
    type: 'physical' as ClueType,
    status: 'found' as ClueStatus,
    timelineTime: 0,
    tags: [] as string[],
    notes: '',
    connectedClueIds: [] as string[],
  });

  const filteredClues = workspace.clues.filter(clue => {
    const matchesSearch = !searchTerm || 
      clue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clue.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clue.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPlayer = !filterPlayer || clue.playerId === filterPlayer;
    const matchesStatus = !filterStatus || clue.status === filterStatus;
    
    return matchesSearch && matchesPlayer && matchesStatus;
  });

  const handleAdd = () => {
    if (!formData.title || !formData.playerId) return;
    
    dispatch({
      type: 'ADD_CLUE',
      payload: formData,
    });
    resetForm();
    setIsAdding(false);
  };

  const handleUpdate = (clue: Clue) => {
    dispatch({
      type: 'UPDATE_CLUE',
      payload: { ...clue, ...formData },
    });
    setEditingId(null);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除这条线索吗？')) {
      dispatch({ type: 'REMOVE_CLUE', payload: id });
    }
  };

  const startEdit = (clue: Clue) => {
    setFormData({
      playerId: clue.playerId,
      title: clue.title,
      content: clue.content,
      type: clue.type,
      status: clue.status,
      timelineTime: clue.timelineTime,
      tags: [...clue.tags],
      notes: clue.notes,
      connectedClueIds: [...clue.connectedClueIds],
    });
    setEditingId(clue.id);
  };

  const resetForm = () => {
    setFormData({
      playerId: workspace.players[0]?.id || '',
      title: '',
      content: '',
      type: 'physical',
      status: 'found',
      timelineTime: 0,
      tags: [],
      notes: '',
      connectedClueIds: [],
    });
  };

  const getStatusBadge = (status: ClueStatus) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return option ? (
      <span className={`px-2 py-0.5 text-xs rounded ${option.color} text-white`}>
        {option.label}
      </span>
    ) : null;
  };

  const getTypeBadge = (type: ClueType) => {
    const option = TYPE_OPTIONS.find(t => t.value === type);
    return option ? (
      <span className={`px-2 py-0.5 text-xs border rounded ${option.color} text-slate-300`}>
        {option.label}
      </span>
    ) : null;
  };

  const getPlayerName = (playerId: string) => {
    const player = workspace.players.find(p => p.id === playerId);
    return player ? `${player.name}（${player.role}）` : '未知';
  };

  const renderForm = (isEdit: boolean = false, clue?: Clue) => (
    <div className="p-4 bg-slate-900 rounded-lg border border-indigo-500">
      <div className="space-y-3">
        <div className="flex gap-2">
          <select
            value={formData.playerId}
            onChange={(e) => setFormData({ ...formData, playerId: e.target.value })}
            className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
          >
            <option value="">选择玩家</option>
            {workspace.players.map(p => (
              <option key={p.id} value={p.id}>{p.name}（{p.role}）</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="线索标题"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as ClueType })}
            className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
          >
            {TYPE_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as ClueStatus })}
            className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">时间点:</span>
            <input
              type="number"
              value={formData.timelineTime}
              onChange={(e) => setFormData({ ...formData, timelineTime: parseInt(e.target.value) || 0 })}
              className="w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
            />
          </div>
        </div>
        
        <textarea
          placeholder="线索内容"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={2}
          className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
        />
        
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="标签（逗号分隔）"
            value={formData.tags.join(', ')}
            onChange={(e) => setFormData({ 
              ...formData, 
              tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
            })}
            className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
          />
        </div>
        
        <textarea
          placeholder="备注"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white"
        />
        
        <div className="flex gap-2">
          <button
            onClick={() => isEdit && clue ? handleUpdate(clue) : handleAdd()}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm"
          >
            <Check className="w-4 h-4" />
            <span>{isEdit ? '保存修改' : '添加线索'}</span>
          </button>
          <button
            onClick={() => {
              if (isEdit) setEditingId(null);
              else setIsAdding(false);
              resetForm();
            }}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
          >
            <X className="w-4 h-4" />
            <span>取消</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">线索管理</h2>
        <button
          onClick={() => {
            setIsAdding(true);
            resetForm();
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>添加</span>
        </button>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索线索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white"
            />
          </div>
          <select
            value={filterPlayer}
            onChange={(e) => setFilterPlayer(e.target.value)}
            className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white"
          >
            <option value="">全部玩家</option>
            {workspace.players.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white"
          >
            <option value="">全部状态</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {workspace.players.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <p>请先添加玩家</p>
          </div>
        )}

        {workspace.players.length > 0 && isAdding && renderForm(false)}

        {filteredClues.length === 0 && workspace.players.length > 0 && !isAdding && (
          <div className="text-center py-8 text-slate-400">
            <p>暂无线索</p>
          </div>
        )}

        {filteredClues.map((clue) => {
          const player = workspace.players.find(p => p.id === clue.playerId);
          
          return (
            <div key={clue.id}>
              {editingId === clue.id ? (
                renderForm(true, clue)
              ) : (
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold"
                          style={{ backgroundColor: player?.color || '#64748b' }}
                        >
                          {player?.name.charAt(0) || '?'}
                        </div>
                        <span className="text-white font-medium">{clue.title}</span>
                        <span className="text-xs text-slate-400">
                          T{clue.timelineTime}
                        </span>
                        {getStatusBadge(clue.status)}
                        {getTypeBadge(clue.type)}
                      </div>
                      <p className="text-sm text-slate-300 mb-2">{clue.content}</p>
                      {clue.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-2">
                          {clue.tags.map((tag, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {clue.notes && (
                        <p className="text-xs text-slate-400">📝 {clue.notes}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        来自: {getPlayerName(clue.playerId)}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => startEdit(clue)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(clue.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Trophy, Edit2, History, Clock, X, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store';
import { Ranking, Modification } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

export default function RankingPage() {
  const { rankings, addRanking, updateRanking } = useAppStore();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedRanking, setSelectedRanking] = useState<Ranking | null>(null);
  const [editForm, setEditForm] = useState({ rank: 1, playerName: '', score: 0 });
  const [editReason, setEditReason] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareItem, setCompareItem] = useState<Ranking | null>(null);

  const sortedRankings = [...rankings].sort((a, b) => a.rank - b.rank);

  const handleAdd = () => {
    setEditForm({
      rank: rankings.length + 1,
      playerName: '',
      score: 0,
    });
    setEditReason('新增排行榜记录');
    setShowAddModal(true);
  };

  const handleEdit = (ranking: Ranking) => {
    setSelectedRanking(ranking);
    setEditForm({
      rank: ranking.rank,
      playerName: ranking.playerName,
      score: ranking.score,
    });
    setEditReason('');
    setShowEditModal(true);
  };

  const handleViewHistory = (ranking: Ranking) => {
    setSelectedRanking(ranking);
    setShowHistoryModal(true);
  };

  const saveEdit = () => {
    if (!editReason.trim()) {
      alert('请填写修改原因');
      return;
    }

    if (selectedRanking) {
      updateRanking(
        selectedRanking.id,
        {
          rank: editForm.rank,
          playerName: editForm.playerName,
          score: editForm.score,
        },
        editReason,
        '运营人员'
      );
    }
    setShowEditModal(false);
  };

  const saveNew = () => {
    if (!editForm.playerName.trim()) {
      alert('请输入玩家名称');
      return;
    }

    const newRanking: Ranking = {
      id: generateId(),
      rank: editForm.rank,
      playerName: editForm.playerName,
      score: editForm.score,
      modifications: [],
    };
    addRanking(newRanking);
    setShowAddModal(false);
  };

  const moveRank = (ranking: Ranking, direction: 'up' | 'down') => {
    const currentIndex = sortedRankings.findIndex(r => r.id === ranking.id);
    if (direction === 'up' && currentIndex > 0) {
      const target = sortedRankings[currentIndex - 1];
      updateRanking(ranking.id, { rank: target.rank }, '排名上移', '运营人员');
      updateRanking(target.id, { rank: ranking.rank }, '被挤下移', '系统自动');
    } else if (direction === 'down' && currentIndex < sortedRankings.length - 1) {
      const target = sortedRankings[currentIndex + 1];
      updateRanking(ranking.id, { rank: target.rank }, '排名下移', '运营人员');
      updateRanking(target.id, { rank: ranking.rank }, '被挤上移', '系统自动');
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500 text-yellow-900';
    if (rank === 2) return 'bg-slate-400 text-slate-900';
    if (rank === 3) return 'bg-amber-700 text-amber-100';
    return 'bg-slate-600 text-slate-200';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">排行榜管理</h1>
          <p className="text-slate-400 text-sm mt-1">手动编辑排名、追踪修改历史、前后对比</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${compareMode ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            <History size={16} />
            对比模式
          </button>
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 text-sm rounded bg-orange-500 text-white flex items-center gap-1"
          >
            <Plus size={16} />
            添加记录
          </button>
        </div>
      </div>

      {compareMode && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <p className="text-sm text-orange-300">
            💡 对比模式：点击任意记录可查看修改前后对比，所有手动修改都会保留在历史中
          </p>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" />
            太空矿场排行榜
          </h2>
          <span className="text-xs text-slate-500">共 {rankings.length} 条记录</span>
        </div>
        
        {rankings.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Trophy size={48} className="mx-auto mb-3 opacity-30" />
            <p>暂无排行榜数据</p>
            <p className="text-sm mt-1">点击上方按钮添加记录或导入数据</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {sortedRankings.map((ranking) => {
              const hasModifications = ranking.modifications.length > 0;
              return (
                <div
                  key={ranking.id}
                  className={`px-4 py-3 hover:bg-slate-700/50 transition-colors ${compareMode ? 'cursor-pointer' : ''}`}
                  onClick={() => compareMode && setCompareItem(compareItem?.id === ranking.id ? null : ranking)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getRankBadge(ranking.rank)}`}>
                        {ranking.rank}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200 font-medium">{ranking.playerName}</span>
                          {hasModifications && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                              已修改 {ranking.modifications.length} 次
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-slate-400">
                          得分: {ranking.score.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!compareMode && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveRank(ranking, 'up'); }}
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded"
                            title="上移"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveRank(ranking, 'down'); }}
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded"
                            title="下移"
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewHistory(ranking); }}
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded"
                            title="查看历史"
                          >
                            <History size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(ranking); }}
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded"
                            title="编辑"
                          >
                            <Edit2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {compareMode && compareItem?.id === ranking.id && hasModifications && (
                    <div className="mt-4 p-4 bg-slate-900/50 rounded-lg">
                      <h4 className="text-sm text-slate-300 mb-3">修改历史对比</h4>
                      <div className="space-y-3">
                        {ranking.modifications.slice(-3).reverse().map((mod: Modification) => (
                          <div key={mod.id} className="grid grid-cols-2 gap-4 text-sm">
                            <div className="p-3 bg-slate-700/50 rounded">
                              <p className="text-xs text-slate-500 mb-2">
                                修改前 - {new Date(mod.timestamp).toLocaleString()}
                              </p>
                              <p className="text-slate-300">排名: {mod.before?.rank}</p>
                              <p className="text-slate-300">玩家: {mod.before?.playerName}</p>
                              <p className="text-slate-300">分数: {mod.before?.score?.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-emerald-900/30 rounded border border-emerald-700/30">
                              <p className="text-xs text-slate-500 mb-2">
                                修改后 - {mod.reason}
                              </p>
                              <p className="text-slate-300">排名: {mod.after?.rank}</p>
                              <p className="text-slate-300">玩家: {mod.after?.playerName}</p>
                              <p className="text-slate-300">分数: {mod.after?.score?.toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-md">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-medium text-slate-200">编辑排行榜</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">排名</label>
                  <input
                    type="number"
                    value={editForm.rank}
                    onChange={(e) => setEditForm({ ...editForm, rank: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">分数</label>
                  <input
                    type="number"
                    value={editForm.score}
                    onChange={(e) => setEditForm({ ...editForm, score: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">玩家名称</label>
                <input
                  type="text"
                  value={editForm.playerName}
                  onChange={(e) => setEditForm({ ...editForm, playerName: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">修改原因 *</label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                  placeholder="例如：截图修正、玩家申诉、数据补录等"
                />
                <p className="text-xs text-slate-500 mt-1">此原因会记录在历史中，用于复盘追溯</p>
              </div>
              <button
                onClick={saveEdit}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded font-medium"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-md">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-medium text-slate-200">添加排行榜记录</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">排名</label>
                  <input
                    type="number"
                    value={editForm.rank}
                    onChange={(e) => setEditForm({ ...editForm, rank: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">分数</label>
                  <input
                    type="number"
                    value={editForm.score}
                    onChange={(e) => setEditForm({ ...editForm, score: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">玩家名称</label>
                <input
                  type="text"
                  value={editForm.playerName}
                  onChange={(e) => setEditForm({ ...editForm, playerName: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                  placeholder="输入玩家名称"
                />
              </div>
              <button
                onClick={saveNew}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded font-medium"
              >
                添加记录
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && selectedRanking && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-medium text-slate-200">修改历史 - {selectedRanking.playerName}</h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              {selectedRanking.modifications.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <History size={32} className="mx-auto mb-2 opacity-50" />
                  <p>暂无修改记录</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedRanking.modifications.slice().reverse().map((mod: Modification) => (
                    <div key={mod.id} className="relative pl-6 pb-4 border-l-2 border-slate-600 last:pb-0">
                      <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-orange-500" />
                      <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                        <Clock size={12} />
                        {new Date(mod.timestamp).toLocaleString()}
                      </div>
                      <p className="text-sm text-slate-200 mb-2">
                        <span className="text-orange-400">{mod.operator}</span>: {mod.reason}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-slate-700/50 rounded">
                          <p className="text-slate-500 mb-1">修改前</p>
                          <p className="text-slate-300">#{mod.before?.rank} - {mod.before?.playerName}</p>
                          <p className="text-slate-400">{mod.before?.score?.toLocaleString()} 分</p>
                        </div>
                        <div className="p-2 bg-emerald-900/30 rounded border border-emerald-700/30">
                          <p className="text-slate-500 mb-1">修改后</p>
                          <p className="text-slate-300">#{mod.after?.rank} - {mod.after?.playerName}</p>
                          <p className="text-slate-400">{mod.after?.score?.toLocaleString()} 分</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { LostItem, CleaningTask } from '../types';
import { formatDateTime } from '../utils/storage';

interface AddFormProps {
  availableTasks: CleaningTask[];
  selectedTask: CleaningTask | null;
  onSubmit: (item: Omit<LostItem, 'id' | 'cleaningTaskId' | 'screeningId' | 'hallNumber' | 'foundTime' | 'createdAt'> & { cleaningTaskId: string }) => void;
  onCancel: () => void;
}

function AddLostItemForm({ availableTasks, selectedTask, onSubmit, onCancel }: AddFormProps) {
  const [selectedTaskId, setSelectedTaskId] = useState(selectedTask?.id || (availableTasks[0]?.id || ''));
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [foundLocation, setFoundLocation] = useState('');
  const [foundBy, setFoundBy] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (selectedTask) setSelectedTaskId(selectedTask.id);
  }, [selectedTask]);

  const handleSubmit = () => {
    if (!itemName.trim() || !foundBy.trim()) return;
    onSubmit({
      cleaningTaskId: selectedTaskId,
      itemName: itemName.trim(),
      description: description.trim(),
      foundLocation: foundLocation.trim(),
      foundBy: foundBy.trim(),
      status: 'held',
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">登记遗失物</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              关联清洁任务 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTaskId}
              onChange={e => setSelectedTaskId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              disabled={availableTasks.length === 0}
            >
              {availableTasks.length === 0 ? (
                <option value="">暂无可选清洁任务</option>
              ) : (
                availableTasks.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.hallNumber}厅 - {t.movieName} ({t.screeningEndTime}散场)
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                物品名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                placeholder="如：黑色雨伞"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                发现人 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={foundBy}
                onChange={e => setFoundBy(e.target.value)}
                placeholder="姓名"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              发现位置
            </label>
            <input
              type="text"
              value={foundLocation}
              onChange={e => setFoundLocation(e.target.value)}
              placeholder="如：第5排、座椅下、卫生间"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              物品描述
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="品牌、颜色、特征等..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              备注
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 rounded-b-xl flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!itemName.trim() || !foundBy.trim() || availableTasks.length === 0}
            className="px-4 py-2 text-sm bg-purple-500 hover:bg-purple-600 disabled:bg-slate-300 text-white rounded-lg font-medium"
          >
            确认登记
          </button>
        </div>
      </div>
    </div>
  );
}

interface ClaimFormProps {
  item: LostItem;
  onSubmit: (claimant: string, contact: string) => void;
  onCancel: () => void;
}

function ClaimForm({ item, onSubmit, onCancel }: ClaimFormProps) {
  const [claimant, setClaimant] = useState('');
  const [contact, setContact] = useState('');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">认领遗失物</h3>
          <p className="text-sm text-slate-500 mt-1">
            {item.itemName} · {item.hallNumber}厅
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              认领人姓名
            </label>
            <input
              type="text"
              value={claimant}
              onChange={e => setClaimant(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              联系方式
            </label>
            <input
              type="text"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="手机号"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 rounded-b-xl flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={() => claimant.trim() && onSubmit(claimant.trim(), contact.trim())}
            disabled={!claimant.trim()}
            className="px-4 py-2 text-sm bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white rounded-lg font-medium"
          >
            确认认领
          </button>
        </div>
      </div>
    </div>
  );
}

export function LostItemsPage() {
  const { data, addLostItem, updateLostItem, selectedTask, setSelectedTask } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [claimingItem, setClaimingItem] = useState<LostItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'held' | 'claimed' | 'disposed'>('all');

  useEffect(() => {
    if (window.location.hash === '#lostItems' && selectedTask) {
      setShowAddForm(true);
      window.location.hash = '';
    }
  }, [selectedTask]);

  const availableTasks = data.cleaningTasks.filter(
    t => t.status === 'in_progress' || t.status === 'completed'
  );

  const filteredItems = data.lostItems.filter(l => {
    if (filter === 'all') return true;
    return l.status === filter;
  }).sort((a, b) => b.foundTime.localeCompare(a.foundTime));

  const handleAdd = (item: any) => {
    const task = data.cleaningTasks.find(t => t.id === item.cleaningTaskId);
    if (task) {
      const { cleaningTaskId, ...rest } = item;
      addLostItem(task, rest);
    }
    setShowAddForm(false);
    if (selectedTask) setSelectedTask(null);
  };

  const handleClaim = (item: LostItem, claimant: string, contact: string) => {
    updateLostItem(item.id, {
      status: 'claimed',
      claimant,
      claimantContact: contact || undefined,
      claimedTime: formatDateTime(new Date()),
    });
    setClaimingItem(null);
  };

  const handleDispose = (item: LostItem) => {
    if (confirm(`确定将 "${item.itemName}" 标记为已处理？`)) {
      updateLostItem(item.id, { status: 'disposed' });
    }
  };

  return (
    <div className="space-y-6">
      {showAddForm && (
        <AddLostItemForm
          availableTasks={availableTasks}
          selectedTask={selectedTask}
          onSubmit={handleAdd}
          onCancel={() => {
            setShowAddForm(false);
            if (selectedTask) setSelectedTask(null);
          }}
        />
      )}

      {claimingItem && (
        <ClaimForm
          item={claimingItem}
          onSubmit={(claimant, contact) => handleClaim(claimingItem, claimant, contact)}
          onCancel={() => setClaimingItem(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {[
            { key: 'all', label: '全部' },
            { key: 'held', label: '待认领' },
            { key: 'claimed', label: '已认领' },
            { key: 'disposed', label: '已处理' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                filter === f.key
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f.label}
              <span className="ml-1 text-xs opacity-70">
                ({f.key === 'all' ? data.lostItems.length :
                   data.lostItems.filter(l => l.status === f.key).length})
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          + 登记遗失物
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {filteredItems.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {filteredItems.map(item => {
              return (
                <div key={item.id} className="p-5 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">📦</span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-slate-800">{item.itemName}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.status === 'held' ? 'bg-yellow-100 text-yellow-700' :
                              item.status === 'claimed' ? 'bg-green-100 text-green-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {{ held: '待认领', claimed: '已认领', disposed: '已处理' }[item.status]}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-slate-500">
                            <span>影厅: {item.hallNumber}厅</span>
                            <span>发现人: {item.foundBy}</span>
                            <span>发现时间: {item.foundTime.split(' ')[1]?.slice(0, 5)}</span>
                          </div>
                          {item.description && (
                            <div className="mt-2 text-sm text-slate-600">
                              描述: {item.description}
                            </div>
                          )}
                          {item.foundLocation && (
                            <div className="mt-1 text-sm text-slate-500">
                              位置: {item.foundLocation}
                            </div>
                          )}
                          {item.claimant && (
                            <div className="mt-2 text-sm text-slate-600 bg-green-50 px-3 py-2 rounded-lg inline-block">
                              🏷️ {item.claimant}{item.claimantContact ? ` (${item.claimantContact})` : ''}
                              {item.claimedTime && ` 于 ${item.claimedTime.split(' ')[1]?.slice(0, 5)} 认领`}
                            </div>
                          )}
                          {item.notes && (
                            <div className="mt-2 text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                              📝 {item.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {item.status === 'held' && (
                        <>
                          <button
                            onClick={() => setClaimingItem(item)}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            认领
                          </button>
                          <button
                            onClick={() => handleDispose(item)}
                            className="px-3 py-1.5 bg-slate-500 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            标记处理
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <div className="text-5xl mb-3">📦</div>
            <p>暂无遗失物记录</p>
            <p className="text-sm mt-1">在清洁过程中发现的物品可以在此登记</p>
          </div>
        )}
      </div>
    </div>
  );
}

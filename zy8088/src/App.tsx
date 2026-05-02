import { useState, useEffect, useCallback } from 'react';
import { WorkOrder, SyncState, ConflictRecord, Photo } from './types';
import { syncStateMachine } from './sync/stateMachine';
import { computeDiff, downloadConflictReport, createMergedVersion } from './conflict/merge';
import { saveWorkOrderLocal, getAllWorkOrdersLocal, getSyncQueue, getAllConflicts, clearAllData } from './storage/indexedDB';
import { fetchWorkOrders, setServerOnline, setServerOpen, resetServerData, getServerConfig } from './server/mockServer';
import './styles.css';

function App() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('IDLE');
  const [syncQueue, setSyncQueue] = useState<unknown[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isServerOpen, setIsServerOpen] = useState(true);
  const [editingNotes, setEditingNotes] = useState('');
  const [editingStatus, setEditingStatus] = useState<WorkOrder['status']>('pending');
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [currentConflict, setCurrentConflict] = useState<ConflictRecord | null>(null);
  const [conflictDiff, setConflictDiff] = useState<ReturnType<typeof computeDiff> | null>(null);
  const [fieldSelections, setFieldSelections] = useState<Record<string, 'local' | 'remote'>>({});
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    const orders = await getAllWorkOrdersLocal();
    if (orders.length === 0) {
      const serverOrders = await fetchWorkOrders();
      for (const order of serverOrders) {
        await saveWorkOrderLocal(order);
      }
      setWorkOrders(serverOrders);
    } else {
      setWorkOrders(orders);
    }

    const queue = await getSyncQueue();
    setSyncQueue(queue);

    const conflictRecords = await getAllConflicts();
    setConflicts(conflictRecords);
  }, []);

  useEffect(() => {
    loadData();

    const unsubscribe = syncStateMachine.subscribe(state => {
      setSyncState(state);
    });

    return () => unsubscribe();
  }, [loadData]);

  useEffect(() => {
    if (selectedOrder) {
      setEditingNotes(selectedOrder.notes);
      setEditingStatus(selectedOrder.status);
    }
  }, [selectedOrder]);

  const handleOnlineToggle = () => {
    const newOnline = !isOnline;
    setIsOnline(newOnline);
    setServerOnline(newOnline);
    if (!newOnline) {
      syncStateMachine.setOffline();
    } else {
      syncStateMachine.setOnline();
    }
    setMessage(newOnline ? '已切换到在线模式' : '已切换到离线模式');
  };

  const handleServerOpenToggle = () => {
    const newOpen = !isServerOpen;
    setIsServerOpen(newOpen);
    setServerOpen(newOpen);
    setMessage(newOpen ? '服务端已开启' : '服务端已关闭（维护中）');
  };

  const handleSelectOrder = (order: WorkOrder) => {
    setSelectedOrder(order);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;

    const updated: WorkOrder = {
      ...selectedOrder,
      notes: editingNotes,
      status: editingStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: 'local'
    };

    await saveWorkOrderLocal(updated);
    await syncStateMachine.handleLocalUpdate(updated);

    setWorkOrders(prev => prev.map(wo => wo.id === updated.id ? updated : wo));
    setSelectedOrder(updated);

    const queue = await getSyncQueue();
    setSyncQueue(queue);

    setMessage('已保存到本地，同步队列已更新');
  };

  const handleAddPhoto = () => {
    if (!selectedOrder) return;

    const newPhoto: Photo = {
      id: `P-${Date.now()}`,
      url: `https://picsum.photos/seed/${Date.now()}/200/200`,
      caption: '新照片',
      updatedAt: new Date().toISOString()
    };

    const updated: WorkOrder = {
      ...selectedOrder,
      photos: [...selectedOrder.photos, newPhoto],
      updatedAt: new Date().toISOString(),
      updatedBy: 'local'
    };

    setSelectedOrder(updated);
    setWorkOrders(prev => prev.map(wo => wo.id === updated.id ? updated : wo));
    setMessage('照片已添加，点击保存生效');
  };

  const handleUpdatePhotoCaption = (photoId: string, caption: string) => {
    if (!selectedOrder) return;

    const updated: WorkOrder = {
      ...selectedOrder,
      photos: selectedOrder.photos.map(p =>
        p.id === photoId ? { ...p, caption, updatedAt: new Date().toISOString() } : p
      ),
      updatedAt: new Date().toISOString(),
      updatedBy: 'local'
    };

    setSelectedOrder(updated);
    setWorkOrders(prev => prev.map(wo => wo.id === updated.id ? updated : wo));
  };

  const handleSync = async () => {
    setMessage('正在同步...');
    const result = await syncStateMachine.sync();

    if (result.conflicts.length > 0) {
      setConflicts(result.conflicts);
      setCurrentConflict(result.conflicts[0]);
      const diff = computeDiff(result.conflicts[0].localVersion, result.conflicts[0].remoteVersion);
      setConflictDiff(diff);
      setFieldSelections({});
      setShowConflictModal(true);
      setMessage(`发现 ${result.conflicts.length} 个冲突`);
    } else if (result.success) {
      setMessage('同步成功');
      await loadData();
    } else {
      const config = getServerConfig();
      if (!config.isOnline) {
        setMessage('网络不可用，请稍后重试');
      } else if (!config.isOpen) {
        setMessage('服务端关闭中，无法同步');
      } else {
        setMessage('同步失败');
      }
    }

    const queue = await getSyncQueue();
    setSyncQueue(queue);
  };

  const handleResolveConflict = async (resolution: 'local' | 'remote' | 'merged') => {
    if (!currentConflict) return;

    let mergedData: WorkOrder | undefined;

    if (resolution === 'merged') {
      mergedData = createMergedVersion(currentConflict.localVersion, currentConflict.remoteVersion, fieldSelections);
    }

    await syncStateMachine.resolveConflict(currentConflict.workOrderId, resolution, mergedData);
    await loadData();

    const remainingConflicts = await getAllConflicts();
    setConflicts(remainingConflicts);

    if (remainingConflicts.length > 0) {
      setCurrentConflict(remainingConflicts[0]);
      const diff = computeDiff(remainingConflicts[0].localVersion, remainingConflicts[0].remoteVersion);
      setConflictDiff(diff);
      setFieldSelections({});
    } else {
      setShowConflictModal(false);
      setCurrentConflict(null);
      setConflictDiff(null);
      setMessage('冲突已解决');
    }
  };

  const handleFieldSelection = (field: string, selection: 'local' | 'remote') => {
    setFieldSelections(prev => ({ ...prev, [field]: selection }));
  };

  const handleExportReport = () => {
    downloadConflictReport(conflicts);
    setMessage('冲突报告已导出');
  };

  const handleReset = async () => {
    await clearAllData();
    resetServerData();
    await loadData();
    setSelectedOrder(null);
    setMessage('数据已重置');
  };

  const getStatusColor = (status: WorkOrder['status']) => {
    switch (status) {
      case 'pending': return '#ffa500';
      case 'in_progress': return '#4169e1';
      case 'completed': return '#32cd32';
      case 'closed': return '#808080';
      default: return '#000';
    }
  };

  const getSyncStateLabel = (state: SyncState) => {
    switch (state) {
      case 'IDLE': return '空闲';
      case 'SYNCING': return '同步中';
      case 'OFFLINE': return '离线';
      case 'CONFLICT': return '冲突';
      case 'ERROR': return '错误';
      default: return state;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>巡检工单同步实验台</h1>
        <div className="header-controls">
          <div className="toggle-group">
            <span>网络状态:</span>
            <button
              className={`toggle-btn ${isOnline ? 'online' : 'offline'}`}
              onClick={handleOnlineToggle}
            >
              {isOnline ? '在线' : '离线'}
            </button>
          </div>
          <div className="toggle-group">
            <span>服务端:</span>
            <button
              className={`toggle-btn ${isServerOpen ? 'open' : 'closed'}`}
              onClick={handleServerOpenToggle}
            >
              {isServerOpen ? '开启' : '关闭'}
            </button>
          </div>
          <div className="sync-status">
            <span className={`status-indicator ${syncState.toLowerCase()}`}></span>
            <span>{getSyncStateLabel(syncState)}</span>
          </div>
          <button className="sync-btn" onClick={handleSync} disabled={syncState === 'SYNCING'}>
            同步
          </button>
        </div>
      </header>

      {message && <div className="message">{message}</div>}

      <div className="main-content">
        <div className="workorder-list">
          <h2>工单列表 ({workOrders.length})</h2>
          {workOrders.map(order => (
            <div
              key={order.id}
              className={`workorder-item ${selectedOrder?.id === order.id ? 'selected' : ''}`}
              onClick={() => handleSelectOrder(order)}
            >
              <div className="wo-header">
                <span className="wo-id">{order.id}</span>
                <span
                  className="wo-status"
                  style={{ backgroundColor: getStatusColor(order.status) }}
                >
                  {order.status}
                </span>
              </div>
              <div className="wo-title">{order.title}</div>
              <div className="wo-meta">
                <span>v{order.version}</span>
                <span>{order.updatedBy === 'local' ? '本地' : '远端'}</span>
                <span>{order.photos.length}张照片</span>
              </div>
            </div>
          ))}
        </div>

        <div className="workorder-editor">
          {selectedOrder ? (
            <>
              <div className="editor-header">
                <h2>{selectedOrder.id} - {selectedOrder.title}</h2>
                <div className="editor-actions">
                  <button className="save-btn" onClick={handleSaveEdit}>保存</button>
                </div>
              </div>

              <div className="editor-section">
                <label>状态:</label>
                <select
                  value={editingStatus}
                  onChange={e => setEditingStatus(e.target.value as WorkOrder['status'])}
                >
                  <option value="pending">待处理</option>
                  <option value="in_progress">进行中</option>
                  <option value="completed">已完成</option>
                  <option value="closed">已关闭</option>
                </select>
              </div>

              <div className="editor-section">
                <label>备注:</label>
                <textarea
                  value={editingNotes}
                  onChange={e => setEditingNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="editor-section">
                <div className="photos-header">
                  <label>照片 ({selectedOrder.photos.length}):</label>
                  <button className="add-photo-btn" onClick={handleAddPhoto}>+ 添加照片</button>
                </div>
                <div className="photos-grid">
                  {selectedOrder.photos.map(photo => (
                    <div key={photo.id} className="photo-item">
                      <img src={photo.url} alt={photo.caption} />
                      <input
                        type="text"
                        value={photo.caption}
                        onChange={e => handleUpdatePhotoCaption(photo.id, e.target.value)}
                        placeholder="照片说明"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <p>请选择一个工单进行编辑</p>
            </div>
          )}
        </div>

        <div className="sync-panel">
          <h2>同步队列 ({syncQueue.length})</h2>
          {syncQueue.length === 0 ? (
            <p className="empty-queue">队列为空</p>
          ) : (
            <div className="queue-list">
              {syncQueue.map((item: unknown) => {
                const qi = item as { id: string; workOrderId: string; operation: string; status: string; retryCount: number };
                return (
                  <div key={qi.id} className={`queue-item ${qi.status}`}>
                    <span>{qi.workOrderId}</span>
                    <span>{qi.operation}</span>
                    <span className={`status-badge ${qi.status}`}>{qi.status}</span>
                    {qi.retryCount > 0 && <span>重试: {qi.retryCount}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="conflicts-section">
              <h3>冲突 ({conflicts.length})</h3>
              <button className="export-btn" onClick={handleExportReport}>
                导出冲突报告
              </button>
              <div className="conflict-list">
                {conflicts.map(c => (
                  <div key={c.workOrderId} className="conflict-item">
                    <span>{c.workOrderId}</span>
                    <span>本地v{c.localVersion.version} vs 远端v{c.remoteVersion.version}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="reset-btn" onClick={handleReset}>重置所有数据</button>
        </div>
      </div>

      {showConflictModal && currentConflict && conflictDiff && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>冲突解决 - {currentConflict.workOrderId}</h2>

            <div className="diff-view">
              <div className="diff-section">
                <h3>字段差异</h3>
                {conflictDiff.fields.map(f => (
                  <div key={f.field} className={`diff-row ${f.isDifferent ? 'different' : ''}`}>
                    <span className="field-label">{f.label}</span>
                    <div className="diff-values">
                      <div className="value local">
                        <span className="value-label">本地</span>
                        <span className="value-content">{String(f.localValue)}</span>
                        {f.isDifferent && (
                          <button
                            className="select-btn"
                            onClick={() => handleFieldSelection(f.field, 'local')}
                          >
                            选用
                          </button>
                        )}
                      </div>
                      <div className="value remote">
                        <span className="value-label">远端</span>
                        <span className="value-content">{String(f.remoteValue)}</span>
                        {f.isDifferent && (
                          <button
                            className="select-btn"
                            onClick={() => handleFieldSelection(f.field, 'remote')}
                          >
                            选用
                          </button>
                        )}
                      </div>
                    </div>
                    {f.isDifferent && fieldSelections[f.field] && (
                      <span className="selection-indicator">
                        已选: {fieldSelections[f.field] === 'local' ? '本地' : '远端'}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {conflictDiff.photosDiff.added.length > 0 && (
                <div className="diff-section">
                  <h3>远端新增照片</h3>
                  {conflictDiff.photosDiff.added.map(p => (
                    <div key={p.id} className="photo-change">
                      <img src={p.url} alt={p.caption} />
                      <span>{p.caption}</span>
                    </div>
                  ))}
                </div>
              )}

              {conflictDiff.photosDiff.removed.length > 0 && (
                <div className="diff-section">
                  <h3>本地独有照片（远端已删除）</h3>
                  {conflictDiff.photosDiff.removed.map(p => (
                    <div key={p.id} className="photo-change">
                      <img src={p.url} alt={p.caption} />
                      <span>{p.caption}</span>
                    </div>
                  ))}
                </div>
              )}

              {conflictDiff.photosDiff.modified.length > 0 && (
                <div className="diff-section">
                  <h3>照片说明变更</h3>
                  {conflictDiff.photosDiff.modified.map(p => (
                    <div key={p.id} className="photo-change">
                      <span>{p.caption}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="resolve-btn local"
                onClick={() => handleResolveConflict('local')}
              >
                使用本地版本
              </button>
              <button
                className="resolve-btn remote"
                onClick={() => handleResolveConflict('remote')}
              >
                使用远端版本
              </button>
              <button
                className="resolve-btn merged"
                onClick={() => handleResolveConflict('merged')}
                disabled={Object.keys(fieldSelections).length === 0}
              >
                使用合并版本
              </button>
              <button
                className="cancel-btn"
                onClick={() => setShowConflictModal(false)}
              >
                稍后处理
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

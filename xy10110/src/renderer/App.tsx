import React, { useState, useEffect, useCallback } from 'react';
import { ArchiveItem, HistoryRecord, ItemStatus, FileType } from '../shared/types';
import { api } from './api';
import ItemForm from './components/ItemForm';
import ItemList from './components/ItemList';
import HistoryPanel from './components/HistoryPanel';
import EditModal from './components/EditModal';

type TabType = 'items' | 'history';
type StatusFilter = 'all' | ItemStatus;

const App: React.FC = () => {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<ArchiveItem | null>(null);
  const [messages, setMessages] = useState<{ type: 'success' | 'error' | 'warning'; text: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const state = await api.getState();
      setItems(state.items);
      setHistory(state.history);
    } catch (e) {
      console.error('Failed to load state:', e);
      showMessage('error', '加载数据失败，请确保服务器正在运行');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const showMessage = (type: 'success' | 'error' | 'warning', text: string) => {
    const id = Date.now();
    setMessages(prev => [...prev, { type, text }]);
    setTimeout(() => {
      setMessages(prev => prev.filter((_, i) => i !== 0));
    }, 5000);
  };

  const handleAddItem = async (itemData: Omit<ArchiveItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'deliveredAt'>) => {
    const result = await api.addItem(itemData);
    
    if (result.success && result.item) {
      setItems(prev => [result.item!, ...prev]);
      showMessage('success', `成功添加项目: ${result.item.name}`);
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(w => showMessage('warning', w));
      }
      return true;
    } else {
      if (result.errors) {
        result.errors.forEach(e => showMessage('error', e));
      }
      if (result.warnings) {
        result.warnings.forEach(w => showMessage('warning', w));
      }
      return false;
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<ArchiveItem>) => {
    const result = await api.updateItem(id, updates);
    
    if (result.success && result.item) {
      setItems(prev => prev.map(item => item.id === id ? result.item! : item));
      showMessage('success', `成功更新项目: ${result.item.name}`);
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(w => showMessage('warning', w));
      }
      setEditingItem(null);
      loadState();
      return true;
    } else {
      if (result.errors) {
        result.errors.forEach(e => showMessage('error', e));
      }
      if (result.warnings) {
        result.warnings.forEach(w => showMessage('warning', w));
      }
      return false;
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？此操作不可撤销。')) {
      return;
    }
    
    const result = await api.deleteItem(id);
    if (result.success) {
      setItems(prev => prev.filter(item => item.id !== id));
      setSelectedIds(prev => prev.filter(sid => sid !== id));
      showMessage('success', '项目已删除');
      loadState();
    } else {
      showMessage('error', result.error || '删除失败');
    }
  };

  const handleMarkReviewed = async (id: string) => {
    const result = await api.markReviewed(id);
    
    if (result.success && result.item) {
      setItems(prev => prev.map(item => item.id === id ? result.item! : item));
      showMessage('success', `项目已标记为已复核: ${result.item.name}`);
      loadState();
    } else {
      if (result.error) {
        showMessage('error', result.error);
      }
      if (result.warnings) {
        result.warnings.forEach(w => showMessage('warning', w));
      }
    }
  };

  const handleMarkDelivered = async (id: string) => {
    const result = await api.markDelivered(id);
    
    if (result.success && result.item) {
      setItems(prev => prev.map(item => item.id === id ? result.item! : item));
      showMessage('success', `项目已标记为已交付: ${result.item.name}`);
      loadState();
    } else {
      if (result.error) {
        showMessage('error', result.error);
      }
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const filteredItems = statusFilter === 'all' ? items : items.filter(i => i.status === statusFilter);
    const filteredIds = filteredItems.map(i => i.id);
    const allSelected = filteredIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      showMessage('warning', '请先选择要导出的项目');
      return;
    }
    
    const result = await api.exportManifest(selectedIds);
    if (result.success) {
      showMessage('success', `清单已导出，点击下载`);
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }
      loadState();
    } else {
      showMessage('error', result.error || '导出失败');
    }
  };

  const stats = {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    reviewed: items.filter(i => i.status === 'reviewed').length,
    delivered: items.filter(i => i.status === 'delivered').length
  };

  const filteredItems = statusFilter === 'all' 
    ? items 
    : items.filter(i => i.status === statusFilter);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🎬</div>
          <div>加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎬 屏幕录制素材交付归档器</h1>
        <p>管理您的录屏素材、字幕文件和交付版本，确保不会遗漏任何文件</p>
      </header>

      {messages.length > 0 && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, maxWidth: 400 }}>
          {messages.map((msg, index) => (
            <div key={index} className={`alert alert-${msg.type}`}>
              {msg.text}
            </div>
          ))}
        </div>
      )}

      <main className="main-content">
        <aside className="sidebar">
          <ItemForm onSubmit={handleAddItem} />
        </aside>

        <section className="content-area">
          <div className="stats-bar">
            <div className="stat-card">
              <h3>总项目数</h3>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="stat-card">
              <h3>待复核</h3>
              <div className="stat-value" style={{ color: '#f39c12' }}>{stats.pending}</div>
            </div>
            <div className="stat-card">
              <h3>已复核</h3>
              <div className="stat-value" style={{ color: '#11998e' }}>{stats.reviewed}</div>
            </div>
            <div className="stat-card">
              <h3>已交付</h3>
              <div className="stat-value" style={{ color: '#667eea' }}>{stats.delivered}</div>
            </div>
          </div>

          <div className="tabs">
            <button 
              className={`tab-btn ${activeTab === 'items' ? 'active' : ''}`}
              onClick={() => setActiveTab('items')}
            >
              📁 项目列表 ({items.length})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📜 历史记录 ({history.length})
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'items' ? (
              <ItemList
                items={filteredItems}
                selectedIds={selectedIds}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onEdit={setEditingItem}
                onDelete={handleDeleteItem}
                onMarkReviewed={handleMarkReviewed}
                onMarkDelivered={handleMarkDelivered}
                onExport={handleExport}
              />
            ) : (
              <HistoryPanel history={history} />
            )}
          </div>
        </section>
      </main>

      {editingItem && (
        <EditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleUpdateItem}
        />
      )}
    </div>
  );
};

export default App;

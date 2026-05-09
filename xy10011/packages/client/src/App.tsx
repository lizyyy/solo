import { useState, useEffect } from 'react';
import { Group, Bill, Event, Conflict, BalanceResult } from './types';
import { api, USER_ID } from './api/client';
import { GroupList } from './components/GroupList';
import { BillList } from './components/BillList';
import { BillForm } from './components/BillForm';
import { EventHistory } from './components/EventHistory';
import { ConflictList } from './components/ConflictList';
import { ReportExport } from './components/ReportExport';
import './App.css';

export default function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [balances, setBalances] = useState<BalanceResult | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [showBillForm, setShowBillForm] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [activeTab, setActiveTab] = useState<'bills' | 'audit' | 'conflicts' | 'reports'>('bills');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
    loadConflicts();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupData(selectedGroup.id);
    }
  }, [selectedGroup]);

  async function loadGroups() {
    try {
      setLoading(true);
      const data = await api.groups.getByUser(USER_ID);
      setGroups(data);
      
      if (data.length === 0) {
        const newGroup = await api.groups.create({
          name: '我的账单',
          description: '默认账单组',
          members: [USER_ID],
          createdBy: USER_ID,
        });
        setGroups([newGroup]);
        setSelectedGroup(newGroup);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadGroupData(groupId: string) {
    try {
      setLoading(true);
      const [billsData, balancesData] = await Promise.all([
        api.bills.getByGroup(groupId),
        api.bills.getBalances(groupId),
      ]);
      setBills(billsData);
      setBalances(balancesData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadConflicts() {
    try {
      const data = await api.events.getConflicts();
      setConflicts(data);
    } catch (err) {
      console.error('Failed to load conflicts:', err);
    }
  }

  async function loadEventHistory() {
    if (!selectedGroup) return;
    try {
      setLoading(true);
      const data = await api.events.getByAggregate(selectedGroup.id);
      const billEvents: Event[] = [];
      
      for (const bill of bills) {
        const billData = await api.events.getByAggregate(bill.id);
        billEvents.push(...billData);
      }
      
      setEvents([...data, ...billEvents].sort((a, b) => b.timestamp - a.timestamp));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'audit') {
      loadEventHistory();
    }
  }, [activeTab, bills.length]);

  async function handleSaveBill(billData: any) {
    try {
      setError(null);
      if (editingBill) {
        await api.bills.update(editingBill.id, editingBill.version, billData);
      } else {
        await api.bills.create({
          ...billData,
          groupId: selectedGroup!.id,
          createdBy: USER_ID,
          currency: 'CNY',
        });
      }
      setShowBillForm(false);
      setEditingBill(null);
      if (selectedGroup) {
        await loadGroupData(selectedGroup.id);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDeleteBill(bill: Bill) {
    if (!confirm(`确定要删除账单 "${bill.title}" 吗？`)) return;
    try {
      await api.bills.delete(bill.id, bill.version);
      if (selectedGroup) {
        await loadGroupData(selectedGroup.id);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleResolveConflict(conflictId: string, strategy: string) {
    try {
      await api.events.resolveConflict(conflictId, { strategy });
      await loadConflicts();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>账单分摊系统</h1>
        <div className="user-info">
          <span>用户ID: {USER_ID}</span>
        </div>
      </header>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="main-content">
        <aside className="sidebar">
          <GroupList
            groups={groups}
            selectedGroup={selectedGroup}
            onSelect={setSelectedGroup}
          />
          
          {conflicts.length > 0 && (
            <div className="conflict-alert">
              <strong>⚠️ {conflicts.length} 个待解决的冲突</strong>
              <button onClick={() => setActiveTab('conflicts')}>查看</button>
            </div>
          )}
        </aside>

        <main className="content">
          {selectedGroup && (
            <>
              <div className="group-header">
                <h2>{selectedGroup.name}</h2>
                <button 
                  className="primary-button"
                  onClick={() => { setEditingBill(null); setShowBillForm(true); }}
                >
                  + 添加账单
                </button>
              </div>

              {balances && balances.settlementSuggestions.length > 0 && (
                <div className="balances-card">
                  <h3>结算建议</h3>
                  <ul>
                    {balances.settlementSuggestions.map((s, i) => (
                      <li key={i}>
                        {s.from} → {s.to}: {s.amount.toFixed(2)} 元
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="tabs">
                <button 
                  className={activeTab === 'bills' ? 'active' : ''}
                  onClick={() => setActiveTab('bills')}
                >
                  账单列表
                </button>
                <button 
                  className={activeTab === 'audit' ? 'active' : ''}
                  onClick={() => setActiveTab('audit')}
                >
                  操作历史
                </button>
                <button 
                  className={activeTab === 'conflicts' ? 'active' : ''}
                  onClick={() => setActiveTab('conflicts')}
                >
                  冲突管理
                </button>
                <button 
                  className={activeTab === 'reports' ? 'active' : ''}
                  onClick={() => setActiveTab('reports')}
                >
                  导出报告
                </button>
              </div>

              <div className="tab-content">
                {loading ? (
                  <div className="loading">加载中...</div>
                ) : (
                  <>
                    {activeTab === 'bills' && (
                      <BillList
                        bills={bills}
                        onEdit={(bill) => { setEditingBill(bill); setShowBillForm(true); }}
                        onDelete={handleDeleteBill}
                      />
                    )}
                    {activeTab === 'audit' && (
                      <EventHistory events={events} />
                    )}
                    {activeTab === 'conflicts' && (
                      <ConflictList
                        conflicts={conflicts}
                        onResolve={handleResolveConflict}
                      />
                    )}
                    {activeTab === 'reports' && (
                      <ReportExport groupId={selectedGroup.id} />
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {showBillForm && (
        <BillForm
          bill={editingBill}
          group={selectedGroup!}
          userId={USER_ID}
          onSave={handleSaveBill}
          onCancel={() => { setShowBillForm(false); setEditingBill(null); }}
        />
      )}
    </div>
  );
}

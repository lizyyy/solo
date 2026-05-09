import React, { useState, useEffect, useCallback } from 'react';
import { StatsPanel } from './components/StatsPanel';
import { ImportPanel } from './components/ImportPanel';
import { TransactionTable } from './components/TransactionTable';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { ExportPanel } from './components/ExportPanel';
import { api } from './api';
import { Transaction, Statistics, TransactionFilters } from './types';

type TabType = 'list' | 'import' | 'export';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [stats, setStats] = useState<Statistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [listLoading, setListLoading] = useState(false);

  const [filters, setFilters] = useState<TransactionFilters>({
    is_anomaly: true,
  });

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await api.getStatistics();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setListLoading(true);
    try {
      const result = await api.getTransactions(page, pageSize, filters);
      setTransactions(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setListLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchTransactions();
    }
  }, [activeTab, fetchTransactions]);

  const handleRefresh = () => {
    fetchStats();
    fetchTransactions();
  };

  const handleFilterChange = (key: keyof TransactionFilters, value: any) => {
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>🛡️ 异常交易样本解释台</h1>
        <p>风控模型高风险样本解释 · 人工复核 · 误判回滚 · 全流程可追踪</p>
      </header>

      <main className="main-content">
        <StatsPanel stats={stats} loading={statsLoading} />

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            📋 异常交易列表
          </button>
          <button
            className={`tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            📥 数据导入
          </button>
          <button
            className={`tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            📤 报告导出
          </button>
        </div>

        {activeTab === 'list' && (
          <>
            <div className="filters">
              <div className="filter-group">
                <label>显示范围</label>
                <select
                  value={filters.is_anomaly === undefined ? 'all' : filters.is_anomaly ? 'anomaly' : 'normal'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'all') handleFilterChange('is_anomaly', undefined);
                    else handleFilterChange('is_anomaly', val === 'anomaly');
                  }}
                >
                  <option value="anomaly">仅异常交易</option>
                  <option value="normal">仅正常交易</option>
                  <option value="all">全部交易</option>
                </select>
              </div>

              <div className="filter-group">
                <label>复核状态</label>
                <select
                  value={
                    filters.reviewed === undefined
                      ? 'all'
                      : filters.reviewed
                      ? 'reviewed'
                      : 'unreviewed'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'all') handleFilterChange('reviewed', undefined);
                    else handleFilterChange('reviewed', val === 'reviewed');
                  }}
                >
                  <option value="all">全部</option>
                  <option value="unreviewed">待复核</option>
                  <option value="reviewed">已复核</option>
                </select>
              </div>

              <div className="filter-group">
                <label>最低风险分</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.min_score ?? ''}
                  onChange={(e) =>
                    handleFilterChange('min_score', e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="0-100"
                  style={{ width: 80 }}
                />
              </div>

              <div className="filter-group">
                <label>搜索</label>
                <input
                  type="text"
                  value={filters.search ?? ''}
                  onChange={(e) => handleFilterChange('search', e.target.value || undefined)}
                  placeholder="交易ID/用户ID/商户"
                />
              </div>

              <button className="btn btn-default" onClick={handleRefresh}>
                🔄 刷新
              </button>
            </div>

            <TransactionTable
              transactions={transactions}
              total={total}
              page={page}
              pageSize={pageSize}
              loading={listLoading}
              onViewDetail={setSelectedTransaction}
              onPageChange={setPage}
            />
          </>
        )}

        {activeTab === 'import' && <ImportPanel onSuccess={handleRefresh} />}

        {activeTab === 'export' && <ExportPanel />}
      </main>

      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onUpdated={handleRefresh}
        />
      )}
    </div>
  );
};

export default App;

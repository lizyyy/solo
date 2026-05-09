import React, { useState, useEffect, useCallback } from 'react';
import RepairDetail from '../components/RepairDetail.jsx';
import CreateRepairModal from '../components/CreateRepairModal.jsx';
import Toast from '../components/Toast.jsx';

function RepairList() {
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [filters, setFilters] = useState({
    status: 'all',
    dorm: '',
    startDate: '',
    endDate: '',
    hasDiscrepancy: '',
    keyword: ''
  });

  const fetchRepairs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all' && value !== '') {
          params.append(key, value);
        }
      });
      
      const response = await fetch(`/api/repairs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRepairs(data);
        setCurrentPage(1);
      }
    } catch (error) {
      showToast('获取数据失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending_verification: '待确认',
      discrepancy: '异常待处理',
      completed: '已完成'
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status) => {
    const classMap = {
      pending_verification: 'status-pending',
      discrepancy: 'status-discrepancy',
      completed: 'status-completed'
    };
    return classMap[status] || '';
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all' && value !== '') {
          params.append(key, value);
        }
      });
      
      const response = await fetch(`/api/export/repairs?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `repairs_${Date.now()}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('导出成功', 'success');
      }
    } catch (error) {
      showToast('导出失败', 'error');
    }
  };

  const paginatedRepairs = repairs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(repairs.length / pageSize);

  const stats = {
    total: repairs.length,
    pending: repairs.filter(r => r.status === 'pending_verification').length,
    discrepancy: repairs.filter(r => r.status === 'discrepancy').length,
    completed: repairs.filter(r => r.status === 'completed').length
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="stats-grid">
        <div className="stat-card primary">
          <h3>维修单总数</h3>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card warning">
          <h3>待确认</h3>
          <div className="value">{stats.pending}</div>
        </div>
        <div className="stat-card danger">
          <h3>异常待处理</h3>
          <div className="value">{stats.discrepancy}</div>
        </div>
        <div className="stat-card success">
          <h3>已完成</h3>
          <div className="value">{stats.completed}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>维修核销列表</h2>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={handleExport}>
              导出数据
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              新建维修单
            </button>
          </div>
        </div>

        <div className="search-bar">
          <div className="form-group">
            <label>状态筛选</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="all">全部状态</option>
              <option value="pending_verification">待确认</option>
              <option value="discrepancy">异常待处理</option>
              <option value="completed">已完成</option>
            </select>
          </div>
          <div className="form-group">
            <label>宿舍筛选</label>
            <input
              type="text"
              placeholder="输入楼号或宿舍号"
              value={filters.dorm}
              onChange={(e) => setFilters({ ...filters, dorm: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>开始日期</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>结束日期</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>仅显示异常</label>
            <select
              value={filters.hasDiscrepancy}
              onChange={(e) => setFilters({ ...filters, hasDiscrepancy: e.target.value })}
            >
              <option value="">全部</option>
              <option value="true">有异常</option>
              <option value="false">无异常</option>
            </select>
          </div>
          <div className="form-group">
            <label>搜索</label>
            <input
              type="text"
              placeholder="编号、学生姓名、电话..."
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading">加载中</div>
        ) : paginatedRepairs.length === 0 ? (
          <div className="empty-state">
            <p>暂无维修单数据</p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              新建维修单
            </button>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>维修单编号</th>
                    <th>学生信息</th>
                    <th>宿舍</th>
                    <th>维修类型</th>
                    <th>材料领用</th>
                    <th>材料退回</th>
                    <th>状态</th>
                    <th>异常</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRepairs.map(repair => {
                    const claimItems = repair.items.filter(i => i.type === 'claim');
                    const returnItems = repair.items.filter(i => i.type === 'return');
                    
                    return (
                      <tr key={repair.id} className="clickable">
                        <td onClick={() => setSelectedRepair(repair)}>
                          <strong>{repair.id}</strong>
                        </td>
                        <td onClick={() => setSelectedRepair(repair)}>
                          {repair.studentName}
                          <br />
                          <small style={{ color: '#999' }}>{repair.studentPhone}</small>
                        </td>
                        <td onClick={() => setSelectedRepair(repair)}>
                          {repair.dormBuilding}-{repair.dormNumber}
                        </td>
                        <td onClick={() => setSelectedRepair(repair)}>
                          {repair.repairType}
                        </td>
                        <td onClick={() => setSelectedRepair(repair)}>
                          {claimItems.length > 0 ? (
                            <span className="tag tag-claim">
                              {claimItems.length}项 · {claimItems.reduce((s, i) => s + i.quantity, 0)}件
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          )}
                        </td>
                        <td onClick={() => setSelectedRepair(repair)}>
                          {returnItems.length > 0 ? (
                            <span className="tag tag-return">
                              {returnItems.length}项 · {returnItems.reduce((s, i) => s + i.quantity, 0)}件
                            </span>
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          )}
                        </td>
                        <td onClick={() => setSelectedRepair(repair)}>
                          <span className={`status-badge ${getStatusClass(repair.status)}`}>
                            {getStatusText(repair.status)}
                          </span>
                        </td>
                        <td onClick={() => setSelectedRepair(repair)}>
                          {repair.hasDiscrepancy ? (
                            <span className="status-badge status-discrepancy">有差异</span>
                          ) : (
                            <span className="status-badge status-completed">正常</span>
                          )}
                        </td>
                        <td onClick={() => setSelectedRepair(repair)}>
                          {new Date(repair.createdAt).toLocaleDateString('zh-CN')}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setSelectedRepair(repair)}
                          >
                            查看详情
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  上一页
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={currentPage === page ? 'active' : ''}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedRepair && (
        <RepairDetail
          repair={selectedRepair}
          onClose={() => setSelectedRepair(null)}
          onRefresh={fetchRepairs}
          onToast={showToast}
        />
      )}

      {showCreateModal && (
        <CreateRepairModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchRepairs();
            showToast('创建成功', 'success');
          }}
          onToast={showToast}
        />
      )}
    </div>
  );
}

export default RepairList;
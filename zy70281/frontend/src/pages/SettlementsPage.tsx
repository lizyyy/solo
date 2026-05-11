import { useEffect, useState, useCallback } from 'react';
import { settlementApi, courierCompanyApi } from '../api';
import type { Settlement, CourierCompany, SettlementStats, Package } from '../types';

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [companies, setCompanies] = useState<CourierCompany[]>([]);
  const [stats, setStats] = useState<SettlementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    courier_company_id: ''
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [exportPackages, setExportPackages] = useState<Package[]>([]);
  const [formData, setFormData] = useState({
    courier_company_id: '',
    start_date: '',
    end_date: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.status) params.status = filters.status;
      if (filters.courier_company_id) params.courier_company_id = parseInt(filters.courier_company_id);
      
      const [setsRes, companiesRes, statsRes] = await Promise.all([
        settlementApi.getAll(params),
        courierCompanyApi.getAll(),
        settlementApi.getStats()
      ]);
      setSettlements(setsRes.data);
      setCompanies(companiesRes.data);
      setStats(statsRes.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await settlementApi.create({
        courier_company_id: parseInt(formData.courier_company_id),
        start_date: formData.start_date,
        end_date: formData.end_date
      });
      setShowAddModal(false);
      setFormData({ courier_company_id: '', start_date: '', end_date: '' });
      loadData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleConfirm = async (settlement: Settlement) => {
    if (!confirm(`确定确认结算单 #${settlement.id}？确认后不可修改。`)) return;
    try {
      await settlementApi.confirm(settlement.id);
      loadData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleExport = async (settlement: Settlement) => {
    try {
      const res = await settlementApi.export(settlement.id);
      setSelectedSettlement(res.data.settlement);
      setExportPackages(res.data.packages);
      setShowDetailModal(true);
      
      const csvContent = generateCSV(res.data.settlement, res.data.packages);
      downloadCSV(csvContent, `结算单_${settlement.id}_${settlement.courier_company_name}.csv`);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleViewDetail = async (settlement: Settlement) => {
    try {
      const res = await settlementApi.export(settlement.id);
      setSelectedSettlement(res.data.settlement);
      setExportPackages(res.data.packages);
      setShowDetailModal(true);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const generateCSV = (settlement: Settlement, packages: Package[]) => {
    const headers = ['运单号', '快递公司', '收件人', '状态', '扫描时间', '派件费', '退件费', '保管费', '总费用'];
    const rows = packages.map((pkg) => [
      pkg.tracking_number,
      pkg.courier_company_name,
      pkg.recipient_name,
      { pending: '待处理', delivered: '已签收', returned: '已退件' }[pkg.status] || pkg.status,
      pkg.scan_time,
      pkg.delivery_fee.toFixed(2),
      pkg.return_fee.toFixed(2),
      pkg.storage_fee.toFixed(2),
      pkg.total_fee.toFixed(2)
    ]);
    
    const summary = [
      ['结算单汇总'],
      ['快递公司', settlement.courier_company_name],
      ['结算周期', `${settlement.start_date} 至 ${settlement.end_date}`],
      ['状态', { draft: '草稿', confirmed: '已确认' }[settlement.status]],
      ['包裹总数', settlement.total_packages],
      ['待处理', settlement.pending_count],
      ['已签收', settlement.delivered_count],
      ['已退件', settlement.returned_count],
      ['派件费合计', settlement.delivery_fee_total.toFixed(2)],
      ['退件费合计', settlement.return_fee_total.toFixed(2)],
      ['保管费合计', settlement.storage_fee_total.toFixed(2)],
      ['总金额', settlement.total_fee.toFixed(2)],
      [],
      ['包裹明细']
    ];
    
    return [
      ...summary.map(row => row.join(',')),
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'badge-draft',
      confirmed: 'badge-confirmed'
    };
    const labelMap: Record<string, string> = {
      draft: '草稿',
      confirmed: '已确认'
    };
    return <span className={`badge ${map[status] || ''}`}>{labelMap[status] || status}</span>;
  };

  const getPackageStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'badge-pending',
      delivered: 'badge-delivered',
      returned: 'badge-returned'
    };
    const labelMap: Record<string, string> = {
      pending: '待处理',
      delivered: '已签收',
      returned: '已退件'
    };
    return <span className={`badge ${map[status] || ''}`}>{labelMap[status] || status}</span>;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">结算中心</h1>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + 新建结算单
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">结算单总数</div>
          <div className="stat-value">{stats?.total || 0}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-title">待确认</div>
          <div className="stat-value">{stats?.draft || 0}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-title">已确认</div>
          <div className="stat-value">{stats?.confirmed || 0}</div>
        </div>
        <div className="stat-card info">
          <div className="stat-title">已确认金额</div>
          <div className="stat-value">¥{(stats?.total_fee || 0).toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="filter-item">
            <label>状态：</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">全部</option>
              <option value="draft">草稿</option>
              <option value="confirmed">已确认</option>
            </select>
          </div>
          <div className="filter-item">
            <label>快递公司：</label>
            <select
              value={filters.courier_company_id}
              onChange={(e) => setFilters({ ...filters, courier_company_id: e.target.value })}
            >
              <option value="">全部</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="alert alert-danger" style={{ margin: '15px' }}>{error}</div>}

        {settlements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💰</div>
            <div className="empty-state-text">暂无结算单</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>单号</th>
                  <th>快递公司</th>
                  <th>结算周期</th>
                  <th>包裹数</th>
                  <th>派件费</th>
                  <th>退件费</th>
                  <th>保管费</th>
                  <th>总金额</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id}>
                    <td># {s.id}</td>
                    <td>{s.courier_company_name}</td>
                    <td>{s.start_date} ~ {s.end_date}</td>
                    <td>
                      {s.total_packages}
                      <small style={{ color: '#999', marginLeft: '8px' }}>
                        (签{s.delivered_count}/退{s.returned_count}/待{s.pending_count})
                      </small>
                    </td>
                    <td>¥{s.delivery_fee_total.toFixed(2)}</td>
                    <td>¥{s.return_fee_total.toFixed(2)}</td>
                    <td>¥{s.storage_fee_total.toFixed(2)}</td>
                    <td><strong>¥{s.total_fee.toFixed(2)}</strong></td>
                    <td>{getStatusBadge(s.status)}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-secondary" onClick={() => handleViewDetail(s)}>
                          明细
                        </button>
                        <button className="btn btn-sm btn-primary" onClick={() => handleExport(s)}>
                          导出
                        </button>
                        {s.status === 'draft' && (
                          <button className="btn btn-sm btn-success" onClick={() => handleConfirm(s)}>
                            确认
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">新建结算单</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>快递公司 <span className="required">*</span></label>
                  <select
                    value={formData.courier_company_id}
                    onChange={(e) => setFormData({ ...formData, courier_company_id: e.target.value })}
                    required
                  >
                    <option value="">请选择快递公司</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>开始日期 <span className="required">*</span></label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>结束日期 <span className="required">*</span></label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="alert alert-warning">
                  系统将自动汇总该时间段内该快递公司的所有包裹，并根据派件、退件、滞留状态分别计算费用。
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">创建结算单</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedSettlement && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">结算单详情 - #{selectedSettlement.id}</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="detail-row">
                  <span className="detail-label">快递公司</span>
                  <span className="detail-value">{selectedSettlement.courier_company_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">结算周期</span>
                  <span className="detail-value">{selectedSettlement.start_date} 至 {selectedSettlement.end_date}</span>
                </div>
              </div>
              <div className="form-row">
                <div className="detail-row">
                  <span className="detail-label">状态</span>
                  <span className="detail-value">{getStatusBadge(selectedSettlement.status)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">创建时间</span>
                  <span className="detail-value">{new Date(selectedSettlement.created_at).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="fee-breakdown">
                <h4>费用分摊汇总</h4>
                <div className="fee-item">
                  <span>包裹总数</span>
                  <span>{selectedSettlement.total_packages} 件</span>
                </div>
                <div className="fee-item">
                  <span>派件 ({selectedSettlement.delivered_count}件)</span>
                  <span>¥{selectedSettlement.delivery_fee_total.toFixed(2)}</span>
                </div>
                <div className="fee-item">
                  <span>退件 ({selectedSettlement.returned_count}件)</span>
                  <span>¥{selectedSettlement.return_fee_total.toFixed(2)}</span>
                </div>
                <div className="fee-item">
                  <span>保管费 ({selectedSettlement.pending_count}件待处理)</span>
                  <span>¥{selectedSettlement.storage_fee_total.toFixed(2)}</span>
                </div>
                <div className="fee-total">
                  <span>结算总金额</span>
                  <span>¥{selectedSettlement.total_fee.toFixed(2)}</span>
                </div>
              </div>

              <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>包裹明细 ({exportPackages.length}件)</h4>
              {exportPackages.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px' }}>
                  <div className="empty-state-text">该时间段内无包裹</div>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>运单号</th>
                        <th>收件人</th>
                        <th>状态</th>
                        <th>派件费</th>
                        <th>退件费</th>
                        <th>保管费</th>
                        <th>合计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportPackages.map((pkg) => (
                        <tr key={pkg.id}>
                          <td><code>{pkg.tracking_number}</code></td>
                          <td>{pkg.recipient_name}</td>
                          <td>{getPackageStatusBadge(pkg.status)}</td>
                          <td>¥{pkg.delivery_fee.toFixed(2)}</td>
                          <td>¥{pkg.return_fee.toFixed(2)}</td>
                          <td>¥{pkg.storage_fee.toFixed(2)}</td>
                          <td>¥{pkg.total_fee.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => {
                  const csvContent = generateCSV(selectedSettlement, exportPackages);
                  downloadCSV(csvContent, `结算单_${selectedSettlement.id}_${selectedSettlement.courier_company_name}.csv`);
                }}
              >
                导出CSV
              </button>
              {selectedSettlement.status === 'draft' && (
                <button
                  className="btn btn-success"
                  onClick={() => {
                    handleConfirm(selectedSettlement);
                    setShowDetailModal(false);
                  }}
                >
                  确认结算
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => setShowDetailModal(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

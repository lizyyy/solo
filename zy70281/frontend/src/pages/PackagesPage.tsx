import { useEffect, useState, useCallback } from 'react';
import { packageApi, courierCompanyApi } from '../api';
import type { Package, CourierCompany, PackageStats } from '../types';

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [companies, setCompanies] = useState<CourierCompany[]>([]);
  const [stats, setStats] = useState<PackageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    courier_company_id: '',
    keyword: ''
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [formData, setFormData] = useState({
    tracking_number: '',
    courier_company_id: '',
    recipient_name: '',
    recipient_phone: '',
    notes: ''
  });
  const [scanInput, setScanInput] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.status) params.status = filters.status;
      if (filters.courier_company_id) params.courier_company_id = parseInt(filters.courier_company_id);
      if (filters.keyword) params.keyword = filters.keyword;
      
      const [pkgsRes, companiesRes, statsRes] = await Promise.all([
        packageApi.getAll(params),
        courierCompanyApi.getAll(),
        packageApi.getStats()
      ]);
      setPackages(pkgsRes.data);
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

  const handleScan = async () => {
    if (!scanInput.trim()) return;
    try {
      const res = await packageApi.scan(scanInput.trim());
      setSelectedPackage(res.data);
      setShowDetailModal(true);
      setScanInput('');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await packageApi.create({
        tracking_number: formData.tracking_number,
        courier_company_id: parseInt(formData.courier_company_id),
        recipient_name: formData.recipient_name,
        recipient_phone: formData.recipient_phone,
        notes: formData.notes
      });
      setShowAddModal(false);
      resetForm();
      loadData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDeliver = async (pkg: Package) => {
    if (!confirm(`确定签收包裹 ${pkg.tracking_number}？`)) return;
    try {
      await packageApi.deliver(pkg.id);
      if (selectedPackage?.id === pkg.id) {
        const res = await packageApi.getById(pkg.id);
        setSelectedPackage(res.data);
      }
      loadData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleReturn = async (pkg: Package) => {
    if (!confirm(`确定退件包裹 ${pkg.tracking_number}？\n退件将产生退件费和可能的滞留保管费`)) return;
    try {
      const res = await packageApi.return(pkg.id);
      if (selectedPackage?.id === pkg.id) {
        setSelectedPackage(res.data);
      }
      loadData();
      alert('退件成功！费用已计算。');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDelete = async (pkg: Package) => {
    if (!confirm(`确定删除包裹 ${pkg.tracking_number}？`)) return;
    try {
      await packageApi.delete(pkg.id);
      loadData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try {
      const res = await packageApi.import(importFile);
      setImportResult(res.data);
      if (res.data.successCount > 0) {
        loadData();
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const resetForm = () => {
    setFormData({
      tracking_number: '',
      courier_company_id: '',
      recipient_name: '',
      recipient_phone: '',
      notes: ''
    });
  };

  const openDetail = async (pkg: Package) => {
    try {
      const res = await packageApi.getById(pkg.id);
      setSelectedPackage(res.data);
      setShowDetailModal(true);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const getStatusBadge = (status: string) => {
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
        <h1 className="page-title">包裹管理</h1>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
            📥 导入
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + 新增包裹
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">包裹总数</div>
          <div className="stat-value">{stats?.total || 0}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-title">待处理</div>
          <div className="stat-value">{stats?.pending || 0}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-title">已签收</div>
          <div className="stat-value">{stats?.delivered || 0}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-title">已退件</div>
          <div className="stat-value">{stats?.returned || 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="filter-item">
            <label>扫描/搜索：</label>
            <input
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              placeholder="输入运单号扫描或搜索..."
              style={{ minWidth: '250px' }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleScan}>扫描</button>
          </div>
          <div className="filter-item">
            <label>状态：</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">全部</option>
              <option value="pending">待处理</option>
              <option value="delivered">已签收</option>
              <option value="returned">已退件</option>
            </select>
          </div>
          <div className="filter-item">
            <label>公司：</label>
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
          <div className="filter-item">
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              placeholder="运单号/姓名/电话"
            />
          </div>
        </div>

        {error && <div className="alert alert-danger" style={{ margin: '15px' }}>{error}</div>}

        {packages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-text">暂无包裹</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>运单号</th>
                  <th>快递公司</th>
                  <th>收件人</th>
                  <th>状态</th>
                  <th>扫描时间</th>
                  <th>总费用</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td><code>{pkg.tracking_number}</code></td>
                    <td>{pkg.courier_company_name}</td>
                    <td>{pkg.recipient_name} {pkg.recipient_phone && `(${pkg.recipient_phone})`}</td>
                    <td>{getStatusBadge(pkg.status)}</td>
                    <td>{new Date(pkg.scan_time).toLocaleString()}</td>
                    <td>¥{(pkg.total_fee || 0).toFixed(2)}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-secondary" onClick={() => openDetail(pkg)}>
                          详情
                        </button>
                        {pkg.status === 'pending' && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => handleDeliver(pkg)}>
                              签收
                            </button>
                            <button className="btn btn-sm btn-warning" onClick={() => handleReturn(pkg)}>
                              退件
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(pkg)}>
                              删除
                            </button>
                          </>
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
              <h3 className="modal-title">新增包裹</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                <div className="form-group">
                  <label>运单号 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={formData.tracking_number}
                    onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                    required
                    placeholder="如：SF1234567890"
                  />
                </div>
                <div className="form-group">
                  <label>快递公司 <span className="required">*</span></label>
                  <select
                    value={formData.courier_company_id}
                    onChange={(e) => setFormData({ ...formData, courier_company_id: e.target.value })}
                    required
                  >
                    <option value="">请选择快递公司</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} (派件费: ¥{c.delivery_fee}, 退件费: ¥{c.return_fee})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>收件人姓名 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={formData.recipient_name}
                    onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>收件人电话</label>
                  <input
                    type="tel"
                    value={formData.recipient_phone}
                    onChange={(e) => setFormData({ ...formData, recipient_phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>备注</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">创建</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedPackage && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">包裹详情 - {selectedPackage.tracking_number}</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">快递公司</span>
                <span className="detail-value">{selectedPackage.courier_company_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">收件人</span>
                <span className="detail-value">{selectedPackage.recipient_name} {selectedPackage.recipient_phone}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">当前状态</span>
                <span className="detail-value">{getStatusBadge(selectedPackage.status)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">扫描时间</span>
                <span className="detail-value">{new Date(selectedPackage.scan_time).toLocaleString()}</span>
              </div>
              {selectedPackage.delivery_time && (
                <div className="detail-row">
                  <span className="detail-label">签收时间</span>
                  <span className="detail-value">{new Date(selectedPackage.delivery_time).toLocaleString()}</span>
                </div>
              )}
              {selectedPackage.return_time && (
                <div className="detail-row">
                  <span className="detail-label">退件时间</span>
                  <span className="detail-value">{new Date(selectedPackage.return_time).toLocaleString()}</span>
                </div>
              )}
              {selectedPackage.status === 'returned' && (
                <div className="detail-row">
                  <span className="detail-label">滞留天数</span>
                  <span className="detail-value">{selectedPackage.retention_days} 天</span>
                </div>
              )}
              {selectedPackage.notes && (
                <div className="detail-row">
                  <span className="detail-label">备注</span>
                  <span className="detail-value">{selectedPackage.notes}</span>
                </div>
              )}
              
              <div className="fee-breakdown">
                <h4>费用明细</h4>
                <div className="fee-item">
                  <span>派件费</span>
                  <span>¥{selectedPackage.delivery_fee.toFixed(2)}</span>
                </div>
                {selectedPackage.status === 'returned' && (
                  <>
                    <div className="fee-item">
                      <span>退件费</span>
                      <span>¥{selectedPackage.return_fee.toFixed(2)}</span>
                    </div>
                    <div className="fee-item">
                      <span>保管费</span>
                      <span>¥{selectedPackage.storage_fee.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="fee-total">
                  <span>总计</span>
                  <span>¥{(selectedPackage.total_fee || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {selectedPackage.status === 'pending' && (
                <>
                  <button
                    className="btn btn-success"
                    onClick={() => handleDeliver(selectedPackage)}
                  >
                    签收
                  </button>
                  <button
                    className="btn btn-warning"
                    onClick={() => handleReturn(selectedPackage)}
                  >
                    退件
                  </button>
                </>
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

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">批量导入包裹</h3>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                <strong>CSV格式说明：</strong>
                <br />列名（英文或中文均可）：tracking_number/运单号, courier_company_code/快递公司编码, recipient_name/收件人姓名, recipient_phone/收件人电话, notes/备注
                <br />示例：SF123456,SF,张三,13800138000,测试包裹
              </div>
              
              <div
                className={`import-dropzone ${isDragging ? 'dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const files = e.dataTransfer.files;
                  if (files.length > 0) setImportFile(files[0]);
                }}
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <input
                  id="fileInput"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) setImportFile(e.target.files[0]);
                  }}
                />
                {importFile ? (
                  <div>📁 {importFile.name}</div>
                ) : (
                  <div>
                    点击或拖拽CSV文件到此处
                    <br />
                    <small style={{ color: '#999' }}>支持 .csv 格式</small>
                  </div>
                )}
              </div>
              
              {importResult && (
                <div style={{ marginTop: '15px' }}>
                  <div className={`alert ${importResult.successCount > 0 ? 'alert-success' : 'alert-danger'}`}>
                    成功：{importResult.successCount} 条，失败：{importResult.errorCount} 条
                  </div>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div style={{ maxHeight: '150px', overflow: 'auto' }}>
                      {importResult.errors.map((err: any, i: number) => (
                        <div key={i} style={{ color: '#e74c3c', fontSize: '13px' }}>
                          第{err.row}行：{err.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
              >
                关闭
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!importFile}
                onClick={handleImport}
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

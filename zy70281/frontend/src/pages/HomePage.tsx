import { useEffect, useState } from 'react';
import { packageApi, settlementApi, courierCompanyApi } from '../api';
import type { PackageStats, SettlementStats, CourierCompany } from '../types';

export default function HomePage() {
  const [packageStats, setPackageStats] = useState<PackageStats | null>(null);
  const [settlementStats, setSettlementStats] = useState<SettlementStats | null>(null);
  const [companies, setCompanies] = useState<CourierCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [pkgRes, setRes, companiesRes] = await Promise.all([
          packageApi.getStats(),
          settlementApi.getStats(),
          courierCompanyApi.getAll()
        ]);
        setPackageStats(pkgRes.data);
        setSettlementStats(setRes.data);
        setCompanies(companiesRes.data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">数据概览</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card info">
          <div className="stat-title">快递公司数</div>
          <div className="stat-value">{companies.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">包裹总数</div>
          <div className="stat-value">{packageStats?.total || 0}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-title">待处理</div>
          <div className="stat-value">{packageStats?.pending || 0}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-title">已签收</div>
          <div className="stat-value">{packageStats?.delivered || 0}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-title">已退件</div>
          <div className="stat-value">{packageStats?.returned || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">费用总计 (元)</div>
          <div className="stat-value">¥{(packageStats?.total_fee || 0).toFixed(2)}</div>
        </div>
        <div className="stat-card info">
          <div className="stat-title">结算单数</div>
          <div className="stat-value">{settlementStats?.total || 0}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-title">已确认结算 (元)</div>
          <div className="stat-value">¥{(settlementStats?.total_fee || 0).toFixed(2)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h2 className="card-title">费用分摊明细</h2>
        </div>
        <div className="stats-grid" style={{ padding: '20px' }}>
          <div className="stat-card success">
            <div className="stat-title">派件费</div>
            <div className="stat-value">¥{(packageStats?.delivery_fee_total || 0).toFixed(2)}</div>
          </div>
          <div className="stat-card danger">
            <div className="stat-title">退件费</div>
            <div className="stat-value">¥{(packageStats?.return_fee_total || 0).toFixed(2)}</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-title">保管费</div>
            <div className="stat-value">¥{(packageStats?.storage_fee_total || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">快递公司列表</h2>
        </div>
        {companies.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-text">暂无快递公司，请先添加</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>公司名称</th>
                  <th>编码</th>
                  <th>派件费 (元/件)</th>
                  <th>退件费 (元/件)</th>
                  <th>保管费 (元/天)</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td><code>{c.code}</code></td>
                    <td>¥{c.delivery_fee}</td>
                    <td>¥{c.return_fee}</td>
                    <td>¥{c.storage_fee_per_day}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

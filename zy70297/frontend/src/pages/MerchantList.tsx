import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Merchant } from '../types';
import { merchantStatusLabels, merchantStatusColors, formatDate } from '../utils';

export default function MerchantList() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadMerchants();
  }, []);

  async function loadMerchants() {
    try {
      setLoading(true);
      const data = await api.getMerchants();
      setMerchants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredMerchants =
    statusFilter === 'all'
      ? merchants
      : merchants.filter((m) => m.currentStatus === statusFilter);

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ margin: 0 }}>商户档案列表</h2>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
            >
              <option value="all">全部状态</option>
              <option value="normal">正常</option>
              <option value="warning">整改中</option>
              <option value="gas_cut_off">已停气</option>
            </select>
            <button className="btn btn-outline" onClick={loadMerchants}>
              刷新
            </button>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>商户名称</th>
              <th>经营类型</th>
              <th>地址</th>
              <th>联系人</th>
              <th>燃气供应商</th>
              <th>当前状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredMerchants.map((merchant) => (
              <tr key={merchant.id}>
                <td style={{ fontWeight: 500 }}>{merchant.name}</td>
                <td>{merchant.businessType}</td>
                <td>{merchant.address}</td>
                <td>
                  <div>{merchant.contactPerson}</div>
                  <div className="text-sm text-muted">{merchant.contactPhone}</div>
                </td>
                <td>{merchant.gasSupplier}</td>
                <td>
                  <span
                    className="badge"
                    style={{ background: merchantStatusColors[merchant.currentStatus] }}
                  >
                    {merchantStatusLabels[merchant.currentStatus]}
                  </span>
                </td>
                <td>
                  <Link to={`/merchants/${merchant.id}`} className="link">
                    查看档案
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

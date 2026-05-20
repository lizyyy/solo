import React, { useState, useEffect } from 'react';
import { vouchersApi } from '../api';
import { useAppStore } from '../store';

export default function Vouchers() {
  const { showNotification } = useAppStore();
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    patient_id: '',
    status: ''
  });
  const [searchCode, setSearchCode] = useState('');
  const [searchedVoucher, setSearchedVoucher] = useState<any>(null);

  useEffect(() => {
    loadVouchers();
  }, [filters]);

  async function loadVouchers() {
    try {
      setLoading(true);
      const res = await vouchersApi.getVouchers(filters);
      setVouchers(res.data.data?.data || []);
    } catch (error) {
      console.error('加载凭证失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchByCode() {
    if (!searchCode) {
      showNotification('warning', '请输入凭证号');
      return;
    }
    
    try {
      const res = await vouchersApi.getVoucherByCode(searchCode);
      setSearchedVoucher(res.data.data);
    } catch (error: any) {
      showNotification('error', '未找到该凭证');
      setSearchedVoucher(null);
    }
  }

  async function handleCheckIn(voucher: any) {
    if (!window.confirm('确认签到？')) return;
    
    try {
      await vouchersApi.checkIn(voucher.id);
      showNotification('success', '签到成功');
      loadVouchers();
      if (searchedVoucher?.id === voucher.id) {
        setSearchedVoucher(null);
      }
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || '签到失败');
    }
  }

  async function handleCancel(voucher: any) {
    if (!window.confirm('确认取消此预约凭证？')) return;
    
    try {
      await vouchersApi.cancel(voucher.id);
      showNotification('success', '已取消预约');
      loadVouchers();
      if (searchedVoucher?.id === voucher.id) {
        setSearchedVoucher(null);
      }
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || '取消失败');
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>📄 预约凭证</h2>

      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>按凭证号查询</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="输入凭证号"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            style={{ flex: 1, maxWidth: '300px' }}
          />
          <button className="btn btn-primary" onClick={handleSearchByCode}>
            查询
          </button>
        </div>
        
        {searchedVoucher && (
          <div style={{ marginTop: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4>查询结果</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
              <div>
                <small>凭证号</small>
                <div style={{ fontWeight: '500' }}>{searchedVoucher.voucher_code}</div>
              </div>
              <div>
                <small>患者</small>
                <div style={{ fontWeight: '500' }}>{searchedVoucher.patient_name}</div>
              </div>
              <div>
                <small>状态</small>
                <div><span className={`badge badge-${searchedVoucher.status}`}>{searchedVoucher.status}</span></div>
              </div>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              {searchedVoucher.status === 'valid' && (
                <>
                  <button className="btn btn-sm btn-success" onClick={() => handleCheckIn(searchedVoucher)}>
                    签到
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleCancel(searchedVoucher)}>
                    取消
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="filter-bar">
          <input
            type="text"
            placeholder="患者ID"
            value={filters.patient_id}
            onChange={(e) => setFilters({ ...filters, patient_id: e.target.value })}
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">全部状态</option>
            <option value="valid">有效</option>
            <option value="used">已使用</option>
            <option value="cancelled">已取消</option>
          </select>
          <button className="btn btn-secondary" onClick={() => setFilters({ patient_id: '', status: '' })}>
            重置
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>凭证号</th>
                <th>患者</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>签到/取消时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((voucher) => (
                <tr key={voucher.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: '500' }}>
                      {voucher.voucher_code}
                    </span>
                  </td>
                  <td>
                    <div>{voucher.patient_name}</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>{voucher.patient_id}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${voucher.status}`}>
                      {voucher.status === 'valid' ? '有效' : voucher.status === 'used' ? '已使用' : '已取消'}
                    </span>
                  </td>
                  <td>{new Date(voucher.created_at).toLocaleString()}</td>
                  <td>
                    {voucher.check_in_time && new Date(voucher.check_in_time).toLocaleString()}
                    {voucher.cancel_time && new Date(voucher.cancel_time).toLocaleString()}
                    {!voucher.check_in_time && !voucher.cancel_time && '-'}
                  </td>
                  <td>
                    {voucher.status === 'valid' && (
                      <>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleCheckIn(voucher)}
                          style={{ marginRight: '8px' }}
                        >
                          签到
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleCancel(voucher)}
                        >
                          取消
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {vouchers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                    暂无预约凭证
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

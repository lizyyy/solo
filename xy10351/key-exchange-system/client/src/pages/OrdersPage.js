import React, { useState, useEffect } from 'react';
import { orderApi } from '../services/api';
import moment from 'moment';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await orderApi.getAll();
      setOrders(res.data);
    } catch (error) {
      console.error('加载订单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status) => {
    const map = {
      pending: '待处理',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
    };
    return map[status] || status;
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: 'badge-warning',
      in_progress: 'badge-primary',
      completed: 'badge-success',
      cancelled: 'badge-danger',
    };
    return map[status] || 'badge-primary';
  };

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch = search === '' || 
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.customerName.toLowerCase().includes(search.toLowerCase()) ||
      order.cleanerName.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">订单管理</h2>
          <button className="btn btn-primary btn-sm" onClick={loadOrders}>
            🔄 刷新
          </button>
        </div>

        <div className="filter-bar">
          <input
            type="text"
            className="search-input"
            placeholder="搜索订单号、客户名或保洁员..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="select-dropdown"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">全部状态</option>
            <option value="pending">待处理</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>订单号</th>
              <th>客户</th>
              <th>服务类型</th>
              <th>保洁员</th>
              <th>预约时间</th>
              <th>关联钥匙</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id}>
                <td><strong>{order.orderNumber}</strong></td>
                <td>{order.customerName}</td>
                <td>{order.serviceType}</td>
                <td>{order.cleanerName}</td>
                <td>{moment(order.scheduledDate).format('YYYY-MM-DD HH:mm')}</td>
                <td>
                  {order.Key ? (
                    <span className="badge badge-primary">
                      {order.Key.keyCode} ({order.Key.cabinetNumber})
                    </span>
                  ) : (
                    <span className="text-muted">未关联</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${getStatusBadge(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredOrders.length === 0 && (
          <div className="text-center text-muted py-5">
            没有找到匹配的订单
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📋 使用说明</h3>
        </div>
        <div style={{ lineHeight: '1.8' }}>
          <p><strong>正常服务流程：</strong></p>
          <ol>
            <li>保洁员登录后，在"钥匙管理"找到对应的客户钥匙</li>
            <li>点击"领取"按钮，选择自己负责的订单</li>
            <li>完成保洁服务后，回到钥匙柜点击"归还"</li>
            <li>系统自动记录交接时间和操作人</li>
          </ol>
          
          <p><strong>临时借用：</strong></p>
          <p>管理员或主管可以不关联订单直接领取钥匙（临时借用），需要设置预计归还时间。</p>
          
          <p><strong>逾期处理：</strong></p>
          <p>超过预计归还时间的钥匙会显示"逾期"状态，归还时必须填写备注说明原因。</p>
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;

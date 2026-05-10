import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Order, Customer, Nanny } from '../types';

const statusLabels: Record<string, string> = {
  pending: '待开始',
  in_service: '服务中',
  completed: '已完成',
  cancelled: '已取消',
};

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [nannies, setNannies] = useState<Nanny[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    customerId: '',
    nannyId: '',
    startDate: '',
    endDate: '',
    deposit: 0,
  });
  const [availableNannies, setAvailableNannies] = useState<Nanny[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [ordersRes, customersRes, nanniesRes] = await Promise.all([
        api.orders.getAll(),
        api.customers.getAll(),
        api.nannies.getAll(),
      ]);
      setOrders(ordersRes.data);
      setCustomers(customersRes.data);
      setNannies(nanniesRes.data);
    } catch (error) {
      console.error('加载订单数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (newOrder.startDate && newOrder.endDate) {
      loadAvailableNannies();
    }
  }, [newOrder.startDate, newOrder.endDate]);

  async function loadAvailableNannies() {
    try {
      const res = await api.nannies.getAvailable(newOrder.startDate, newOrder.endDate);
      setAvailableNannies(res.data);
    } catch (error) {
      console.error('加载可用月嫂失败:', error);
    }
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.orders.create({
        customerId: parseInt(newOrder.customerId),
        nannyId: parseInt(newOrder.nannyId),
        startDate: newOrder.startDate,
        endDate: newOrder.endDate,
        deposit: newOrder.deposit,
      });
      setShowCreateModal(false);
      setNewOrder({ customerId: '', nannyId: '', startDate: '', endDate: '', deposit: 0 });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || '创建订单失败');
    }
  }

  const getCustomerName = (id: number) => {
    const customer = customers.find(c => c.id === id);
    return customer ? customer.name : `客户${id}`;
  };

  const getNannyName = (id: number) => {
    const nanny = nannies.find(n => n.id === id);
    return nanny ? nanny.name : `月嫂${id}`;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>订单管理</h1>
        <p>管理所有月嫂服务订单</p>
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + 新建订单
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>订单编号</th>
              <th>客户</th>
              <th>月嫂</th>
              <th>开始日期</th>
              <th>结束日期</th>
              <th>总金额</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td>{order.orderNo}</td>
                <td>{getCustomerName(order.customerId)}</td>
                <td>{getNannyName(order.nannyId)}</td>
                <td>{order.startDate}</td>
                <td>{order.endDate}</td>
                <td>¥{order.totalAmount.toFixed(0)}</td>
                <td>
                  <span className={`badge badge-${order.status}`}>
                    {statusLabels[order.status]}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>新建订单</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateOrder}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>客户</label>
                    <select
                      value={newOrder.customerId}
                      onChange={e => setNewOrder({ ...newOrder, customerId: e.target.value })}
                      required
                    >
                      <option value="">请选择客户</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>定金(元)</label>
                    <input
                      type="number"
                      value={newOrder.deposit}
                      onChange={e => setNewOrder({ ...newOrder, deposit: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>开始日期</label>
                    <input
                      type="date"
                      value={newOrder.startDate}
                      onChange={e => setNewOrder({ ...newOrder, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>结束日期</label>
                    <input
                      type="date"
                      value={newOrder.endDate}
                      onChange={e => setNewOrder({ ...newOrder, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>月嫂</label>
                  <select
                    value={newOrder.nannyId}
                    onChange={e => setNewOrder({ ...newOrder, nannyId: e.target.value })}
                    required
                  >
                    <option value="">请选择月嫂</option>
                    {availableNannies.length > 0 ? (
                      availableNannies.map(n => (
                        <option key={n.id} value={n.id}>
                          {n.name} - {n.level} (¥{n.dailyRate}/天)
                        </option>
                      ))
                    ) : (
                      nannies.map(n => (
                        <option key={n.id} value={n.id}>
                          {n.name} - {n.level} (¥{n.dailyRate}/天)
                        </option>
                      ))
                    )}
                  </select>
                  {newOrder.startDate && newOrder.endDate && availableNannies.length > 0 && (
                    <small style={{ color: '#27ae60', fontSize: '12px' }}>
                      共 {availableNannies.length} 位月嫂可用
                    </small>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowCreateModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">创建订单</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const { useState, useEffect } = React;

const API_BASE = 'http://localhost:3001/api';

const STATUS_LABELS = {
  active: '租赁中',
  returned: '已归还',
  closed: '已结清'
};

const TX_TYPE_LABELS = {
  freeze: '押金冻结',
  additional_freeze: '追加冻结',
  deduction: '扣款',
  refund: '退还押金'
};

const ITEM_TYPES = {
  camera: '相机',
  projector: '投影仪',
  drone: '无人机'
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatMoney(amount) {
  return '¥' + Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function apiCall(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || '操作失败');
  }
  return data.data;
}

function Header({ activeTab, setActiveTab, pendingCount }) {
  const tabs = [
    { id: 'orders', label: '订单列表' },
    { id: 'pending', label: '待审核', count: pendingCount },
    { id: 'transactions', label: '资金流水' },
    { id: 'report', label: '余额表' }
  ];

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">租赁押金冻结台</h1>
          <nav className="flex space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-2 bg-yellow-400 text-yellow-900 text-xs px-2 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

function OrderCard({ order, onViewDetail }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">{order.order_no}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full status-${order.status}`}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <h3 className="font-semibold text-gray-800 mt-1">{order.customer_name}</h3>
          <p className="text-sm text-gray-600">{ITEM_TYPES[order.item_type]} - {order.item_name}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-blue-600">{formatMoney(order.current_balance)}</div>
          <div className="text-xs text-gray-500">当前余额</div>
        </div>
      </div>
      <div className="flex justify-between items-center text-sm text-gray-600 border-t pt-3">
        <div>
          <span>起租: {formatDate(order.start_date)}</span>
          <span className="mx-2">→</span>
          <span>应还: {formatDate(order.expected_return_date)}</span>
        </div>
        <button
          onClick={() => onViewDetail(order.id)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          查看详情 →
        </button>
      </div>
    </div>
  );
}

function OrderList({ onViewDetail, onCreateOrder, onSeedData }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState({ status: '', item_type: '', keyword: '' });
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.item_type) params.append('item_type', filter.item_type);
      if (filter.keyword) params.append('keyword', filter.keyword);
      const data = await apiCall(`/orders?${params.toString()}`);
      setOrders(data);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [filter]);

  return (
    <div>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
            <input
              type="text"
              placeholder="订单号/客户名/设备名"
              value={filter.keyword}
              onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="active">租赁中</option>
              <option value="returned">已归还</option>
              <option value="closed">已结清</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">设备类型</label>
            <select
              value={filter.item_type}
              onChange={(e) => setFilter({ ...filter, item_type: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="camera">相机</option>
              <option value="projector">投影仪</option>
              <option value="drone">无人机</option>
            </select>
          </div>
          <button
            onClick={onCreateOrder}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 新建订单
          </button>
          <button
            onClick={onSeedData}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            生成样例数据
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
          暂无订单数据
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map(order => (
            <OrderCard key={order.id} order={order} onViewDetail={onViewDetail} />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateOrderModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    item_type: 'camera',
    item_name: '',
    deposit_amount: '',
    rent_amount: '',
    rent_unit: 'day',
    start_date: new Date().toISOString().split('T')[0],
    expected_return_date: '',
    remark: ''
  });

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await apiCall('/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          deposit_amount: Number(formData.deposit_amount),
          rent_amount: Number(formData.rent_amount)
        })
      });
      alert('订单创建成功');
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">创建租赁订单</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">客户姓名 *</label>
              <input
                type="text"
                required
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
              <input
                type="tel"
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">设备类型 *</label>
              <select
                required
                value={formData.item_type}
                onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="camera">相机</option>
                <option value="projector">投影仪</option>
                <option value="drone">无人机</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">设备名称 *</label>
              <input
                type="text"
                required
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">押金金额 (¥) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.deposit_amount}
                onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">租金金额 (¥) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.rent_amount}
                onChange={(e) => setFormData({ ...formData, rent_amount: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">租金单位</label>
              <select
                value={formData.rent_unit}
                onChange={(e) => setFormData({ ...formData, rent_unit: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="day">天</option>
                <option value="week">周</option>
                <option value="month">月</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">起租日期 *</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">预计归还日期 *</label>
              <input
                type="date"
                required
                value={formData.expected_return_date}
                onChange={(e) => setFormData({ ...formData, expected_return_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              rows="3"
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              创建订单并冻结押金
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OrderDetail({ orderId, onBack }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('transactions');

  async function loadOrder() {
    setLoading(true);
    try {
      const data = await apiCall(`/orders/${orderId}`);
      setOrder(data);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  async function handleRenewal() {
    const days = prompt('请输入续租天数:', '1');
    if (!days) return;
    const rent = prompt('请输入追加租金金额 (¥):', order.rent_amount * Number(days));
    if (!rent) return;
    try {
      await apiCall(`/orders/${orderId}/renew`, {
        method: 'POST',
        body: JSON.stringify({
          additional_days: Number(days),
          additional_rent: Number(rent),
          operator: '当前操作员'
        })
      });
      alert('续租成功');
      loadOrder();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleReturn() {
    if (!confirm('确认标记该订单为已归还？')) return;
    try {
      await apiCall(`/orders/${orderId}/return`, { method: 'POST' });
      alert('已标记为归还');
      loadOrder();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleInspection() {
    const status = prompt('检查状态 (good/damaged):', 'good');
    if (!status) return;
    const report = prompt('检查报告:', '设备完好');
    const cost = prompt('预估费用 (¥):', '0');
    try {
      await apiCall(`/orders/${orderId}/inspect`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          damage_report: report,
          estimated_cost: Number(cost),
          operator: '当前操作员'
        })
      });
      alert('检查记录已保存');
      loadOrder();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleDeduction() {
    const amount = prompt('请输入扣款金额 (¥):', order.current_balance > 0 ? Math.min(500, order.current_balance) : '0');
    if (!amount) return;
    const reason = prompt('扣款原因:', '设备损坏赔偿');
    try {
      await apiCall(`/orders/${orderId}/deduction`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          reason,
          operator: '当前操作员'
        })
      });
      alert('扣款申请已提交，等待审核');
      loadOrder();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleRefund() {
    const amount = prompt(`请输入退押金额 (可用余额: ${formatMoney(order.current_balance)}):`, order.current_balance);
    if (!amount) return;
    try {
      await apiCall(`/orders/${orderId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount) })
      });
      alert('退押申请已提交，等待审核');
      loadOrder();
    } catch (error) {
      alert(error.message);
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  if (!order) {
    return <div className="text-center py-8">订单不存在</div>;
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-blue-600 hover:text-blue-800">
        ← 返回订单列表
      </button>
      
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold text-gray-800">{order.order_no}</h2>
              <span className={`px-3 py-1 text-sm rounded-full status-${order.status}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <p className="text-gray-600 mt-1">客户: {order.customer_name} {order.customer_phone || ''}</p>
            <p className="text-gray-600">{ITEM_TYPES[order.item_type]} - {order.item_name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{formatMoney(order.current_balance)}</div>
            <div className="text-sm text-gray-500">当前可用余额</div>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div>
            <div className="text-sm text-gray-500">押金金额</div>
            <div className="font-semibold">{formatMoney(order.deposit_amount)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">租金</div>
            <div className="font-semibold">{formatMoney(order.rent_amount)}/{order.rent_unit === 'day' ? '天' : order.rent_unit === 'week' ? '周' : '月'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">起租日期</div>
            <div className="font-semibold">{formatDate(order.start_date)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">预计归还</div>
            <div className="font-semibold">{formatDate(order.expected_return_date)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          {order.status === 'active' && (
            <>
              <button
                onClick={handleRenewal}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                续租
              </button>
              <button
                onClick={handleReturn}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                标记归还
              </button>
            </>
          )}
          {order.status === 'returned' && (
            <>
              <button
                onClick={handleInspection}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                登记归还检查
              </button>
              <button
                onClick={handleDeduction}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                发起扣款
              </button>
              <button
                onClick={handleRefund}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                申请退押
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="flex border-b">
          {['transactions', 'inspections', 'deductions', 'refunds', 'renewals'].map(section => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-3 font-medium ${
                activeSection === section
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {section === 'transactions' ? '资金流水' :
               section === 'inspections' ? '检查记录' :
               section === 'deductions' ? '扣款记录' :
               section === 'refunds' ? '退押记录' : '续租记录'}
            </button>
          ))}
        </div>
        
        <div className="p-6">
          {activeSection === 'transactions' && (
            <div className="space-y-3">
              {order.transactions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无流水记录</p>
              ) : (
                order.transactions.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className={`px-2 py-0.5 text-xs rounded-full tx-${tx.tx_type}`}>
                        {TX_TYPE_LABELS[tx.tx_type]}
                      </span>
                      <span className="ml-2 text-gray-800">{tx.description}</span>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDateTime(tx.created_at)} · 操作员: {tx.operator || '-'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${
                        tx.tx_type === 'freeze' || tx.tx_type === 'additional_freeze' 
                          ? 'text-blue-600' 
                          : 'text-red-600'
                      }`}>
                        {tx.tx_type === 'freeze' || tx.tx_type === 'additional_freeze' ? '+' : '-'}
                        {formatMoney(tx.amount)}
                      </div>
                      <div className="text-sm text-gray-500">余额: {formatMoney(tx.balance)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === 'inspections' && (
            <div className="space-y-3">
              {order.inspections.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无检查记录</p>
              ) : (
                order.inspections.map(ins => (
                  <div key={ins.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          ins.status === 'good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {ins.status === 'good' ? '完好' : '损坏'}
                        </span>
                        <p className="mt-2 text-gray-700">{ins.damage_report}</p>
                      </div>
                      {ins.estimated_cost > 0 && (
                        <div className="text-red-600 font-semibold">预估费用: {formatMoney(ins.estimated_cost)}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-3">
                      {formatDateTime(ins.created_at)} · 检查员: {ins.operator || '-'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === 'deductions' && (
            <div className="space-y-3">
              {order.deductions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无扣款记录</p>
              ) : (
                order.deductions.map(ded => (
                  <div key={ded.id} className={`p-4 rounded-lg border ${
                    ded.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
                    ded.status === 'approved' ? 'bg-green-50 border-green-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          ded.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                          ded.status === 'approved' ? 'bg-green-200 text-green-800' :
                          'bg-red-200 text-red-800'
                        }`}>
                          {ded.status === 'pending' ? '待审核' : ded.status === 'approved' ? '已通过' : '已拒绝'}
                        </span>
                        <p className="mt-2 text-gray-700">{ded.reason}</p>
                      </div>
                      <div className="text-red-600 font-semibold">-{formatMoney(ded.amount)}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-3">
                      申请时间: {formatDateTime(ded.created_at)}
                      {ded.approved_at && ` · 审核时间: ${formatDateTime(ded.approved_at)} · 审核人: ${ded.approved_by}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === 'refunds' && (
            <div className="space-y-3">
              {order.refunds.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无退押记录</p>
              ) : (
                order.refunds.map(ref => (
                  <div key={ref.id} className={`p-4 rounded-lg border ${
                    ref.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
                    ref.status === 'approved' ? 'bg-green-50 border-green-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          ref.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                          ref.status === 'approved' ? 'bg-green-200 text-green-800' :
                          'bg-red-200 text-red-800'
                        }`}>
                          {ref.status === 'pending' ? '待审核' : ref.status === 'approved' ? '已通过' : '已拒绝'}
                        </span>
                        {ref.reject_reason && (
                          <p className="mt-2 text-red-600">拒绝原因: {ref.reject_reason}</p>
                        )}
                      </div>
                      <div className="text-green-600 font-semibold">{formatMoney(ref.amount)}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-3">
                      申请时间: {formatDateTime(ref.created_at)}
                      {ref.approved_at && ` · 审核时间: ${formatDateTime(ref.approved_at)} · 审核人: ${ref.approved_by}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === 'renewals' && (
            <div className="space-y-3">
              {order.renewals.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无续租记录</p>
              ) : (
                order.renewals.map(ren => (
                  <div key={ren.id} className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-gray-800">续租 {ren.additional_days} 天</span>
                        <p className="text-sm text-gray-600 mt-1">
                          新预计归还日期: {formatDate(ren.new_expected_return_date)}
                        </p>
                      </div>
                      <div className="text-blue-600 font-semibold">+{formatMoney(ren.additional_rent)}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-3">
                      续租时间: {formatDateTime(ren.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PendingApprovals({ onRefresh }) {
  const [approvals, setApprovals] = useState({ deductions: [], refunds: [] });
  const [loading, setLoading] = useState(true);

  async function loadApprovals() {
    setLoading(true);
    try {
      const data = await apiCall('/approvals/pending');
      setApprovals(data);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals();
  }, []);

  async function handleApproveDeduction(id) {
    if (!confirm('确认通过该扣款申请？')) return;
    try {
      await apiCall(`/deductions/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approved_by: '当前操作员' })
      });
      alert('扣款已通过');
      loadApprovals();
      onRefresh();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleApproveRefund(id) {
    if (!confirm('确认通过该退押申请？')) return;
    try {
      await apiCall(`/refunds/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approved_by: '当前操作员' })
      });
      alert('退押已通过');
      loadApprovals();
      onRefresh();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleRejectRefund(id) {
    const reason = prompt('请输入拒绝原因:');
    if (!reason) return;
    try {
      await apiCall(`/refunds/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reject_reason: reason,
          rejected_by: '当前操作员'
        })
      });
      alert('退押已拒绝');
      loadApprovals();
      onRefresh();
    } catch (error) {
      alert(error.message);
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  const hasItems = approvals.deductions.length > 0 || approvals.refunds.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">待审核扣款 ({approvals.deductions.length})</h3>
        {approvals.deductions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
            暂无待审核扣款
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.deductions.map(ded => (
              <div key={ded.id} className="bg-white rounded-lg shadow-sm p-4 pending-approval">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-800">{ded.order_no}</div>
                    <div className="text-sm text-gray-600">{ded.customer_name} - {ded.item_name}</div>
                    <div className="text-sm text-red-600 mt-1">{ded.reason}</div>
                    <div className="text-xs text-gray-500 mt-1">申请时间: {formatDateTime(ded.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-red-600">-{formatMoney(ded.amount)}</div>
                    <button
                      onClick={() => handleApproveDeduction(ded.id)}
                      className="mt-2 px-4 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      通过
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">待审核退押 ({approvals.refunds.length})</h3>
        {approvals.refunds.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
            暂无待审核退押
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.refunds.map(ref => (
              <div key={ref.id} className="bg-white rounded-lg shadow-sm p-4 pending-approval">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-800">{ref.order_no}</div>
                    <div className="text-sm text-gray-600">{ref.customer_name} - {ref.item_name}</div>
                    <div className="text-xs text-gray-500 mt-1">申请时间: {formatDateTime(ref.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-600">{formatMoney(ref.amount)}</div>
                    <div className="mt-2 space-x-2">
                      <button
                        onClick={() => handleApproveRefund(ref.id)}
                        className="px-4 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleRejectRefund(ref.id)}
                        className="px-4 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!hasItems && (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-gray-600">暂无待审核事项</div>
        </div>
      )}
    </div>
  );
}

function TransactionsList() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiCall('/transactions');
        setTransactions(data);
      } catch (error) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">时间</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">订单号</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">客户</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">类型</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">描述</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">金额</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">余额</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {transactions.map(tx => (
            <tr key={tx.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(tx.created_at)}</td>
              <td className="px-4 py-3 text-sm font-medium text-gray-800">{tx.order_no}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{tx.customer_name}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 text-xs rounded-full tx-${tx.tx_type}`}>
                  {TX_TYPE_LABELS[tx.tx_type]}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{tx.description}</td>
              <td className={`px-4 py-3 text-sm font-medium text-right ${
                tx.tx_type === 'freeze' || tx.tx_type === 'additional_freeze' ? 'text-blue-600' : 'text-red-600'
              }`}>
                {tx.tx_type === 'freeze' || tx.tx_type === 'additional_freeze' ? '+' : '-'}
                {formatMoney(tx.amount)}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-right text-gray-800">
                {formatMoney(tx.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceReport() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiCall('/reports/balance');
        setReport(data);
      } catch (error) {
        alert(error.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function exportCSV() {
    const headers = ['订单号', '客户', '设备类型', '设备名称', '状态', 
      '冻结总额', '扣款总额', '退还总额', '当前余额', 
      '起租日期', '预计归还', '实际归还'];
    const rows = report.map(r => [
      r.order_no, r.customer_name, ITEM_TYPES[r.item_type], r.item_name, STATUS_LABELS[r.status],
      r.total_freeze, r.total_deduction, r.total_refund, r.current_balance,
      r.start_date, r.expected_return_date, r.actual_return_date || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `押金余额表_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = report.reduce((acc, r) => ({
    freeze: acc.freeze + r.total_freeze,
    deduction: acc.deduction + r.total_deduction,
    refund: acc.refund + r.total_refund,
    balance: acc.balance + r.current_balance
  }), { freeze: 0, deduction: 0, refund: 0, balance: 0 });

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">押金余额表</h3>
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          导出 CSV
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-700">冻结总额</div>
          <div className="text-xl font-bold text-blue-800">{formatMoney(totals.freeze)}</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-sm text-red-700">扣款总额</div>
          <div className="text-xl font-bold text-red-800">{formatMoney(totals.deduction)}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-700">退还总额</div>
          <div className="text-xl font-bold text-green-800">{formatMoney(totals.refund)}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-purple-700">当前总余额</div>
          <div className="text-xl font-bold text-purple-800">{formatMoney(totals.balance)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">订单号</th>
              <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">客户</th>
              <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">设备</th>
              <th className="px-3 py-3 text-left text-sm font-medium text-gray-700">状态</th>
              <th className="px-3 py-3 text-right text-sm font-medium text-gray-700">冻结</th>
              <th className="px-3 py-3 text-right text-sm font-medium text-gray-700">扣款</th>
              <th className="px-3 py-3 text-right text-sm font-medium text-gray-700">退还</th>
              <th className="px-3 py-3 text-right text-sm font-medium text-gray-700">余额</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {report.map(r => (
              <tr key={r.order_no} className="hover:bg-gray-50">
                <td className="px-3 py-3 text-sm font-medium text-gray-800">{r.order_no}</td>
                <td className="px-3 py-3 text-sm text-gray-600">{r.customer_name}</td>
                <td className="px-3 py-3 text-sm text-gray-600">{ITEM_TYPES[r.item_type]}</td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full status-${r.status}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm text-right text-blue-600">{formatMoney(r.total_freeze)}</td>
                <td className="px-3 py-3 text-sm text-right text-red-600">{formatMoney(r.total_deduction)}</td>
                <td className="px-3 py-3 text-sm text-right text-green-600">{formatMoney(r.total_refund)}</td>
                <td className="px-3 py-3 text-sm font-medium text-right text-purple-600">{formatMoney(r.current_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('orders');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  async function loadPendingCount() {
    try {
      const data = await apiCall('/approvals/pending');
      setPendingCount(data.deductions.length + data.refunds.length);
    } catch (error) {
      console.error('Failed to load pending count:', error);
    }
  }

  useEffect(() => {
    loadPendingCount();
  }, [activeTab, refreshKey]);

  async function handleSeedData() {
    if (!confirm('确认生成样例数据？这将创建4个示例订单（包括正常归还、损坏扣款、逾期续租等场景）')) return;
    try {
      await apiCall('/seed', { method: 'POST' });
      alert('样例数据生成成功');
      setRefreshKey(k => k + 1);
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header 
        activeTab={activeTab} 
        setActiveTab={(tab) => { 
          setActiveTab(tab); 
          setSelectedOrderId(null); 
        }} 
        pendingCount={pendingCount}
      />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'orders' && (
          selectedOrderId ? (
            <OrderDetail 
              orderId={selectedOrderId} 
              onBack={() => setSelectedOrderId(null)} 
            />
          ) : (
            <OrderList 
              onViewDetail={setSelectedOrderId}
              onCreateOrder={() => setShowCreateModal(true)}
              onSeedData={handleSeedData}
            />
          )
        )}
        
        {activeTab === 'pending' && (
          <PendingApprovals onRefresh={() => setRefreshKey(k => k + 1)} />
        )}
        
        {activeTab === 'transactions' && <TransactionsList />}
        
        {activeTab === 'report' && <BalanceReport />}
      </main>

      {showCreateModal && (
        <CreateOrderModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

import React, { useState, useEffect } from 'react';
import { damageReportsApi, roomOrdersApi, linenTypesApi, staffApi } from '../api';
import { Plus, CheckCircle, XCircle, AlertTriangle, Shield } from 'lucide-react';

function DamageReports() {
  const [reports, setReports] = useState([]);
  const [orders, setOrders] = useState([]);
  const [linenTypes, setLinenTypes] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    room_order_id: '',
    linen_type_id: '',
    reported_by_staff_id: '',
    damage_level: 'minor',
    description: '',
    quantity: 1
  });

  useEffect(() => {
    loadReports();
    loadOrders();
    loadLinenTypes();
    loadStaff();
  }, []);

  const loadReports = async () => {
    try {
      const res = await damageReportsApi.getAll();
      setReports(res.data);
    } catch (err) {
      console.error('加载报损失败', err);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await roomOrdersApi.getAll();
      setOrders(res.data.filter(o => o.status === 'open'));
    } catch (err) {
      console.error('加载房单失败', err);
    }
  };

  const loadLinenTypes = async () => {
    try {
      const res = await linenTypesApi.getAll();
      setLinenTypes(res.data);
    } catch (err) {
      console.error('加载布草类型失败', err);
    }
  };

  const loadStaff = async () => {
    try {
      const res = await staffApi.getAll();
      setStaff(res.data);
    } catch (err) {
      console.error('加载员工失败', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await damageReportsApi.create(formData);
      alert(res.data.message || '登记成功');
      setShowModal(false);
      setFormData({
        room_order_id: '',
        linen_type_id: '',
        reported_by_staff_id: '',
        damage_level: 'minor',
        description: '',
        quantity: 1
      });
      loadReports();
    } catch (err) {
      alert(err.response?.data?.error || '登记失败');
    }
  };

  const handleConfirm = async (report) => {
    if (!confirm(`确认报损: ${report.linen_name} × ${report.quantity}？确认后将调整库存并生成赔付单。`)) {
      return;
    }
    try {
      const res = await damageReportsApi.confirm(report.id, {});
      alert(res.data.message);
      loadReports();
    } catch (err) {
      alert(err.response?.data?.error || '确认失败');
    }
  };

  const handleCancel = async (report) => {
    if (!confirm('确定取消该报损记录？')) {
      return;
    }
    try {
      await damageReportsApi.cancel(report.id);
      loadReports();
    } catch (err) {
      alert(err.response?.data?.error || '取消失败');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'reported': return 'bg-blue-100 text-blue-700';
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-gray-100 text-gray-600';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'reported': return '已上报';
      case 'confirmed': return '已确认';
      case 'cancelled': return '已取消';
      default: return status;
    }
  };

  const getDamageLevelText = (level) => {
    switch (level) {
      case 'minor': return '轻微';
      case 'moderate': return '中度';
      case 'severe': return '严重';
      default: return level;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">报损登记</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          新增报损
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">房号</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">客人</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">布草类型</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">数量</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">损坏程度</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">报告人</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">防重复</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">赔付</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{report.room_number}</td>
                <td className="px-4 py-3 text-gray-600">{report.guest_name}</td>
                <td className="px-4 py-3 text-gray-600">{report.linen_name}</td>
                <td className="px-4 py-3 text-gray-600">{report.quantity} {report.unit}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    report.damage_level === 'severe' ? 'bg-red-100 text-red-700' :
                    report.damage_level === 'moderate' ? 'bg-orange-100 text-orange-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {getDamageLevelText(report.damage_level)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">{report.reporter_name || '-'}</td>
                <td className="px-4 py-3">
                  {report.is_repeat_check === 'yes' && (
                    <Shield size={16} className="text-green-500" title="已检查重复" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(report.status)}`}>
                    {getStatusText(report.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {report.compensation_id ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      report.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {report.payment_status === 'paid' ? '已赔付' : '待赔付'}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {report.status === 'reported' && (
                      <>
                        <button
                          onClick={() => handleConfirm(report)}
                          className="text-green-600 hover:text-green-800 p-1"
                          title="确认报损"
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button
                          onClick={() => handleCancel(report)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="取消报损"
                        >
                          <XCircle size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {reports.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <AlertTriangle size={48} className="mx-auto mb-3 text-gray-300" />
            <p>暂无报损记录</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">新增报损登记</h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">选择房单</label>
                  <select
                    value={formData.room_order_id}
                    onChange={(e) => setFormData({ ...formData, room_order_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">请选择在住房单</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.room_number} - {order.guest_name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">系统自动防止同一件布草重复报损</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">布草类型</label>
                  <select
                    value={formData.linen_type_id}
                    onChange={(e) => setFormData({ ...formData, linen_type_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">请选择布草类型</option>
                    {linenTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} (单价: ¥{type.price})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">损坏程度</label>
                  <select
                    value={formData.damage_level}
                    onChange={(e) => setFormData({ ...formData, damage_level: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="minor">轻微</option>
                    <option value="moderate">中度</option>
                    <option value="severe">严重</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">报告人</label>
                  <select
                    value={formData.reported_by_staff_id}
                    onChange={(e) => setFormData({ ...formData, reported_by_staff_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择报告人</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} - {s.role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">损坏描述</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="描述损坏情况..."
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  确认登记
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DamageReports;

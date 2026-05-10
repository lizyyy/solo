import React, { useState, useEffect } from 'react';
import { cleanInspectionsApi, roomOrdersApi, staffApi } from '../api';
import { Plus, CheckSquare } from 'lucide-react';

function CleanInspections() {
  const [inspections, setInspections] = useState([]);
  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    room_order_id: '',
    staff_id: '',
    status: 'completed',
    notes: ''
  });

  useEffect(() => {
    loadInspections();
    loadOrders();
    loadStaff();
  }, []);

  const loadInspections = async () => {
    try {
      const res = await cleanInspectionsApi.getAll();
      setInspections(res.data);
    } catch (err) {
      console.error('加载检查记录失败', err);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await roomOrdersApi.getAll();
      setOrders(res.data);
    } catch (err) {
      console.error('加载房单失败', err);
    }
  };

  const loadStaff = async () => {
    try {
      const res = await staffApi.getAll();
      setStaff(res.data.filter(s => s.role === '清洁员'));
    } catch (err) {
      console.error('加载员工失败', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await cleanInspectionsApi.create(formData);
      setShowModal(false);
      setFormData({ room_order_id: '', staff_id: '', status: 'completed', notes: '' });
      loadInspections();
    } catch (err) {
      alert(err.response?.data?.error || '创建失败');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return '清洁完成';
      case 'pending': return '待检查';
      case 'failed': return '需复核';
      default: return status;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">清洁检查</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          添加检查记录
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">房号</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">客人</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">检查员</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">检查时间</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">备注</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inspections.map((ins) => (
              <tr key={ins.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{ins.room_number}</td>
                <td className="px-4 py-3 text-gray-600">{ins.guest_name || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{ins.inspector_name || '-'}</td>
                <td className="px-4 py-3 text-gray-600 text-sm">{ins.inspection_time}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(ins.status)}`}>
                    {getStatusText(ins.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate">{ins.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {inspections.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <CheckSquare size={48} className="mx-auto mb-3 text-gray-300" />
            <p>暂无清洁检查记录</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">添加清洁检查</h3>
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
                    <option value="">请选择房单</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.room_number} - {order.guest_name || '未登记'} ({order.status === 'open' ? '在住' : '已退房'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">清洁员</label>
                  <select
                    value={formData.staff_id}
                    onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">请选择清洁员</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">检查结果</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="completed">清洁完成</option>
                    <option value="pending">待检查</option>
                    <option value="failed">需复核</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="发现问题或注意事项..."
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
                  确认提交
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CleanInspections;

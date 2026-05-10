import React, { useState, useEffect } from 'react';
import { roomOrdersApi, roomsApi } from '../api';
import { Plus, LogOut, Eye, AlertTriangle } from 'lucide-react';

function RoomOrders() {
  const [orders, setOrders] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [formData, setFormData] = useState({
    room_id: '',
    guest_name: '',
    check_in_time: ''
  });

  useEffect(() => {
    loadOrders();
    loadRooms();
  }, []);

  const loadOrders = async () => {
    try {
      const res = await roomOrdersApi.getAll();
      setOrders(res.data);
    } catch (err) {
      console.error('加载房单失败', err);
    }
  };

  const loadRooms = async () => {
    try {
      const res = await roomsApi.getAll();
      setRooms(res.data.filter(r => r.status === 'available'));
    } catch (err) {
      console.error('加载客房失败', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await roomOrdersApi.create(formData);
      setShowModal(false);
      setFormData({ room_id: '', guest_name: '', check_in_time: '' });
      loadOrders();
      loadRooms();
    } catch (err) {
      alert(err.response?.data?.error || '创建失败');
    }
  };

  const handleCheckout = async (order) => {
    if (order.damage_count > 0 && order.paid_count < order.damage_count) {
      alert('该房单存在未处理的报损记录，请先完成赔付后再退房');
      return;
    }
    
    if (confirm(`确认将 ${order.room_number} 退房？`)) {
      try {
        await roomOrdersApi.checkout(order.id);
        loadOrders();
        loadRooms();
      } catch (err) {
        alert(err.response?.data?.error || '退房失败');
      }
    }
  };

  const viewDetail = async (orderId) => {
    try {
      const res = await roomOrdersApi.get(orderId);
      setSelectedOrder(res.data);
      setShowDetailModal(true);
    } catch (err) {
      console.error('加载详情失败', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-orange-100 text-orange-700';
      case 'closed': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'open': return '在住';
      case 'closed': return '已退房';
      default: return status;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">客房房单</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          开房登记
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">房号</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">客人姓名</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">房型</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">入住时间</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">退房时间</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">报损</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{order.room_number}</td>
                <td className="px-4 py-3 text-gray-600">{order.guest_name || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{order.room_type}</td>
                <td className="px-4 py-3 text-gray-600 text-sm">{order.check_in_time}</td>
                <td className="px-4 py-3 text-gray-600 text-sm">{order.check_out_time || '-'}</td>
                <td className="px-4 py-3">
                  {order.damage_count > 0 ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      order.paid_count >= order.damage_count 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {order.paid_count}/{order.damage_count}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => viewDetail(order.id)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="查看详情"
                    >
                      <Eye size={18} />
                    </button>
                    {order.status === 'open' && (
                      <button
                        onClick={() => handleCheckout(order)}
                        className="text-orange-600 hover:text-orange-800 p-1"
                        title="退房"
                      >
                        <LogOut size={18} />
                      </button>
                    )}
                    {order.status === 'open' && order.damage_count > order.paid_count && (
                      <AlertTriangle size={16} className="text-red-500" title="存在未处理报损" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {orders.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无房单数据
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">开房登记</h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">选择客房</label>
                  <select
                    value={formData.room_id}
                    onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">请选择空闲客房</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.room_number} - {room.room_type} ({room.floor}楼)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">客人姓名</label>
                  <input
                    type="text"
                    value={formData.guest_name}
                    onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入客人姓名"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">入住时间</label>
                  <input
                    type="datetime-local"
                    value={formData.check_in_time}
                    onChange={(e) => setFormData({ ...formData, check_in_time: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6 max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                房单详情 - {selectedOrder.room_number}
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <span className="text-sm text-gray-500">房号</span>
                <p className="font-medium text-gray-800">{selectedOrder.room_number}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">房型</span>
                <p className="font-medium text-gray-800">{selectedOrder.room_type}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">客人</span>
                <p className="font-medium text-gray-800">{selectedOrder.guest_name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">状态</span>
                <p className="font-medium">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusText(selectedOrder.status)}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">入住时间</span>
                <p className="font-medium text-gray-800">{selectedOrder.check_in_time}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">退房时间</span>
                <p className="font-medium text-gray-800">{selectedOrder.check_out_time || '-'}</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-800 mb-3">报损记录</h4>
              {selectedOrder.damages && selectedOrder.damages.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">布草</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">数量</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">损坏程度</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">赔付状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedOrder.damages.map((d) => (
                        <tr key={d.id}>
                          <td className="px-3 py-2 text-gray-800">{d.linen_name}</td>
                          <td className="px-3 py-2 text-gray-600">{d.quantity}</td>
                          <td className="px-3 py-2 text-gray-600">{d.damage_level}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              d.payment_status === 'paid' 
                                ? 'bg-green-100 text-green-700' 
                                : d.status === 'cancelled'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {d.payment_status === 'paid' ? '已赔付' : 
                               d.status === 'cancelled' ? '已取消' : '待处理'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">暂无报损记录</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoomOrders;

import React, { useState, useEffect } from 'react';
import { roomsApi, roomOrdersApi } from '../api';
import { Plus, BedDouble, Users, AlertCircle } from 'lucide-react';

function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    room_number: '',
    room_type: '标准间',
    floor: 1
  });

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const res = await roomsApi.getAll();
      setRooms(res.data);
    } catch (err) {
      console.error('加载客房失败', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await roomsApi.create(formData);
      setShowModal(false);
      setFormData({ room_number: '', room_type: '标准间', floor: 1 });
      loadRooms();
    } catch (err) {
      alert(err.response?.data?.error || '添加失败');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-700';
      case 'occupied': return 'bg-orange-100 text-orange-700';
      case 'maintenance': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available': return '空闲';
      case 'occupied': return '入住';
      case 'maintenance': return '维修';
      default: return status;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">客房管理</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          添加客房
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
          {rooms.map((room) => (
            <div key={room.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <BedDouble size={24} className="text-blue-500" />
                  <span className="text-xl font-bold text-gray-800">{room.room_number}</span>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(room.status)}`}>
                  {getStatusText(room.status)}
                </span>
              </div>
              
              <div className="space-y-1 text-sm text-gray-600">
                <div>房型: {room.room_type}</div>
                <div>楼层: {room.floor}楼</div>
              </div>

              {room.order_status === 'open' && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1 text-orange-600 text-sm">
                    <Users size={14} />
                    <span>客人: {room.guest_name || '未登记'}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {rooms.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <BedDouble size={48} className="mx-auto mb-3 text-gray-300" />
              <p>暂无客房数据，请先添加客房</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">添加客房</h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">房间号</label>
                  <input
                    type="text"
                    value={formData.room_number}
                    onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="如: 101"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">房型</label>
                  <select
                    value={formData.room_type}
                    onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="标准间">标准间</option>
                    <option value="大床房">大床房</option>
                    <option value="套房">套房</option>
                    <option value="总统套房">总统套房</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">楼层</label>
                  <input
                    type="number"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
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
                  确认添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Rooms;

import { useState } from 'react';
import { Plus, Edit2, Trash2, Lock, CheckCircle, X, Upload, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/store';

export default function Rooms() {
  const { rooms, addRoom, updateRoom, deleteRoom, sealRoomWindow, fetchRooms } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [formData, setFormData] = useState({
    room_number: '',
    floor: '',
    capacity: '2'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await updateRoom(editingRoom.id, formData);
        toast.success('房间信息已更新');
      } else {
        await addRoom(formData);
        toast.success('房间已添加');
      }
      setShowModal(false);
      setEditingRoom(null);
      setFormData({ room_number: '', floor: '', capacity: '2' });
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number,
      floor: room.floor || '',
      capacity: room.capacity || '2'
    });
    setShowModal(true);
  };

  const handleDelete = async (room) => {
    if (confirm(`确定要删除房间 ${room.room_number} 吗？`)) {
      try {
        await deleteRoom(room.id);
        toast.success('房间已删除');
      } catch (error) {
        toast.error(error.response?.data?.error || '删除失败');
      }
    }
  };

  const handleSealWindow = async (room) => {
    try {
      await sealRoomWindow(room.id);
      toast.success('窗户已封');
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    }
  };

  const getRoomStatusBadge = (room) => {
    if (room.is_window_sealed) {
      return <span className="badge badge-success">已封窗</span>;
    }
    if (room.is_evacuated) {
      return <span className="badge badge-primary">已撤离</span>;
    }
    if (room.is_occupied) {
      return <span className="badge badge-warning">有人</span>;
    }
    return <span className="badge badge-secondary">空闲</span>;
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        const rooms = lines.slice(1).map(line => {
          const [room_number, floor, capacity] = line.split(',').map(s => s.trim());
          return {
            room_number,
            floor: floor ? parseInt(floor) : null,
            capacity: capacity ? parseInt(capacity) : 2
          };
        });

        const response = await fetch('/api/rooms/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rooms })
        });
        const result = await response.json();
        
        if (result.success) {
          toast.success(result.data.summary);
          fetchRooms();
        } else {
          toast.error(result.error || '导入失败');
        }
        setImportModal(false);
      } catch (error) {
        toast.error('文件解析失败');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">房间管理</h1>
          <p className="text-gray-500 mt-1">管理民宿房间信息和状态</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setImportModal(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            批量导入
          </button>
          <button 
            onClick={() => {
              setEditingRoom(null);
              setFormData({ room_number: '', floor: '', capacity: '2' });
              setShowModal(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加房间
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">总房间数</p>
            <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">有人入住</p>
            <p className="text-2xl font-bold text-warning-600">
              {rooms.filter(r => r.is_occupied).length}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">已撤离</p>
            <p className="text-2xl font-bold text-primary-600">
              {rooms.filter(r => r.is_evacuated).length}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">已封窗</p>
            <p className="text-2xl font-bold text-success-600">
              {rooms.filter(r => r.is_window_sealed).length}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>房间号</th>
                <th>楼层</th>
                <th>容量</th>
                <th>状态</th>
                <th>封窗</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id}>
                  <td className="font-medium">{room.room_number}</td>
                  <td>{room.floor || '-'}</td>
                  <td>{room.capacity} 人</td>
                  <td>{getRoomStatusBadge(room)}</td>
                  <td>
                    {room.is_window_sealed ? (
                      <CheckCircle className="w-5 h-5 text-success-600" />
                    ) : (
                      <button
                        onClick={() => handleSealWindow(room)}
                        className="btn btn-secondary btn-sm"
                        disabled={room.is_occupied && !room.is_evacuated}
                      >
                        <Lock className="w-4 h-4 mr-1" />
                        封窗
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(room)}
                        className="p-1 text-gray-400 hover:text-primary-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(room)}
                        className="p-1 text-gray-400 hover:text-danger-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    暂无房间数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                {editingRoom ? '编辑房间' : '添加房间'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="label">房间号 *</label>
                  <input
                    type="text"
                    value={formData.room_number}
                    onChange={e => setFormData({...formData, room_number: e.target.value})}
                    className="input"
                    placeholder="如: 101, 203"
                    required
                  />
                </div>
                <div>
                  <label className="label">楼层</label>
                  <input
                    type="number"
                    value={formData.floor}
                    onChange={e => setFormData({...formData, floor: e.target.value})}
                    className="input"
                    placeholder="如: 1, 2"
                  />
                </div>
                <div>
                  <label className="label">容量（人）</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={e => setFormData({...formData, capacity: e.target.value})}
                    className="input"
                    min="1"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRoom ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importModal && (
        <div className="modal-overlay" onClick={() => setImportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">批量导入房间</h2>
              <button onClick={() => setImportModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">CSV 格式要求：</p>
                    <p>第一行：room_number,floor,capacity</p>
                    <p>示例：101,1,2</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="label">选择 CSV 文件</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImport}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setImportModal(false)} className="btn btn-secondary">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

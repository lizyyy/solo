import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Upload, AlertCircle, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/store';

export default function Ships() {
  const { ships, addShip, updateShip, deleteShip, fetchShips } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingShip, setEditingShip] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    capacity: '',
    departure_time: '',
    estimated_arrival: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        capacity: parseInt(formData.capacity)
      };

      if (editingShip) {
        await updateShip(editingShip.id, submitData);
        toast.success('船班信息已更新');
      } else {
        await addShip(submitData);
        toast.success('船班已添加');
      }
      setShowModal(false);
      setEditingShip(null);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      capacity: '',
      departure_time: '',
      estimated_arrival: ''
    });
  };

  const handleEdit = (ship) => {
    setEditingShip(ship);
    setFormData({
      name: ship.name,
      capacity: ship.capacity,
      departure_time: ship.departure_time || '',
      estimated_arrival: ship.estimated_arrival || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (ship) => {
    if (confirm(`确定要删除船班 ${ship.name} 吗？`)) {
      try {
        await deleteShip(ship.id);
        toast.success('船班已删除');
      } catch (error) {
        toast.error(error.response?.data?.error || '删除失败');
      }
    }
  };

  const getStatusBadge = (ship) => {
    const available = ship.capacity - ship.current_load;
    if (ship.status === 'available' && available > 0) {
      return <span className="badge badge-success">可用</span>;
    }
    if (ship.status === 'maintenance') {
      return <span className="badge badge-warning">维护中</span>;
    }
    if (available <= 0) {
      return <span className="badge badge-danger">已满</span>;
    }
    return <span className="badge badge-secondary">{ship.status}</span>;
  };

  const totalCapacity = ships.reduce((sum, s) => sum + s.capacity, 0);
  const totalLoad = ships.reduce((sum, s) => sum + s.current_load, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">船班管理</h1>
          <p className="text-gray-500 mt-1">管理撤离用船班信息和载客量</p>
        </div>
        <button 
          onClick={() => {
            setEditingShip(null);
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加船班
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">可用船班</p>
            <p className="text-2xl font-bold text-success-600">
              {ships.filter(s => s.status === 'available').length}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">总容量</p>
            <p className="text-2xl font-bold text-primary-600">{totalCapacity} 人</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">已使用</p>
            <p className="text-2xl font-bold text-warning-600">
              {totalLoad}/{totalCapacity}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>船名</th>
                <th>容量</th>
                <th>当前载客</th>
                <th>可用座位</th>
                <th>状态</th>
                <th>开航时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {ships.map(ship => (
                <tr key={ship.id}>
                  <td className="font-medium">{ship.name}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      {ship.capacity} 人
                    </div>
                  </td>
                  <td>{ship.current_load} 人</td>
                  <td>
                    <span className={ship.capacity - ship.current_load > 0 ? 'text-success-600' : 'text-danger-600'}>
                      {ship.capacity - ship.current_load} 人
                    </span>
                  </td>
                  <td>{getStatusBadge(ship)}</td>
                  <td>{ship.departure_time || '-'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(ship)}
                        className="p-1 text-gray-400 hover:text-primary-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(ship)}
                        className="p-1 text-gray-400 hover:text-danger-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {ships.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    暂无船班数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                {editingShip ? '编辑船班' : '添加船班'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="label">船名 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="input"
                    placeholder="如: 和平号、平安号"
                    required
                  />
                </div>
                <div>
                  <label className="label">载客容量（人）*</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={e => setFormData({...formData, capacity: e.target.value})}
                    className="input"
                    min="1"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">计划开航时间</label>
                    <input
                      type="datetime-local"
                      value={formData.departure_time}
                      onChange={e => setFormData({...formData, departure_time: e.target.value})}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">预计到达时间</label>
                    <input
                      type="datetime-local"
                      value={formData.estimated_arrival}
                      onChange={e => setFormData({...formData, estimated_arrival: e.target.value})}
                      className="input"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingShip ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

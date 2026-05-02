import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Upload, AlertCircle, UserCheck, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/store';

export default function Guests() {
  const { 
    guests, rooms, batches, 
    addGuest, updateGuest, deleteGuest, 
    evacuateGuest, assignGuestToBatch, removeGuestFromBatch,
    fetchGuests, fetchRooms, fetchBatches
  } = useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [filter, setFilter] = useState({
    is_evacuated: null,
    is_elderly: false,
    is_child: false,
    has_disability: false
  });
  const [formData, setFormData] = useState({
    room_id: '',
    name: '',
    id_number: '',
    phone: '',
    age: '',
    gender: '',
    is_elderly: false,
    is_child: false,
    has_disability: false,
    nationality: '中国',
    checkin_date: '',
    checkout_date: ''
  });

  const availableRooms = rooms.filter(r => !r.is_evacuated);

  const filteredGuests = guests.filter(g => {
    if (filter.is_evacuated !== null && g.is_evacuated !== filter.is_evacuated) return false;
    if (filter.is_elderly && !g.is_elderly) return false;
    if (filter.is_child && !g.is_child) return false;
    if (filter.has_disability && !g.has_disability) return false;
    return true;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        is_elderly: formData.is_elderly || (formData.age && formData.age >= 65),
        is_child: formData.is_child || (formData.age && formData.age < 18)
      };

      if (editingGuest) {
        await updateGuest(editingGuest.id, submitData);
        toast.success('住客信息已更新');
      } else {
        await addGuest(submitData);
        toast.success('住客已添加');
      }
      setShowModal(false);
      setEditingGuest(null);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    }
  };

  const resetForm = () => {
    setFormData({
      room_id: '',
      name: '',
      id_number: '',
      phone: '',
      age: '',
      gender: '',
      is_elderly: false,
      is_child: false,
      has_disability: false,
      nationality: '中国',
      checkin_date: '',
      checkout_date: ''
    });
  };

  const handleEdit = (guest) => {
    setEditingGuest(guest);
    setFormData({
      room_id: guest.room_id || '',
      name: guest.name,
      id_number: guest.id_number || '',
      phone: guest.phone || '',
      age: guest.age || '',
      gender: guest.gender || '',
      is_elderly: guest.is_elderly,
      is_child: guest.is_child,
      has_disability: guest.has_disability,
      nationality: guest.nationality || '中国',
      checkin_date: guest.checkin_date || '',
      checkout_date: guest.checkout_date || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (guest) => {
    if (confirm(`确定要删除住客 ${guest.name} 吗？`)) {
      try {
        await deleteGuest(guest.id);
        toast.success('住客已删除');
      } catch (error) {
        toast.error(error.response?.data?.error || '删除失败');
      }
    }
  };

  const handleEvacuate = async (guest) => {
    if (confirm(`确认 ${guest.name} 已撤离？`)) {
      try {
        await evacuateGuest(guest.id);
        toast.success('住客已标记为撤离');
      } catch (error) {
        toast.error(error.response?.data?.error || '操作失败');
      }
    }
  };

  const handleAssignBatch = async (guestId, batchId) => {
    try {
      await assignGuestToBatch(guestId, batchId);
      toast.success('住客已分配到批次');
    } catch (error) {
      toast.error(error.response?.data?.error || '分配失败');
    }
  };

  const handleRemoveBatch = async (guest) => {
    try {
      await removeGuestFromBatch(guest.id);
      toast.success('住客已从批次移除');
    } catch (error) {
      toast.error(error.response?.data?.error || '移除失败');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        const guestsList = lines.slice(1).map(line => {
          const [name, room_number, age, gender, phone, id_number] = line.split(',').map(s => s.trim());
          return {
            name,
            room_number,
            age: age ? parseInt(age) : null,
            gender,
            phone,
            id_number
          };
        });

        const response = await fetch('/api/guests/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guests: guestsList })
        });
        const result = await response.json();
        
        if (result.success) {
          toast.success(result.data.summary);
          fetchGuests();
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

  const getPriorityBadge = (guest) => {
    const tags = [];
    if (guest.is_elderly) tags.push('老人');
    if (guest.is_child) tags.push('儿童');
    if (guest.has_disability) tags.push('行动不便');
    
    if (tags.length > 0) {
      return <span className="badge badge-danger">{tags.join('、')}</span>;
    }
    return <span className="badge badge-secondary">普通</span>;
  };

  const getStatusBadge = (guest) => {
    if (guest.is_evacuated) {
      return <span className="badge badge-success">已撤离</span>;
    }
    if (guest.evacuation_batch_id) {
      return <span className="badge badge-primary">已分配</span>;
    }
    return <span className="badge badge-warning">待分配</span>;
  };

  const stats = {
    total: guests.length,
    evacuated: guests.filter(g => g.is_evacuated).length,
    pending: guests.filter(g => !g.is_evacuated).length,
    priority: guests.filter(g => g.is_elderly || g.is_child || g.has_disability).length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">住客管理</h1>
          <p className="text-gray-500 mt-1">管理住客信息和撤离状态</p>
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
              setEditingGuest(null);
              resetForm();
              setShowModal(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加住客
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">总住客数</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">已撤离</p>
            <p className="text-2xl font-bold text-success-600">{stats.evacuated}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">待撤离</p>
            <p className="text-2xl font-bold text-warning-600">{stats.pending}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">高优先级</p>
            <p className="text-2xl font-bold text-danger-600">{stats.priority}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium">筛选</span>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filter.is_evacuated === 1}
                onChange={() => setFilter({...filter, is_evacuated: filter.is_evacuated === 1 ? null : 1})}
                className="rounded"
              />
              已撤离
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filter.is_evacuated === 0}
                onChange={() => setFilter({...filter, is_evacuated: filter.is_evacuated === 0 ? null : 0})}
                className="rounded"
              />
              待撤离
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filter.is_elderly}
                onChange={() => setFilter({...filter, is_elderly: !filter.is_elderly})}
                className="rounded"
              />
              仅老人
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filter.is_child}
                onChange={() => setFilter({...filter, is_child: !filter.is_child})}
                className="rounded"
              />
              仅儿童
            </label>
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>房间</th>
                <th>年龄</th>
                <th>优先级</th>
                <th>状态</th>
                <th>批次</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.map(guest => (
                <tr key={guest.id}>
                  <td className="font-medium">{guest.name}</td>
                  <td>{guest.room_number || '-'}</td>
                  <td>{guest.age || '-'}</td>
                  <td>{getPriorityBadge(guest)}</td>
                  <td>{getStatusBadge(guest)}</td>
                  <td>
                    {guest.evacuation_batch_id ? (
                      <div className="flex items-center gap-2">
                        <span>第 {batches.find(b => b.id === guest.evacuation_batch_id)?.batch_number || '-'} 批次</span>
                        {!guest.is_evacuated && (
                          <button
                            onClick={() => handleRemoveBatch(guest)}
                            className="text-xs text-danger-600 hover:underline"
                          >
                            移除
                          </button>
                        )}
                      </div>
                    ) : (
                      !guest.is_evacuated && (
                        <select
                          onChange={(e) => e.target.value && handleAssignBatch(guest.id, e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                          defaultValue=""
                        >
                          <option value="">分配批次</option>
                          {batches.filter(b => b.status !== 'completed').map(batch => (
                            <option key={batch.id} value={batch.id}>
                              第 {batch.batch_number} 批次
                            </option>
                          ))}
                        </select>
                      )
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {!guest.is_evacuated && (
                        <button
                          onClick={() => handleEvacuate(guest)}
                          className="p-1 text-gray-400 hover:text-success-600"
                          title="标记撤离"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(guest)}
                        className="p-1 text-gray-400 hover:text-primary-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!guest.is_evacuated && (
                        <button
                          onClick={() => handleDelete(guest)}
                          className="p-1 text-gray-400 hover:text-danger-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredGuests.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    暂无符合条件的住客数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                {editingGuest ? '编辑住客' : '添加住客'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">姓名 *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">房间</label>
                    <select
                      value={formData.room_id}
                      onChange={e => setFormData({...formData, room_id: e.target.value})}
                      className="input"
                    >
                      <option value="">选择房间</option>
                      {availableRooms.map(room => (
                        <option key={room.id} value={room.id}>
                          {room.room_number}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">年龄</label>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={e => setFormData({...formData, age: e.target.value})}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">性别</label>
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({...formData, gender: e.target.value})}
                      className="input"
                    >
                      <option value="">选择</option>
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">手机号</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">身份证号</label>
                    <input
                      type="text"
                      value={formData.id_number}
                      onChange={e => setFormData({...formData, id_number: e.target.value})}
                      className="input"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">入住日期</label>
                    <input
                      type="date"
                      value={formData.checkin_date}
                      onChange={e => setFormData({...formData, checkin_date: e.target.value})}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">退房日期</label>
                    <input
                      type="date"
                      value={formData.checkout_date}
                      onChange={e => setFormData({...formData, checkout_date: e.target.value})}
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">特殊需求</label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_elderly}
                        onChange={e => setFormData({...formData, is_elderly: e.target.checked})}
                        className="rounded"
                      />
                      老人
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_child}
                        onChange={e => setFormData({...formData, is_child: e.target.checked})}
                        className="rounded"
                      />
                      儿童
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.has_disability}
                        onChange={e => setFormData({...formData, has_disability: e.target.checked})}
                        className="rounded"
                      />
                      行动不便
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingGuest ? '保存' : '添加'}
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
              <h2 className="text-lg font-semibold">批量导入住客</h2>
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
                    <p>第一行：name,room_number,age,gender,phone,id_number</p>
                    <p>示例：张三,101,30,男,13800138000,110101199001011234</p>
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

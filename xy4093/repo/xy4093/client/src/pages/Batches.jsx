import { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, X, Play, CheckCircle, Clock, 
  Users, Ship, ArrowRight, Sparkles, AlertCircle, MoveRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/store';
import { batchesApi, exportApi } from '../services/api';

export default function Batches() {
  const { 
    batches, guests, ships,
    addBatch, updateBatch, deleteBatch, 
    startBatch, completeBatch, assignGuestToBatch,
    fetchBatches, fetchGuests, fetchShips, generatedPlan,
    setGeneratedPlan
  } = useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [planModal, setPlanModal] = useState(false);
  const [dutySheetPreview, setDutySheetPreview] = useState(null);
  
  const [formData, setFormData] = useState({
    ship_id: '',
    batch_number: '',
    max_capacity: '',
    scheduled_time: '',
    departure_location: '',
    arrival_location: ''
  });

  const pendingGuests = guests.filter(g => !g.is_evacuated && !g.evacuation_batch_id);
  const assignedGuests = (batchId) => guests.filter(g => g.evacuation_batch_id === batchId);

  useEffect(() => {
    fetchBatches();
    fetchGuests();
    fetchShips();
  }, []);

  const handleGeneratePlan = async () => {
    if (pendingGuests.length === 0) {
      toast.error('没有待分配的住客');
      return;
    }
    setGenerating(true);
    try {
      const response = await batchesApi.generatePlan({
        priorityFirst: true,
        fillByCapacity: true
      });
      if (response.data.success) {
        setGeneratedPlan(response.data.data);
        setPlanModal(true);
        toast.success('撤离方案已生成');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || '生成方案失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePlan = async () => {
    if (!generatedPlan) return;
    try {
      const response = await batchesApi.savePlan(generatedPlan);
      if (response.data.success) {
        setGeneratedPlan(null);
        setPlanModal(false);
        fetchBatches();
        fetchGuests();
        toast.success('撤离方案已保存');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || '保存方案失败');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        max_capacity: formData.max_capacity ? parseInt(formData.max_capacity) : null
      };

      if (editingBatch) {
        await updateBatch(editingBatch.id, submitData);
        toast.success('批次已更新');
      } else {
        await addBatch(submitData);
        toast.success('批次已创建');
      }
      setShowModal(false);
      setEditingBatch(null);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    }
  };

  const resetForm = () => {
    setFormData({
      ship_id: '',
      batch_number: '',
      max_capacity: '',
      scheduled_time: '',
      departure_location: '',
      arrival_location: ''
    });
  };

  const handleEdit = (batch) => {
    setEditingBatch(batch);
    setFormData({
      ship_id: batch.ship_id || '',
      batch_number: batch.batch_number || '',
      max_capacity: batch.max_capacity || '',
      scheduled_time: batch.scheduled_time || '',
      departure_location: batch.departure_location || '',
      arrival_location: batch.arrival_location || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (batch) => {
    if (confirm(`确定要删除第 ${batch.batch_number} 批次吗？`)) {
      try {
        await deleteBatch(batch.id);
        toast.success('批次已删除');
      } catch (error) {
        toast.error(error.response?.data?.error || '删除失败');
      }
    }
  };

  const handleStart = async (batch) => {
    if (confirm(`开始第 ${batch.batch_number} 批次撤离？`)) {
      try {
        await startBatch(batch.id);
        toast.success('批次已开始');
      } catch (error) {
        toast.error(error.response?.data?.error || '操作失败');
      }
    }
  };

  const handleComplete = async (batch) => {
    if (confirm(`确认第 ${batch.batch_number} 批次已完成撤离？该批次所有住客将标记为已撤离。`)) {
      try {
        await completeBatch(batch.id);
        toast.success('批次已完成');
      } catch (error) {
        toast.error(error.response?.data?.error || '操作失败');
      }
    }
  };

  const handleManualAssign = async (guestId, batchId) => {
    try {
      await assignGuestToBatch(guestId, batchId);
      toast.success('住客已分配到批次');
    } catch (error) {
      toast.error(error.response?.data?.error || '分配失败');
    }
  };

  const loadDutySheetPreview = async () => {
    try {
      const response = await exportApi.getDutySheet();
      setDutySheetPreview(response.data.data);
    } catch (error) {
      toast.error('加载预览失败');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: <span className="badge badge-warning">计划中</span>,
      in_progress: <span className="badge badge-primary">进行中</span>,
      completed: <span className="badge badge-success">已完成</span>
    };
    return badges[status] || <span className="badge badge-secondary">{status}</span>;
  };

  const getPriorityBadge = (guest) => {
    const tags = [];
    if (guest.is_elderly) tags.push('老人');
    if (guest.is_child) tags.push('儿童');
    if (guest.has_disability) tags.push('行动不便');
    if (tags.length > 0) {
      return <span className="badge badge-danger text-xs">{tags.join('、')}</span>;
    }
    return null;
  };

  const stats = {
    total: batches.length,
    inProgress: batches.filter(b => b.status === 'in_progress').length,
    completed: batches.filter(b => b.status === 'completed').length,
    pending: batches.filter(b => b.status === 'pending').length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">撤离批次管理</h1>
          <p className="text-gray-500 mt-1">生成撤离方案、管理船班批次</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleGeneratePlan}
            disabled={generating}
            className="btn btn-primary flex items-center gap-2"
          >
            <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            一键生成方案
          </button>
          <button 
            onClick={() => {
              setEditingBatch(null);
              resetForm();
              setShowModal(true);
            }}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            手动创建批次
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">总批次</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">进行中</p>
            <p className="text-2xl font-bold text-primary-600">{stats.inProgress}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">已完成</p>
            <p className="text-2xl font-bold text-success-600">{stats.completed}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body text-center">
            <p className="text-sm text-gray-500">待分配住客</p>
            <p className="text-2xl font-bold text-warning-600">{pendingGuests.length}</p>
          </div>
        </div>
      </div>

      {pendingGuests.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-warning-600" />
              <h2 className="font-semibold text-gray-900">待分配住客 ({pendingGuests.length} 人)</h2>
            </div>
          </div>
          <div className="card-body">
            {pendingGuests.length === 0 ? (
              <p className="text-gray-500 text-center py-4">所有住客已分配批次</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingGuests.map(guest => (
                  <div key={guest.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{guest.name}</span>
                      {getPriorityBadge(guest)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      房间: {guest.room_number || '未分配'}
                    </p>
                    <div className="mt-2">
                      <select
                        onChange={(e) => e.target.value && handleManualAssign(guest.id, e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                        defaultValue=""
                      >
                        <option value="">分配到批次</option>
                        {batches.filter(b => b.status === 'pending').map(batch => (
                          <option key={batch.id} value={batch.id}>
                            第 {batch.batch_number} 批次
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">撤离批次列表</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>批次号</th>
                <th>船班</th>
                <th>容量</th>
                <th>已分配</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(batch => (
                <tr 
                  key={batch.id} 
                  className={`cursor-pointer hover:bg-gray-50 ${selectedBatch?.id === batch.id ? 'bg-primary-50' : ''}`}
                  onClick={() => setSelectedBatch(selectedBatch?.id === batch.id ? null : batch)}
                >
                  <td className="font-medium">第 {batch.batch_number} 批次</td>
                  <td>
                    {ships.find(s => s.id === batch.ship_id)?.name || batch.ship_name || '未指定'}
                  </td>
                  <td>{batch.max_capacity || '-'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span>{batch.guest_count || assignedGuests(batch.id).length}</span>
                      {batch.max_capacity && (
                        <div className="w-20">
                          <div className="progress-bar h-2">
                            <div 
                              className={`progress-bar-fill ${
                                (batch.guest_count || assignedGuests(batch.id).length) >= batch.max_capacity 
                                  ? 'bg-warning-500' 
                                  : 'bg-primary-500'
                              }`}
                              style={{ width: `${Math.min(100, ((batch.guest_count || assignedGuests(batch.id).length) / batch.max_capacity * 100))}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{getStatusBadge(batch.status)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      {batch.status === 'pending' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStart(batch); }}
                          className="p-1 text-gray-400 hover:text-primary-600"
                          title="开始批次"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {batch.status === 'in_progress' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleComplete(batch); }}
                          className="p-1 text-gray-400 hover:text-success-600"
                          title="完成批次"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {batch.status !== 'completed' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(batch); }}
                            className="p-1 text-gray-400 hover:text-primary-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(batch); }}
                            className="p-1 text-gray-400 hover:text-danger-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    暂无撤离批次，点击"一键生成方案"创建
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBatch && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              第 {selectedBatch.batch_number} 批次 - 住客详情
            </h2>
            <button
              onClick={() => {
                exportApi.downloadShipList(selectedBatch.id);
              }}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              导出CSV名单 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="card-body">
            {assignedGuests(selectedBatch.id).length === 0 ? (
              <p className="text-gray-500 text-center py-4">该批次暂无住客</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>姓名</th>
                      <th>房间</th>
                      <th>年龄</th>
                      <th>优先级</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedGuests(selectedBatch.id).map(guest => (
                      <tr key={guest.id}>
                        <td className="font-medium">{guest.name}</td>
                        <td>{guest.room_number || '-'}</td>
                        <td>{guest.age || '-'}</td>
                        <td>{getPriorityBadge(guest) || <span className="badge badge-secondary">普通</span>}</td>
                        <td>
                          {guest.is_evacuated 
                            ? <span className="badge badge-success">已撤离</span>
                            : <span className="badge badge-warning">待撤离</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                {editingBatch ? '编辑批次' : '创建批次'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">批次号 *</label>
                    <input
                      type="number"
                      value={formData.batch_number}
                      onChange={e => setFormData({...formData, batch_number: e.target.value})}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">最大容量</label>
                    <input
                      type="number"
                      value={formData.max_capacity}
                      onChange={e => setFormData({...formData, max_capacity: e.target.value})}
                      className="input"
                      placeholder="人数"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">船班</label>
                  <select
                    value={formData.ship_id}
                    onChange={e => setFormData({...formData, ship_id: e.target.value})}
                    className="input"
                  >
                    <option value="">选择船班</option>
                    {ships.map(ship => (
                      <option key={ship.id} value={ship.id}>
                        {ship.name} (容量: {ship.capacity})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">计划时间</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_time}
                    onChange={e => setFormData({...formData, scheduled_time: e.target.value})}
                    className="input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">出发地点</label>
                    <input
                      type="text"
                      value={formData.departure_location}
                      onChange={e => setFormData({...formData, departure_location: e.target.value})}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">到达地点</label>
                    <input
                      type="text"
                      value={formData.arrival_location}
                      onChange={e => setFormData({...formData, arrival_location: e.target.value})}
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
                  {editingBatch ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {planModal && generatedPlan && (
        <div className="modal-overlay" onClick={() => setPlanModal(false)}>
          <div className="modal-content max-w-4xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold">生成的撤离方案</h2>
              </div>
              <button onClick={() => setPlanModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="p-4 bg-primary-50 rounded-lg">
                <p className="text-sm text-primary-800">
                  <strong>方案概要：</strong>共 {generatedPlan.total_guests} 名住客，
                  分为 {generatedPlan.batches?.length || 0} 个批次。
                  高优先级住客 {generatedPlan.priority_guests} 人将优先撤离。
                </p>
              </div>
              
              {generatedPlan.batches?.map((batch, index) => (
                <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">第 {batch.batch_number} 批次</span>
                      <span className="badge badge-primary">{batch.guests?.length || 0} 人</span>
                    </div>
                    {batch.ship_name && (
                      <span className="text-sm text-gray-500">船班: {batch.ship_name}</span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {batch.guests?.map(guest => (
                        <div key={guest.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{guest.name}</span>
                            {getPriorityBadge(guest)}
                          </div>
                          <span className="text-sm text-gray-500">{guest.room_number || '无房间'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              
              {generatedPlan.unassigned_guests?.length > 0 && (
                <div className="p-4 bg-warning-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-warning-800">有 {generatedPlan.unassigned_guests.length} 名住客未分配</p>
                      <p className="text-sm text-warning-700 mt-1">
                        可能原因：船班容量不足。请检查船班配置或手动分配。
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => setPlanModal(false)} 
                className="btn btn-secondary"
              >
                取消
              </button>
              <button 
                type="button" 
                onClick={handleSavePlan} 
                className="btn btn-primary"
              >
                保存方案
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

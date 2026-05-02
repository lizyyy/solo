import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Play,
  AlertTriangle
} from 'lucide-react';
import { patrolTasksAPI, buildingsAPI, devicesAPI } from '../utils/api';
import dayjs from 'dayjs';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' }
];

const STATUS_LABELS = {
  'pending': '待开始',
  'in_progress': '进行中',
  'completed': '已完成'
};

function PatrolTasks() {
  const [tasks, setTasks] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    buildingId: '',
    status: ''
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    deviceId: '',
    scheduledAt: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [filters]);

  const loadData = async () => {
    try {
      const [buildingsRes, devicesRes] = await Promise.all([
        buildingsAPI.getAll(),
        devicesAPI.getAll()
      ]);
      setBuildings(buildingsRes.data);
      setDevices(devicesRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.buildingId) params.buildingId = filters.buildingId;
      if (filters.status) params.status = filters.status;
      
      const response = await patrolTasksAPI.getAll(params);
      setTasks(response.data);
    } catch (error) {
      console.error('加载巡检任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        deviceId: parseInt(formData.deviceId)
      };
      
      await patrolTasksAPI.create(data);
      setShowCreateModal(false);
      setFormData({ name: '', deviceId: '', scheduledAt: '' });
      loadTasks();
    } catch (error) {
      alert(error.message || '创建失败');
    }
  };

  const handleStart = async (task) => {
    try {
      await patrolTasksAPI.start(task.id);
      loadTasks();
    } catch (error) {
      alert(error.message || '启动失败');
    }
  };

  const hasAbnormal = (task) => {
    return task.items?.some(item => item.isAbnormal) || false;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">巡检任务</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-1"
        >
          <Plus size={16} /> 创建巡检任务
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">楼栋</label>
              <select 
                className="select"
                value={filters.buildingId}
                onChange={(e) => setFilters(prev => ({ ...prev, buildingId: e.target.value }))}
              >
                <option value="">全部楼栋</option>
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">状态</label>
              <select 
                className="select"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={loadTasks}
                className="btn btn-secondary w-full"
              >
                <Search size={16} className="mr-1" /> 查询
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>设备</th>
                <th>楼栋</th>
                <th>计划时间</th>
                <th>状态</th>
                <th>异常</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    暂无巡检任务
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <Link 
                        to={`/patrol-tasks/${task.id}`}
                        className="font-medium text-primary-600 hover:text-primary-700"
                      >
                        {task.name}
                      </Link>
                    </td>
                    <td>{task.device?.name}</td>
                    <td>{task.device?.building?.name}</td>
                    <td className="text-gray-500">
                      {task.scheduledAt 
                        ? dayjs(task.scheduledAt).format('YYYY-MM-DD')
                        : '-'
                      }
                    </td>
                    <td>
                      <span className={`badge ${
                        task.status === 'completed' 
                          ? 'bg-green-100 text-green-700' 
                          : task.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {STATUS_LABELS[task.status]}
                      </span>
                    </td>
                    <td>
                      {hasAbnormal(task) ? (
                        <span className="text-red-600 flex items-center gap-1">
                          <AlertTriangle size={14} /> 有异常
                        </span>
                      ) : (
                        <span className="text-gray-400">正常</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {task.status === 'pending' && (
                          <button 
                            onClick={() => handleStart(task)}
                            className="btn btn-primary btn-sm flex items-center gap-1"
                          >
                            <Play size={14} /> 开始
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <Link 
                            to={`/patrol-tasks/${task.id}`}
                            className="btn btn-primary btn-sm"
                          >
                            继续巡检
                          </Link>
                        )}
                        {task.status === 'completed' && (
                          <Link 
                            to={`/patrol-tasks/${task.id}`}
                            className="btn btn-secondary btn-sm"
                          >
                            查看
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">创建巡检任务</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="label">任务名称 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input"
                    placeholder="如：1号楼客梯日常巡检"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">选择设备 <span className="text-red-500">*</span></label>
                  <select
                    className="select"
                    value={formData.deviceId}
                    onChange={(e) => setFormData(prev => ({ ...prev, deviceId: e.target.value }))}
                    required
                  >
                    <option value="">请选择设备</option>
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.building?.name} - {d.name} ({d.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">计划时间</label>
                  <input
                    type="date"
                    className="input"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PatrolTasks;

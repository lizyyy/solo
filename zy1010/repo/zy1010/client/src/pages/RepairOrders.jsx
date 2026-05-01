import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Download,
  UserPlus,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { repairOrdersAPI, buildingsAPI, devicesAPI, workersAPI } from '../utils/api';
import dayjs from 'dayjs';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending_assignment', label: '待分派' },
  { value: 'in_progress', label: '处理中' },
  { value: 'pending_review', label: '待复核' },
  { value: 'closed', label: '已关闭' }
];

const STATUS_LABELS = {
  'pending_assignment': '待分派',
  'in_progress': '处理中',
  'pending_review': '待复核',
  'closed': '已关闭'
};

function RepairOrders() {
  const [orders, setOrders] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [devices, setDevices] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    buildingId: '',
    status: '',
    workerId: '',
    overdue: ''
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningOrder, setAssigningOrder] = useState(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deviceId: '',
    skillRequired: '',
    estimatedMinutes: '',
    dueDate: '',
    workerId: ''
  });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [filters]);

  const loadData = async () => {
    try {
      const [buildingsRes, devicesRes, workersRes, statsRes] = await Promise.all([
        buildingsAPI.getAll(),
        devicesAPI.getAll(),
        workersAPI.getAll(),
        repairOrdersAPI.getStats()
      ]);
      setBuildings(buildingsRes.data);
      setDevices(devicesRes.data);
      setWorkers(workersRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.buildingId) params.buildingId = filters.buildingId;
      if (filters.status) params.status = filters.status;
      if (filters.workerId) params.workerId = filters.workerId;
      if (filters.overdue === 'true') params.overdue = 'true';
      
      const response = await repairOrdersAPI.getAll(params);
      setOrders(response.data);
    } catch (error) {
      console.error('加载维修单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        deviceId: parseInt(formData.deviceId),
        estimatedMinutes: formData.estimatedMinutes ? parseInt(formData.estimatedMinutes) : null,
        workerId: formData.workerId ? parseInt(formData.workerId) : null
      };
      
      await repairOrdersAPI.create(data);
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        deviceId: '',
        skillRequired: '',
        estimatedMinutes: '',
        dueDate: '',
        workerId: ''
      });
      loadOrders();
      loadData();
    } catch (error) {
      alert(error.message || '创建失败');
    }
  };

  const handleAssign = async () => {
    if (!selectedWorkerId) {
      alert('请选择维修师傅');
      return;
    }
    
    try {
      await repairOrdersAPI.assign(assigningOrder.id, parseInt(selectedWorkerId));
      setShowAssignModal(false);
      setAssigningOrder(null);
      setSelectedWorkerId('');
      loadOrders();
      loadData();
    } catch (error) {
      alert(error.message || '派单失败');
    }
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (filters.buildingId) params.buildingId = filters.buildingId;
      if (filters.status) params.status = filters.status;
      if (filters.workerId) params.workerId = filters.workerId;
      
      const response = await repairOrdersAPI.exportCSV(params);
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `repair_orders_${dayjs().format('YYYY-MM-DD')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || '导出失败');
    }
  };

  const getSkillMatchWorkers = (order) => {
    if (!order.skillRequired) return workers;
    return workers.filter(w => w.skills.includes(order.skillRequired));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">维修单</h1>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleExport}
            className="btn btn-secondary btn-sm flex items-center gap-1"
          >
            <Download size={16} /> 导出 CSV
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-sm flex items-center gap-1"
          >
            <Plus size={16} /> 新建维修单
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="stat-card text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">总计</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.byStatus.pending_assignment || 0}</p>
            <p className="text-sm text-gray-500">待分派</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.byStatus.in_progress || 0}</p>
            <p className="text-sm text-gray-500">处理中</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.byStatus.pending_review || 0}</p>
            <p className="text-sm text-gray-500">待复核</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-2xl font-bold text-red-600">{stats.overdue || 0}</p>
            <p className="text-sm text-gray-500">已逾期</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <div>
              <label className="label">负责人</label>
              <select 
                className="select"
                value={filters.workerId}
                onChange={(e) => setFilters(prev => ({ ...prev, workerId: e.target.value }))}
              >
                <option value="">全部师傅</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">是否逾期</label>
              <select 
                className="select"
                value={filters.overdue}
                onChange={(e) => setFilters(prev => ({ ...prev, overdue: e.target.value }))}
              >
                <option value="">全部</option>
                <option value="true">已逾期</option>
                <option value="false">未逾期</option>
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={loadOrders}
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
                <th>ID</th>
                <th>标题</th>
                <th>设备</th>
                <th>所需技能</th>
                <th>负责人</th>
                <th>预计耗时</th>
                <th>截止日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500">
                    暂无维修单
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td className="text-gray-500">#{order.id}</td>
                    <td>
                      <Link 
                        to={`/repair-orders/${order.id}`}
                        className="font-medium text-primary-600 hover:text-primary-700"
                      >
                        {order.title}
                      </Link>
                    </td>
                    <td>
                      <div>
                        <p className="text-sm">{order.device?.name}</p>
                        <p className="text-xs text-gray-500">{order.device?.building?.name}</p>
                      </div>
                    </td>
                    <td>
                      {order.skillRequired && (
                        <span className="badge bg-gray-100 text-gray-700">
                          {order.skillRequired}
                        </span>
                      )}
                    </td>
                    <td>
                      {order.worker?.name || (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="text-gray-500">
                      {order.estimatedMinutes ? `${order.estimatedMinutes} 分钟` : '-'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {order.dueDate ? (
                          <>
                            <span className={order.isOverdue ? 'text-red-600' : 'text-gray-900'}>
                              {dayjs(order.dueDate).format('YYYY-MM-DD')}
                            </span>
                            {order.isOverdue && order.status !== 'closed' && (
                              <AlertTriangle size={14} className="text-red-600" />
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        order.isOverdue && order.status !== 'closed'
                          ? 'bg-red-100 text-red-700'
                          : order.status === 'pending_assignment'
                            ? 'bg-amber-100 text-amber-700'
                            : order.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700'
                              : order.status === 'pending_review'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                      }`}>
                        {order.isOverdue && order.status !== 'closed' ? '已逾期' : order.statusLabel}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {order.status === 'pending_assignment' && (
                          <button 
                            onClick={() => {
                              setAssigningOrder(order);
                              const matchedWorkers = getSkillMatchWorkers(order);
                              if (matchedWorkers.length > 0) {
                                setSelectedWorkerId(matchedWorkers[0].id.toString());
                              } else {
                                setSelectedWorkerId('');
                              }
                              setShowAssignModal(true);
                            }}
                            className="btn btn-primary btn-sm flex items-center gap-1"
                          >
                            <UserPlus size={14} /> 派单
                          </button>
                        )}
                        <Link 
                          to={`/repair-orders/${order.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          查看
                        </Link>
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
              <h2 className="text-lg font-semibold">新建维修单</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="label">标题 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input"
                    placeholder="维修单标题"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
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
                  <label className="label">描述</label>
                  <textarea
                    className="input h-20 resize-none"
                    placeholder="问题描述"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">所需技能</label>
                    <select
                      className="select"
                      value={formData.skillRequired}
                      onChange={(e) => setFormData(prev => ({ ...prev, skillRequired: e.target.value }))}
                    >
                      <option value="">不限</option>
                      {['电梯', '空调', '消防', '电气', '水暖', '机械', '管道'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">预计耗时(分钟)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="如：60"
                      value={formData.estimatedMinutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedMinutes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">截止日期</label>
                    <input
                      type="date"
                      className="input"
                      value={formData.dueDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">直接分派给</label>
                    <select
                      className="select"
                      value={formData.workerId}
                      onChange={(e) => setFormData(prev => ({ ...prev, workerId: e.target.value }))}
                    >
                      <option value="">暂不分派</option>
                      {workers.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.skills.join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>
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

      {showAssignModal && assigningOrder && (
        <div className="modal-overlay" onClick={() => {
          setShowAssignModal(false);
          setAssigningOrder(null);
          setSelectedWorkerId('');
        }}>
          <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">派单</h2>
            </div>
            <div className="modal-body space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-900">{assigningOrder.title}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {assigningOrder.device?.building?.name} - {assigningOrder.device?.name}
                </p>
                {assigningOrder.skillRequired && (
                  <p className="text-sm text-amber-600 mt-2">
                    推荐技能: {assigningOrder.skillRequired}
                  </p>
                )}
              </div>

              <div>
                <label className="label">选择维修师傅</label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {workers.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">暂无维修师傅</p>
                  ) : (
                    workers.map(worker => {
                      const isSkillMatch = assigningOrder.skillRequired && worker.skills.includes(assigningOrder.skillRequired);
                      const isSelected = selectedWorkerId === worker.id.toString();
                      
                      return (
                        <label 
                          key={worker.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected 
                              ? 'border-primary-500 bg-primary-50' 
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="worker"
                            value={worker.id}
                            checked={isSelected}
                            onChange={(e) => setSelectedWorkerId(e.target.value)}
                            className="w-4 h-4 text-primary-600"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{worker.name}</span>
                              {isSkillMatch && (
                                <span className="badge bg-green-100 text-green-700 text-xs">
                                  技能匹配
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex gap-1">
                                {worker.skills.map(skill => (
                                  <span key={skill} className="text-xs text-gray-500">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                              <span className="text-xs text-gray-400">|</span>
                              <span className="text-xs text-gray-500">
                                当前 {worker._count?.repairOrders || 0} 个待办
                              </span>
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  setAssigningOrder(null);
                  setSelectedWorkerId('');
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button 
                onClick={handleAssign}
                disabled={!selectedWorkerId}
                className="btn btn-primary"
              >
                确认派单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RepairOrders;

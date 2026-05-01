import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  UserPlus,
  CheckCircle,
  XCircle,
  Send
} from 'lucide-react';
import { repairOrdersAPI, workersAPI } from '../utils/api';
import dayjs from 'dayjs';

const STATUS_LABELS = {
  'pending_assignment': '待分派',
  'in_progress': '处理中',
  'pending_review': '待复核',
  'closed': '已关闭'
};

function RepairOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingNotes, setProcessingNotes] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [orderRes, workersRes] = await Promise.all([
        repairOrdersAPI.getById(id),
        workersAPI.getAll()
      ]);
      setOrder(orderRes.data);
      setWorkers(workersRes.data);
      setProcessingNotes(orderRes.data.processingNotes || '');
    } catch (error) {
      console.error('加载数据失败:', error);
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedWorkerId) {
      alert('请选择维修师傅');
      return;
    }
    
    try {
      await repairOrdersAPI.assign(order.id, parseInt(selectedWorkerId));
      setShowAssignModal(false);
      setSelectedWorkerId('');
      loadData();
    } catch (error) {
      alert(error.message || '派单失败');
    }
  };

  const handleSubmit = async () => {
    if (!processingNotes.trim()) {
      alert('请填写处理记录');
      return;
    }
    
    try {
      await repairOrdersAPI.submit(order.id, processingNotes);
      alert('已提交待复核');
      loadData();
    } catch (error) {
      alert(error.message || '提交失败');
    }
  };

  const handleReview = async (approved) => {
    try {
      await repairOrdersAPI.review(order.id, {
        approved,
        reviewNotes: reviewNotes || (approved ? '复核通过' : '打回重新处理')
      });
      alert(approved ? '复核通过，维修单已关闭' : '复核不通过，打回重新处理');
      setReviewNotes('');
      loadData();
    } catch (error) {
      alert(error.message || '操作失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">维修单不存在</p>
        <Link to="/repair-orders" className="text-primary-600 hover:underline mt-4 inline-block">
          返回列表
        </Link>
      </div>
    );
  }

  const getSkillMatchWorkers = () => {
    if (!order.skillRequired) return workers;
    return workers.filter(w => w.skills.includes(order.skillRequired));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">维修单 #{order.id}</h1>
          <div className="flex items-center gap-4 mt-2">
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
            <span className="text-sm text-gray-500">
              创建时间: {dayjs(order.createdAt).format('YYYY-MM-DD HH:mm')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">基本信息</h2>
            </div>
            <div className="card-body space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{order.title}</h3>
              </div>
              {order.description && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">问题描述</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{order.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">设备</p>
                  <p className="font-medium">
                    {order.device?.building?.name} - {order.device?.name}
                  </p>
                  <p className="text-sm text-gray-500">{order.device?.type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">负责人</p>
                  <p className="font-medium">{order.worker?.name || '暂未分派'}</p>
                  {order.worker && (
                    <div className="flex gap-1 mt-1">
                      {order.worker.skills.map(skill => (
                        <span key={skill} className="text-xs text-gray-500">{skill}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">所需技能</p>
                  <p className="font-medium">{order.skillRequired || '不限'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">预计耗时</p>
                  <p className="font-medium">{order.estimatedMinutes ? `${order.estimatedMinutes} 分钟` : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">截止日期</p>
                  <p className={`font-medium ${order.isOverdue && order.status !== 'closed' ? 'text-red-600' : ''}`}>
                    {order.dueDate ? dayjs(order.dueDate).format('YYYY-MM-DD') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">完成时间</p>
                  <p className="font-medium">
                    {order.completedAt ? dayjs(order.completedAt).format('YYYY-MM-DD HH:mm') : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {order.patrolTask && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">关联巡检任务</h2>
              </div>
              <div className="card-body">
                <Link 
                  to={`/patrol-tasks/${order.patrolTask.id}`}
                  className="text-primary-600 hover:underline"
                >
                  {order.patrolTask.name}
                </Link>
              </div>
            </div>
          )}

          {order.status === 'in_progress' && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">提交处理</h2>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">处理记录 <span className="text-red-500">*</span></label>
                  <textarea
                    className="input h-32 resize-none"
                    placeholder="请详细描述处理过程和结果..."
                    value={processingNotes}
                    onChange={(e) => setProcessingNotes(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={handleSubmit}
                    className="btn btn-primary flex items-center gap-1"
                  >
                    <Send size={16} /> 提交复核
                  </button>
                </div>
              </div>
            </div>
          )}

          {order.status === 'pending_review' && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">复核</h2>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">师傅处理记录</p>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {order.processingNotes || '无处理记录'}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="label">复核意见</label>
                  <textarea
                    className="input h-24 resize-none"
                    placeholder="填写复核意见（可选）"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => handleReview(false)}
                    className="btn btn-secondary flex items-center gap-1"
                  >
                    <XCircle size={16} /> 打回重处理
                  </button>
                  <button 
                    onClick={() => handleReview(true)}
                    className="btn btn-primary flex items-center gap-1"
                  >
                    <CheckCircle size={16} /> 通过并关闭
                  </button>
                </div>
              </div>
            </div>
          )}

          {(order.status === 'closed' || order.processingNotes) && (
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold">处理记录</h2>
              </div>
              <div className="card-body">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {order.processingNotes || '无处理记录'}
                  </p>
                </div>
                {order.reviewNotes && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-1">复核意见</p>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-gray-700">{order.reviewNotes}</p>
                      {order.reviewedBy && (
                        <p className="text-sm text-gray-500 mt-2">
                          复核人: {order.reviewedBy}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">操作</h2>
            </div>
            <div className="card-body space-y-3">
              {order.status === 'pending_assignment' && (
                <button 
                  onClick={() => {
                    const matchedWorkers = getSkillMatchWorkers();
                    if (matchedWorkers.length > 0) {
                      setSelectedWorkerId(matchedWorkers[0].id.toString());
                    } else {
                      setSelectedWorkerId('');
                    }
                    setShowAssignModal(true);
                  }}
                  className="btn btn-primary w-full flex items-center justify-center gap-1"
                >
                  <UserPlus size={16} /> 派单
                </button>
              )}
              <Link 
                to="/repair-orders"
                className="btn btn-secondary w-full flex items-center justify-center"
              >
                返回列表
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">可用师傅</h2>
            </div>
            <div className="card-body space-y-3">
              {workers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无维修师傅</p>
              ) : (
                workers.map(worker => {
                  const isSkillMatch = order.skillRequired && worker.skills.includes(order.skillRequired);
                  const isAssigned = order.worker?.id === worker.id;
                  
                  return (
                    <div 
                      key={worker.id}
                      className={`p-3 rounded-lg border ${
                        isAssigned 
                          ? 'border-primary-500 bg-primary-50' 
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{worker.name}</span>
                        {isSkillMatch && (
                          <span className="badge bg-green-100 text-green-700 text-xs">
                            技能匹配
                          </span>
                        )}
                        {isAssigned && (
                          <span className="badge bg-primary-100 text-primary-700 text-xs">
                            当前负责人
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {worker.skills.map(skill => (
                          <span key={skill} className="text-xs text-gray-500">{skill}</span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        待办: {worker._count?.repairOrders || 0} 单
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {showAssignModal && (
        <div className="modal-overlay" onClick={() => {
          setShowAssignModal(false);
          setSelectedWorkerId('');
        }}>
          <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">派单</h2>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="label">选择维修师傅</label>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {workers.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">暂无维修师傅</p>
                  ) : (
                    workers.map(worker => {
                      const isSkillMatch = order.skillRequired && worker.skills.includes(order.skillRequired);
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
                                  <span key={skill} className="text-xs text-gray-500">{skill}</span>
                                ))}
                              </div>
                              <span className="text-xs text-gray-400">|</span>
                              <span className="text-xs text-gray-500">
                                待办 {worker._count?.repairOrders || 0} 单
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

export default RepairOrderDetail;

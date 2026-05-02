import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save,
  CheckCircle,
  AlertTriangle,
  Upload
} from 'lucide-react';
import { patrolTasksAPI } from '../utils/api';
import dayjs from 'dayjs';

const STATUS_LABELS = {
  'pending': '待开始',
  'in_progress': '进行中',
  'completed': '已完成'
};

function PatrolTaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    try {
      setLoading(true);
      const response = await patrolTasksAPI.getById(id);
      setTask(response.data);
    } catch (error) {
      console.error('加载巡检任务失败:', error);
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = async (itemId, field, value) => {
    try {
      const data = {
        ...task.items.find(i => i.id === itemId),
        [field]: value
      };
      await patrolTasksAPI.updateItem(itemId, data);
      
      setTask(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === itemId ? { ...item, [field]: value } : item
        )
      }));
    } catch (error) {
      alert(error.message || '保存失败');
    }
  };

  const handleComplete = async () => {
    if (!window.confirm('确定要完成本次巡检吗？如有异常将自动生成维修单。')) {
      return;
    }
    
    try {
      setSaving(true);
      const response = await patrolTasksAPI.complete(id);
      alert(response.data.message || '巡检完成');
      navigate('/patrol-tasks');
    } catch (error) {
      alert(error.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">巡检任务不存在</p>
        <Link to="/patrol-tasks" className="text-primary-600 hover:underline mt-4 inline-block">
          返回列表
        </Link>
      </div>
    );
  }

  const isEditable = task.status === 'in_progress';
  const hasAbnormal = task.items?.some(item => item.isAbnormal);

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
          <h1 className="text-2xl font-bold text-gray-900">{task.name}</h1>
          <div className="flex items-center gap-4 mt-2">
            <span className={`badge ${
              task.status === 'completed' 
                ? 'bg-green-100 text-green-700' 
                : task.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-amber-100 text-amber-700'
            }`}>
              {STATUS_LABELS[task.status]}
            </span>
            <span className="text-sm text-gray-500">
              {task.device?.building?.name} - {task.device?.name}
            </span>
            {hasAbnormal && (
              <span className="text-red-600 flex items-center gap-1 text-sm">
                <AlertTriangle size={14} /> 存在异常项
              </span>
            )}
          </div>
        </div>
      </div>

      {task.items?.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <p className="text-gray-500">该巡检任务没有检查项</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {task.items.map((item, index) => (
            <div key={item.id} className="card">
              <div className="card-body">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <span className="text-gray-400">#{index + 1}</span>
                      {item.checkItem?.name}
                    </h3>
                    {item.checkItem?.description && (
                      <p className="text-sm text-gray-500 mt-1">
                        {item.checkItem.description}
                      </p>
                    )}
                  </div>
                  {isEditable && (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.isAbnormal}
                          onChange={(e) => handleItemChange(item.id, 'isAbnormal', e.target.checked)}
                          className="w-4 h-4 text-red-600 rounded"
                        />
                        <span className="text-sm text-red-600">标记异常</span>
                      </label>
                    </div>
                  )}
                  {!isEditable && item.isAbnormal && (
                    <span className="badge bg-red-100 text-red-700">
                      异常
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">检查结果</label>
                    {isEditable ? (
                      <input
                        type="text"
                        className="input"
                        placeholder="如：正常、异常、待维修等"
                        value={item.result || ''}
                        onChange={(e) => handleItemChange(item.id, 'result', e.target.value)}
                      />
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        {item.result || '-'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="label">备注</label>
                    {isEditable ? (
                      <textarea
                        className="input h-20 resize-none"
                        placeholder="添加备注说明"
                        value={item.notes || ''}
                        onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                      />
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-lg min-h-20">
                        {item.notes || '-'}
                      </div>
                    )}
                  </div>
                </div>

                {item.photoUrls?.length > 0 && (
                  <div className="mt-4">
                    <label className="label">照片</label>
                    <div className="flex gap-2 flex-wrap">
                      {item.photoUrls.map((url, idx) => (
                        <a 
                          key={idx} 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 bg-gray-100 rounded-lg text-sm text-primary-600 hover:underline"
                        >
                          照片 {idx + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {isEditable && (
                  <div className="mt-4">
                    <label className="label">照片链接 (逗号分隔)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg"
                      value={item.photoUrls?.join(', ') || ''}
                      onChange={(e) => {
                        const urls = e.target.value.split(',').map(u => u.trim()).filter(u => u);
                        handleItemChange(item.id, 'photoUrls', urls);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isEditable && (
        <div className="card">
          <div className="card-body flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                完成巡检后，如有异常项将自动生成维修单
              </p>
              {hasAbnormal && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={14} /> 
                  当前有 {task.items.filter(i => i.isAbnormal).length} 个异常项，完成后将生成维修单
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Link to="/patrol-tasks" className="btn btn-secondary">
                返回列表
              </Link>
              <button 
                onClick={handleComplete}
                disabled={saving}
                className="btn btn-primary flex items-center gap-1"
              >
                <CheckCircle size={16} />
                {saving ? '处理中...' : '完成巡检'}
              </button>
            </div>
          </div>
        </div>
      )}

      {task.status === 'completed' && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <p className="font-medium text-gray-900">巡检已完成</p>
                <p className="text-sm text-gray-500">
                  完成时间: {task.completedAt ? dayjs(task.completedAt).format('YYYY-MM-DD HH:mm') : '-'}
                </p>
                {task.repairOrders?.length > 0 && (
                  <p className="text-sm text-amber-600 mt-1">
                    已生成 {task.repairOrders.length} 个维修单
                  </p>
                )}
              </div>
              <div className="ml-auto">
                <Link to="/patrol-tasks" className="btn btn-secondary">
                  返回列表
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PatrolTaskDetail;

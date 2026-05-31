import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { Task, TaskStatus, TaskSource, TaskStatusLabels, TaskSourceLabels } from '../types';

interface FormData {
  title: string;
  source: TaskSource;
  sourceDetail: string;
  status: TaskStatus;
  pendingReason: string;
  assignee: string;
  description: string;
  trainingLog: string;
  evaluation: string;
}

const initialFormData: FormData = {
  title: '',
  source: 'online_feedback',
  sourceDetail: '',
  status: 'pending',
  pendingReason: '',
  assignee: '',
  description: '',
  trainingLog: '',
  evaluation: '',
};

export function TaskForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addTask, updateTask, getTaskById } = useTaskStore();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [changeReason, setChangeReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!id;
  const task = isEditing ? getTaskById(id) : null;

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        source: task.source,
        sourceDetail: task.sourceDetail,
        status: task.status,
        pendingReason: task.pendingReason,
        assignee: task.assignee,
        description: task.description,
        trainingLog: task.trainingLog,
        evaluation: task.evaluation,
      });
    }
  }, [task]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) {
      newErrors.title = '请输入任务标题';
    }
    if (!formData.assignee.trim()) {
      newErrors.assignee = '请输入负责人';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing && task) {
      const updates: Partial<Task> = {};
      (Object.keys(formData) as (keyof FormData)[]).forEach((key) => {
        if (formData[key] !== task[key]) {
          (updates as any)[key] = formData[key];
        }
      });
      updateTask(task.id, updates, changeReason);
    } else {
      addTask(formData);
    }

    navigate('/');
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  if (isEditing && !task) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">任务不存在</h2>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate(isEditing ? `/tasks/${id}` : '/')}
          className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {isEditing ? '返回详情' : '返回列表'}
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditing ? '编辑任务' : '新建任务'}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEditing ? '修改训练任务信息' : '创建新的训练任务'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              任务标题 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="例如：用户反馈模型识别率低 - 图像分类任务"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.title ? 'border-rose-500' : 'border-gray-200'
              }`}
            />
            {errors.title && (
              <p className="text-rose-500 text-sm mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">来源类型</label>
            <select
              value={formData.source}
              onChange={(e) => handleChange('source', e.target.value as TaskSource)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {Object.entries(TaskSourceLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">当前状态</label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value as TaskStatus)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {Object.entries(TaskStatusLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">来源详情</label>
            <input
              type="text"
              value={formData.sourceDetail}
              onChange={(e) => handleChange('sourceDetail', e.target.value)}
              placeholder="例如：客服工单 #20240528-001"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              负责人 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.assignee}
              onChange={(e) => handleChange('assignee', e.target.value)}
              placeholder="例如：张工"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                errors.assignee ? 'border-rose-500' : 'border-gray-200'
              }`}
            />
            {errors.assignee && (
              <p className="text-rose-500 text-sm mt-1">{errors.assignee}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">待处理原因</label>
            <input
              type="text"
              value={formData.pendingReason}
              onChange={(e) => handleChange('pendingReason', e.target.value)}
              placeholder="如果是补材料任务，请在此说明：补材料：配置文件晚到，无实质修改"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              如果只是补材料（配置文件晚到等），请明确说明，避免误认为需要重新训练
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">任务描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="详细描述任务背景和目标..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">训练日志</label>
            <textarea
              value={formData.trainingLog}
              onChange={(e) => handleChange('trainingLog', e.target.value)}
              placeholder="粘贴训练日志内容..."
              rows={8}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm resize-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">评估说明</label>
            <textarea
              value={formData.evaluation}
              onChange={(e) => handleChange('evaluation', e.target.value)}
              placeholder="记录评估结论，确保与训练日志中的指标一致..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {isEditing && (
          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-1">修改原因</label>
            <input
              type="text"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="请说明修改原因，将记录在历史中"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              修改原因会记录在历史记录中，方便后续追溯
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => navigate(isEditing ? `/tasks/${id}` : '/')}
            className="px-6 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            {isEditing ? '保存修改' : '创建任务'}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Event, CreateEventDto, UpdateEventDto } from '@/types';
import { X } from 'lucide-react';
import dayjs from 'dayjs';

interface EventFormProps {
  event?: Event;
  onSubmit: (dto: CreateEventDto | UpdateEventDto) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function EventForm({ event, onSubmit, onCancel, isLoading }: EventFormProps) {
  const isEdit = !!event;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    maxParticipants: 100,
    status: 'draft' as 'draft' | 'active' | 'cancelled',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || '',
        startTime: dayjs(event.startTime).format('YYYY-MM-DDTHH:mm'),
        endTime: dayjs(event.endTime).format('YYYY-MM-DDTHH:mm'),
        maxParticipants: event.maxParticipants,
        status: event.status as 'draft' | 'active' | 'cancelled',
      });
    }
  }, [event]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = '请输入活动标题';
    }

    if (!formData.startTime) {
      newErrors.startTime = '请选择开始时间';
    }

    if (!formData.endTime) {
      newErrors.endTime = '请选择结束时间';
    }

    if (formData.startTime && formData.endTime) {
      if (dayjs(formData.startTime).isAfter(dayjs(formData.endTime))) {
        newErrors.endTime = '结束时间必须晚于开始时间';
      }
    }

    if (formData.maxParticipants < 0) {
      newErrors.maxParticipants = '人数不能为负数';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const dto: CreateEventDto | UpdateEventDto = {
      title: formData.title,
      description: formData.description || undefined,
      startTime: new Date(formData.startTime).toISOString(),
      endTime: new Date(formData.endTime).toISOString(),
      maxParticipants: formData.maxParticipants,
      ...(isEdit ? { status: formData.status } : {}),
    };

    await onSubmit(dto);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {isEdit ? '编辑活动' : '创建活动'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label-field">活动标题 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`input-field ${errors.title ? 'border-red-500' : ''}`}
              placeholder="请输入活动标题"
            />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="label-field">活动描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field h-24 resize-none"
              placeholder="请输入活动描述（可选）"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">开始时间 *</label>
              <input
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className={`input-field ${errors.startTime ? 'border-red-500' : ''}`}
              />
              {errors.startTime && <p className="text-red-500 text-sm mt-1">{errors.startTime}</p>}
            </div>

            <div>
              <label className="label-field">结束时间 *</label>
              <input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className={`input-field ${errors.endTime ? 'border-red-500' : ''}`}
              />
              {errors.endTime && <p className="text-red-500 text-sm mt-1">{errors.endTime}</p>}
            </div>
          </div>

          <div>
            <label className="label-field">最大参与人数 *</label>
            <input
              type="number"
              min="0"
              value={formData.maxParticipants}
              onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value, 10) || 0 })}
              className={`input-field ${errors.maxParticipants ? 'border-red-500' : ''}`}
            />
            {errors.maxParticipants && <p className="text-red-500 text-sm mt-1">{errors.maxParticipants}</p>}
          </div>

          {isEdit && (
            <div>
              <label className="label-field">状态</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'draft' | 'active' | 'cancelled' })}
                className="input-field"
              >
                <option value="draft">草稿</option>
                <option value="active">活跃</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              disabled={isLoading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
            >
              {isLoading ? '保存中...' : (isEdit ? '更新' : '创建')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

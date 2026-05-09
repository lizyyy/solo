import { useState } from 'react';
import { X } from 'lucide-react';
import { CreateRegistrationDto } from '@/types';

interface RegistrationFormProps {
  eventId: string;
  onSubmit: (dto: CreateRegistrationDto) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function RegistrationForm({ eventId, onSubmit, onCancel, isLoading }: RegistrationFormProps) {
  const [formData, setFormData] = useState({
    userName: '',
    userEmail: '',
    userPhone: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.userName.trim()) {
      newErrors.userName = '请输入姓名';
    }

    if (!formData.userEmail.trim()) {
      newErrors.userEmail = '请输入邮箱';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.userEmail)) {
      newErrors.userEmail = '请输入有效的邮箱地址';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      eventId,
      userId: '',
      userName: formData.userName,
      userEmail: formData.userEmail,
      userPhone: formData.userPhone || undefined,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">报名活动</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label-field">姓名 *</label>
            <input
              type="text"
              value={formData.userName}
              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              className={`input-field ${errors.userName ? 'border-red-500' : ''}`}
              placeholder="请输入姓名"
            />
            {errors.userName && <p className="text-red-500 text-sm mt-1">{errors.userName}</p>}
          </div>

          <div>
            <label className="label-field">邮箱 *</label>
            <input
              type="email"
              value={formData.userEmail}
              onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
              className={`input-field ${errors.userEmail ? 'border-red-500' : ''}`}
              placeholder="请输入邮箱"
            />
            {errors.userEmail && <p className="text-red-500 text-sm mt-1">{errors.userEmail}</p>}
          </div>

          <div>
            <label className="label-field">电话</label>
            <input
              type="tel"
              value={formData.userPhone}
              onChange={(e) => setFormData({ ...formData, userPhone: e.target.value })}
              className="input-field"
              placeholder="请输入电话（可选）"
            />
          </div>

          <div>
            <label className="label-field">备注</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-field h-20 resize-none"
              placeholder="备注信息（可选）"
            />
          </div>

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
              {isLoading ? '提交中...' : '确认报名'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

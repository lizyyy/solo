import React, { useState } from 'react';
import dayjs from 'dayjs';
import { careTasksAPI } from '../services/api';

const TASK_TYPES = [
  '体温监测',
  '血压监测',
  '输液',
  '给药',
  '伤口检查',
  '伤口换药',
  '隔离消毒',
  '喂食',
  '清理笼位',
  '出院评估',
  '抗病毒治疗',
  '止痛',
  '止吐'
];

function CreateTaskModal({ hospitalizationId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    task_type: '',
    scheduled_time: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [customTask, setCustomTask] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const taskType = formData.task_type === 'custom' ? customTask : formData.task_type;

    if (!taskType) {
      setError('请选择或输入任务类型');
      return;
    }
    if (!formData.scheduled_time) {
      setError('请选择计划时间');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await careTasksAPI.create({
        hospitalization_id: hospitalizationId,
        task_type: taskType,
        scheduled_time: new Date(formData.scheduled_time).toISOString(),
        notes: formData.notes
      });
      alert('护理任务已添加！');
      onSuccess();
      onClose();
    } catch (error) {
      setError(error.response?.data?.error || '添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>添加护理任务</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-danger">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>任务类型 *</label>
              <select
                value={formData.task_type}
                onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
              >
                <option value="">请选择任务类型</option>
                {TASK_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value="custom">自定义...</option>
              </select>
            </div>

            {formData.task_type === 'custom' && (
              <div className="form-group">
                <label>自定义任务类型</label>
                <input
                  type="text"
                  value={customTask}
                  onChange={(e) => setCustomTask(e.target.value)}
                  placeholder="请输入任务类型"
                />
              </div>
            )}

            <div className="form-group">
              <label>计划时间 *</label>
              <input
                type="datetime-local"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>备注</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="任务备注..."
              />
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '添加中...' : '添加任务'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateTaskModal;

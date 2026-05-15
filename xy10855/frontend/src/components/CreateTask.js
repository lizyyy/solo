import React, { useState, useEffect } from 'react';
import { taskAPI } from '../api';

function CreateTask({ onSuccess, onCancel }) {
  const [templates, setTemplates] = useState([]);
  const [formData, setFormData] = useState({
    templateId: '',
    taskName: '',
    parameters: '{\n  "startDate": "2024-01-01",\n  "endDate": "2024-12-31",\n  "format": "xlsx"\n}'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await taskAPI.templates();
      setTemplates(res.data.data);
      if (res.data.data.length > 0) {
        setFormData(prev => ({ ...prev, templateId: res.data.data[0].id }));
      }
    } catch (err) {
      console.error('加载模板失败:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const params = JSON.parse(formData.parameters);
      const res = await taskAPI.create({
        templateId: formData.templateId,
        taskName: formData.taskName,
        parameters: params,
        createdBy: 'web_user'
      });
      alert(res.data.data.isNew ? '任务创建成功！' : '检测到相同参数任务，已复用现有任务');
      onSuccess && onSuccess();
    } catch (err) {
      if (err.message.includes('JSON')) {
        alert('参数格式错误，请输入有效的JSON');
      } else {
        alert('创建任务失败: ' + err.response?.data?.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>创建新任务</h3>
          <button style={styles.closeButton} onClick={onCancel}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>选择模板 *</label>
            <select
              style={styles.select}
              value={formData.templateId}
              onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
              required
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>任务名称 *</label>
            <input
              style={styles.input}
              placeholder="请输入任务名称"
              value={formData.taskName}
              onChange={(e) => setFormData({ ...formData, taskName: e.target.value })}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>参数配置 (JSON) *</label>
            <textarea
              style={styles.textarea}
              value={formData.parameters}
              onChange={(e) => setFormData({ ...formData, parameters: e.target.value })}
              rows={6}
              required
            />
          </div>

          <div style={styles.formActions}>
            <button type="button" style={styles.cancelButton} onClick={onCancel}>取消</button>
            <button type="submit" style={styles.submitButton} disabled={loading}>
              {loading ? '创建中...' : '创建任务'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #f0f0f0'
  },
  modalTitle: { margin: 0, fontSize: '18px' },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#999'
  },
  form: { padding: '20px' },
  formGroup: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', color: '#333' },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: 'white'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'monospace',
    resize: 'vertical'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px'
  },
  cancelButton: {
    padding: '10px 20px',
    border: '1px solid #d9d9d9',
    backgroundColor: 'white',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  submitButton: {
    padding: '10px 20px',
    border: 'none',
    backgroundColor: '#1890ff',
    color: 'white',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default CreateTask;

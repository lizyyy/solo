import React, { useState, useEffect } from 'react';
import { taskAPI } from '../api';

const defaultTasks = `[
  {
    "templateId": "tpl-001",
    "taskName": "批量任务-销售报表-A",
    "parameters": {
      "region": "华北",
      "startDate": "2024-01-01",
      "endDate": "2024-06-30"
    }
  },
  {
    "templateId": "tpl-001",
    "taskName": "批量任务-销售报表-B",
    "parameters": {
      "region": "华东",
      "startDate": "2024-01-01",
      "endDate": "2024-06-30"
    }
  },
  {
    "templateId": "tpl-002",
    "taskName": "批量任务-用户分析",
    "parameters": {
      "userType": "VIP",
      "includeInactive": false
    }
  }
]`;

function BatchImport({ onSuccess, onCancel }) {
  const [tasksJson, setTasksJson] = useState(defaultTasks);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const tasks = JSON.parse(tasksJson);
      const res = await taskAPI.batchImport({ tasks, createdBy: 'web_user' });
      setResult(res.data.data);
      setTimeout(() => {
        onSuccess && onSuccess();
      }, 2000);
    } catch (err) {
      if (err.message.includes('JSON')) {
        alert('JSON格式错误，请检查输入');
      } else {
        alert('批量导入失败: ' + err.response?.data?.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>批量导入任务</h3>
          <button style={styles.closeButton} onClick={onCancel}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>任务列表 (JSON数组) *</label>
            <textarea
              style={styles.textarea}
              value={tasksJson}
              onChange={(e) => setTasksJson(e.target.value)}
              rows={16}
              required
            />
          </div>

          {result && (
            <div style={styles.result}>
              <div style={styles.resultSummary}>
                <span style={styles.successCount}>✅ 成功: {result.successCount}</span>
                <span style={styles.failedCount}>❌ 失败: {result.failedCount}</span>
              </div>
              <div style={styles.resultList}>
                {result.results.map((r, i) => (
                  <div key={i} style={{...styles.resultItem, backgroundColor: r.success ? '#f6ffed' : '#fff2f0'}}>
                    <span>{r.success ? '✅' : '❌'} {r.taskData.taskName}</span>
                    {r.error && <span style={styles.resultError}>{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={styles.formActions}>
            <button type="button" style={styles.cancelButton} onClick={onCancel}>取消</button>
            <button type="submit" style={styles.submitButton} disabled={loading}>
              {loading ? '导入中...' : '开始导入'}
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
    maxWidth: '600px',
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
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    resize: 'vertical'
  },
  result: {
    backgroundColor: '#fafafa',
    borderRadius: '4px',
    padding: '16px',
    marginBottom: '16px'
  },
  resultSummary: {
    display: 'flex',
    gap: '20px',
    marginBottom: '12px',
    fontSize: '14px',
    fontWeight: '500'
  },
  successCount: { color: '#52c41a' },
  failedCount: { color: '#ff4d4f' },
  resultList: { maxHeight: '150px', overflow: 'auto' },
  resultItem: {
    padding: '8px 12px',
    marginBottom: '4px',
    borderRadius: '4px',
    fontSize: '13px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  resultError: { fontSize: '12px', color: '#ff4d4f' },
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
    backgroundColor: '#52c41a',
    color: 'white',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default BatchImport;

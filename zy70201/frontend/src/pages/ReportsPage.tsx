import { useEffect, useState } from 'react';
import { reportApi, taskApi } from '../services/api';
import type { Report, Task } from '../types';

function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [reportsRes, tasksRes] = await Promise.all([
        reportApi.getAll(),
        taskApi.getAll()
      ]);
      
      setReports(reportsRes.data.data);
      setCompletedTasks(tasksRes.data.data.filter(t => t.status === 'COMPLETED' && !t.report));
    } catch (error: any) {
      setAlert({ type: 'error', message: '加载数据失败: ' + (error.response?.data?.message || error.message) });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      taskId: formData.get('taskId') as string,
      reporter: formData.get('reporter') as string,
      snowThicknessBefore: parseInt(formData.get('snowThicknessBefore') as string),
      snowThicknessAfter: parseInt(formData.get('snowThicknessAfter') as string),
      qualityScore: parseInt(formData.get('qualityScore') as string),
      issues: formData.get('issues') as string,
      remarks: formData.get('remarks') as string
    };

    try {
      await reportApi.create(data);
      setAlert({ type: 'success', message: '报告创建成功' });
      setShowCreateModal(false);
      loadData();
    } catch (error: any) {
      setAlert({ type: 'error', message: '创建失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleApprove(reportId: string) {
    const approver = prompt('请输入审核人姓名：');
    if (!approver?.trim()) return;

    try {
      await reportApi.approve(reportId, approver.trim());
      setAlert({ type: 'success', message: '报告审核通过' });
      loadData();
    } catch (error: any) {
      setAlert({ type: 'error', message: '审核失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleExport(format: 'json' | 'excel') {
    try {
      const res = await reportApi.export(format);
      
      if (format === 'excel') {
        const blob = new Blob([res.data], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reports-${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        console.log('JSON数据:', res.data);
        alert('JSON数据已输出到控制台');
      }
      
      setAlert({ type: 'success', message: '导出成功' });
    } catch (error: any) {
      setAlert({ type: 'error', message: '导出失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">作业报告</h1>
        <div className="action-buttons">
          {completedTasks.length > 0 && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              + 新增报告
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => handleExport('json')}>
            导出JSON
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('excel')}>
            导出Excel
          </button>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="alert alert-success">
          💡 有 {completedTasks.length} 个已完成的任务尚未生成作业报告，请及时创建报告。
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>雪道</th>
                  <th>车辆</th>
                  <th>报告人</th>
                  <th>报告时间</th>
                  <th>厚度变化</th>
                  <th>质量评分</th>
                  <th>遇到的问题</th>
                  <th>审核状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr key={report.id}>
                    <td>{report.task?.slope?.name}</td>
                    <td>{report.task?.vehicle?.name}</td>
                    <td>{report.reporter}</td>
                    <td>{new Date(report.reportTime).toLocaleString('zh-CN')}</td>
                    <td>
                      {report.snowThicknessBefore}cm → {report.snowThicknessAfter}cm
                    </td>
                    <td>
                      <strong>{report.qualityScore}/10</strong>
                    </td>
                    <td style={{ maxWidth: '200px' }}>
                      {report.issues || '-'}
                    </td>
                    <td>
                      <span className="badge" style={{ 
                        backgroundColor: report.isApproved ? '#ecfdf5' : '#f3f4f6',
                        color: report.isApproved ? '#065f46' : '#374151'
                      }}>
                        {report.isApproved ? '已审核' : '待审核'}
                      </span>
                      {report.isApproved && report.approver && (
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          {report.approver}
                        </div>
                      )}
                    </td>
                    <td>
                      {!report.isApproved && (
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={() => handleApprove(report.id)}
                        >
                          审核通过
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateReportModal
          tasks={completedTasks}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateReport}
        />
      )}
    </div>
  );
}

function CreateReportModal({ tasks, onClose, onSubmit }: {
  tasks: Task[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">新增作业报告</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">选择已完成的任务</label>
              <select 
                name="taskId" 
                className="form-select" 
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                required
              >
                <option value="">请选择任务</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>
                    {task.slope?.name} - {task.vehicle?.name}
                    ({new Date(task.actualEndTime!).toLocaleDateString('zh-CN')})
                  </option>
                ))}
              </select>
            </div>

            {selectedTask && (
              <div className="card" style={{ marginBottom: '16px', boxShadow: 'none', border: '1px solid #e5e7eb' }}>
                <div className="card-body" style={{ padding: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                    <div><strong>雪道：</strong>{selectedTask.slope?.name}</div>
                    <div><strong>车辆：</strong>{selectedTask.vehicle?.name}</div>
                    <div><strong>完成时间：</strong>{new Date(selectedTask.actualEndTime!).toLocaleString('zh-CN')}</div>
                    <div><strong>作业后厚度：</strong>{selectedTask.snowThicknessAfter}cm</div>
                    <div><strong>质量评分：</strong>{selectedTask.qualityScore}/10</div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">报告人</label>
              <input 
                type="text" 
                name="reporter" 
                className="form-input" 
                placeholder="请输入报告人姓名"
                required
              />
            </div>

            {selectedTask && (
              <>
                <input 
                  type="hidden" 
                  name="snowThicknessBefore" 
                  value={selectedTask.snowThicknessBefore}
                />
                <input 
                  type="hidden" 
                  name="snowThicknessAfter" 
                  value={selectedTask.snowThicknessAfter}
                />
                <input 
                  type="hidden" 
                  name="qualityScore" 
                  value={selectedTask.qualityScore}
                />
              </>
            )}
            
            <div className="form-group">
              <label className="form-label">遇到的问题</label>
              <textarea 
                name="issues" 
                className="form-textarea" 
                rows={3}
                placeholder="请描述作业过程中遇到的问题（如无问题请填写'无'）"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">备注</label>
              <textarea 
                name="remarks" 
                className="form-textarea" 
                rows={2}
                placeholder="其他补充说明（可选）"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">创建报告</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportsPage;

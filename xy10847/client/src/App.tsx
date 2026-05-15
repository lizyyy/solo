import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { taskApi } from './api';
import type { AudioTask, TaskDetail, CreateTaskRequest, TaskStatus } from './types';

const statusLabelMap: Record<TaskStatus, string> = {
  pending: '等待中',
  transcribing: '转写中',
  transcribed: '转写完成',
  callback_pending: '等待回调',
  callback_failed: '回调失败',
  completed: '已完成',
  failed: '失败'
};

const stageNameMap: Record<string, string> = {
  audio_analysis: '音频分析',
  speech_recognition: '语音识别',
  text_processing: '文本处理'
};

function App() {
  const [tasks, setTasks] = useState<AudioTask[]>([]);
  const [failedTasks, setFailedTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<CreateTaskRequest>({
    audio_url: 'https://example.com/audio/demo.mp3',
    file_name: '演示音频.mp3',
    audio_duration: 120,
    callback_url: 'https://api.example.com/webhook',
    secret_key: 'demo_secret'
  });
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    const [tasksRes, failedRes] = await Promise.all([
      taskApi.list(),
      taskApi.getFailed()
    ]);
    setTasks(tasksRes.data);
    setFailedTasks(failedRes.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTask = async () => {
    setLoading(true);
    try {
      await taskApi.create(newTask);
      await loadData();
    } catch (error) {
      console.error('创建任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (taskId: string) => {
    try {
      const res = await taskApi.getDetail(taskId);
      setSelectedTask(res.data);
      setShowModal(true);
    } catch (error) {
      console.error('获取详情失败:', error);
    }
  };

  const handleRetry = async (taskId: string) => {
    setLoading(true);
    try {
      await taskApi.retry(taskId);
      await loadData();
      if (selectedTask?.id === taskId) {
        const res = await taskApi.getDetail(taskId);
        setSelectedTask(res.data);
      }
    } catch (error) {
      console.error('重试失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (taskId: string, format: 'json' | 'csv') => {
    try {
      const res = format === 'json' 
        ? await taskApi.export(taskId)
        : await taskApi.exportCsv(taskId);
      window.open(`http://localhost:3001${res.data.download_url}`, '_blank');
      setShowExportMenu(null);
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  const stats = {
    total: tasks.length,
    processing: tasks.filter(t => t.status === 'transcribing').length,
    failed: failedTasks.length,
    completed: tasks.filter(t => t.status === 'completed').length
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎙️ 语音转写回调台</h1>
        <p>管理音频转写任务，监控回调状态，处理异常重试</p>
      </header>

      <div className="app-content">
        <div className="dashboard-stats">
          <div className="stat-card info">
            <h3>总任务数</h3>
            <div className="value">{stats.total}</div>
          </div>
          <div className="stat-card warning">
            <h3>转写中</h3>
            <div className="value">{stats.processing}</div>
          </div>
          <div className="stat-card error">
            <h3>回调失败</h3>
            <div className="value">{stats.failed}</div>
          </div>
          <div className="stat-card success">
            <h3>已完成</h3>
            <div className="value">{stats.completed}</div>
          </div>
        </div>

        <div className="create-task-form">
          <h2 className="section-title">创建新任务</h2>
          <div className="form-row">
            <div className="form-group">
              <label>音频URL</label>
              <input 
                value={newTask.audio_url}
                onChange={e => setNewTask({ ...newTask, audio_url: e.target.value })}
                placeholder="输入音频文件URL"
              />
            </div>
            <div className="form-group">
              <label>文件名</label>
              <input 
                value={newTask.file_name || ''}
                onChange={e => setNewTask({ ...newTask, file_name: e.target.value })}
                placeholder="输入文件名"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>回调URL</label>
              <input 
                value={newTask.callback_url}
                onChange={e => setNewTask({ ...newTask, callback_url: e.target.value })}
                placeholder="输入回调接口地址"
              />
            </div>
            <div className="form-group">
              <label>签名密钥</label>
              <input 
                value={newTask.secret_key || ''}
                onChange={e => setNewTask({ ...newTask, secret_key: e.target.value })}
                placeholder="输入签名密钥（可选）"
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCreateTask} disabled={loading}>
              {loading ? '创建中...' : '创建转写任务'}
            </button>
          </div>
        </div>

        {failedTasks.length > 0 && (
          <div className="failed-queue-section">
            <h2 className="section-title">⚠️ 异常队列 - 需人工处理</h2>
            {failedTasks.map(task => (
              <div key={task.id} className="task-row">
                <div className="task-header">
                  <span className="task-title">{task.file_name || task.id}</span>
                  <span className={`status-badge status-${task.status}`}>
                    {statusLabelMap[task.status]}
                  </span>
                </div>
                <div className="task-info">
                  <span>重试次数: {task.retry_count}/{task.max_retries}</span>
                  <span>最后错误: {task.last_error || '未知'}</span>
                  <span>创建时间: {dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
                </div>
                <div className="task-actions">
                  <button className="btn btn-danger" onClick={() => handleRetry(task.id)} disabled={loading}>
                    立即重试
                  </button>
                  <button className="btn btn-default" onClick={() => handleViewDetail(task.id)}>
                    查看详情
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="task-list-section">
          <h2 className="section-title">任务列表</h2>
          {tasks.length === 0 ? (
            <div className="empty-state">暂无任务，点击上方创建新任务开始演示</div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="task-row" onClick={() => handleViewDetail(task.id)}>
                <div className="task-header">
                  <span className="task-title">{task.file_name || task.id}</span>
                  <span className={`status-badge status-${task.status}`}>
                    {statusLabelMap[task.status]}
                  </span>
                </div>
                <div className="task-info">
                  <span>创建时间: {dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
                  {task.audio_duration && (
                    <span>时长: {Math.floor(task.audio_duration / 60)}分{task.audio_duration % 60}秒</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && selectedTask && (
        <div className="task-detail-modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>任务详情 - {selectedTask.file_name || selectedTask.id}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h3>基本信息</h3>
                <div className="callback-info">
                  <div className="callback-info-item">
                    <label>当前状态</label>
                    <span className={`status-badge status-${selectedTask.status}`}>
                      {statusLabelMap[selectedTask.status]}
                    </span>
                  </div>
                  <div className="callback-info-item">
                    <label>创建时间</label>
                    <value>{dayjs(selectedTask.created_at).format('YYYY-MM-DD HH:mm:ss')}</value>
                  </div>
                  <div className="callback-info-item">
                    <label>回调地址</label>
                    <value style={{ fontSize: '12px' }}>{selectedTask.callback_target?.target_url}</value>
                  </div>
                  <div className="callback-info-item">
                    <label>重试次数</label>
                    <value>{selectedTask.callback_target?.retry_count || 0} 次</value>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>转写阶段进度</h3>
                {selectedTask.stages?.map(stage => (
                  <div key={stage.id} className="stage-progress">
                    <span className="stage-name">{stageNameMap[stage.stage_name] || stage.stage_name}</span>
                    <div className="stage-progress-bar">
                      <div 
                        className={`fill ${stage.status}`}
                        style={{ width: `${stage.progress}%` }}
                      />
                    </div>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {stage.status === 'completed' ? '已完成' : stage.status === 'processing' ? '处理中' : '等待中'}
                    </span>
                  </div>
                ))}
              </div>

              {selectedTask.fragments?.length > 0 && (
                <div className="detail-section">
                  <h3>转写结果（{selectedTask.fragments.length} 段）</h3>
                  {selectedTask.fragments.map(frag => (
                    <div key={frag.id} className="fragment-item">
                      <div>
                        <span className="fragment-speaker">{frag.speaker || '未知'}</span>
                        <span className="fragment-time">{frag.start_time}s - {frag.end_time}s</span>
                      </div>
                      <div className="fragment-content">{frag.content}</div>
                      {frag.confidence && (
                        <div className="fragment-confidence">置信度: {(frag.confidence * 100).toFixed(1)}%</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedTask.failures?.length > 0 && (
                <div className="detail-section">
                  <h3>失败记录（{selectedTask.failures.length} 次）</h3>
                  {selectedTask.failures.map(fail => (
                    <div key={fail.id} className="failure-item">
                      <div className="failure-stage">
                        {stageNameMap[fail.stage] || fail.stage} - {fail.error_code || '未知错误'}
                      </div>
                      <div className="failure-error">{fail.error_message}</div>
                      <div className="failure-node">
                        责任节点: {fail.responsibility_node || '未知'} | {dayjs(fail.created_at).format('HH:mm:ss')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedTask.retries?.length > 0 && (
                <div className="detail-section">
                  <h3>重试记录（{selectedTask.retries.length} 次）</h3>
                  {selectedTask.retries.map(retry => (
                    <div key={retry.id} className="retry-item">
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#fa8c16' }}>
                        第 {retry.retry_number} 次重试
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                        状态: {retry.status === 'success' ? '成功' : retry.status === 'failed' ? '失败' : '处理中'} | 
                        {dayjs(retry.created_at).format('YYYY-MM-DD HH:mm:ss')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="detail-section">
                <h3>状态历史</h3>
                <div className="history-timeline">
                  {selectedTask.history?.map(h => (
                    <div key={h.id} className="history-item">
                      <div className="history-time">{dayjs(h.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                      <div className="history-content">
                        {h.from_status && <span>{statusLabelMap[h.from_status as TaskStatus]} → </span>}
                        <strong>{statusLabelMap[h.to_status as TaskStatus]}</strong>
                        {h.remark && <span style={{ color: '#666', marginLeft: 8 }}>({h.remark})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                {(selectedTask.status === 'callback_failed' || selectedTask.status === 'failed') && (
                  <button className="btn btn-danger" onClick={() => handleRetry(selectedTask.id)} disabled={loading}>
                    重试回调
                  </button>
                )}
                <div className="export-dropdown">
                  <button className="btn btn-primary" onClick={() => setShowExportMenu(showExportMenu ? null : selectedTask.id)}>
                    导出数据 ▾
                  </button>
                  {showExportMenu === selectedTask.id && (
                    <div className="export-menu">
                      <button onClick={() => handleExport(selectedTask.id, 'json')}>导出 JSON</button>
                      <button onClick={() => handleExport(selectedTask.id, 'csv')}>导出 CSV</button>
                    </div>
                  )}
                </div>
                <button className="btn btn-default" onClick={() => setShowModal(false)}>关闭</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

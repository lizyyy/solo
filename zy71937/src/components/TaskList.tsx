import React from 'react';
import { useApp } from '../context/AppContext';
import { DisplayTask } from '../types';
import { getStatusLabel, getStatusColor, getDepartmentLabel, formatDate } from '../utils/helpers';

interface TaskListProps {
  onSelectTask: (task: DisplayTask) => void;
}

const TaskList: React.FC<TaskListProps> = ({ onSelectTask }) => {
  const { state, getFilteredTasks } = useApp();
  const tasks = getFilteredTasks();

  const getUnresolvedAnomalies = (task: DisplayTask) => {
    return task.anomalies.filter(a => !a.isResolved).length;
  };

  return (
    <div className="task-list-container">
      <div className="list-header">
        <h2>陈列任务列表</h2>
        <span className="task-count">共 {tasks.length} 条记录</span>
      </div>
      
      <div className="task-table-wrapper">
        <table className="task-table">
          <thead>
            <tr>
              <th>任务名称</th>
              <th>季节/年份</th>
              <th>部门</th>
              <th>SKU数量</th>
              <th>异常</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => {
              const unresolvedCount = getUnresolvedAnomalies(task);
              return (
                <tr 
                  key={task.id}
                  className={`task-row ${unresolvedCount > 0 ? 'has-anomaly' : ''} ${state.selectedTaskId === task.id ? 'selected' : ''}`}
                  onClick={() => onSelectTask(task)}
                >
                  <td>
                    <div className="task-name">{task.name}</div>
                    <div className="task-creator">创建人: {task.createdBy}</div>
                  </td>
                  <td>{task.season} {task.year}</td>
                  <td>{getDepartmentLabel(task.department)}</td>
                  <td>{task.items.length}</td>
                  <td>
                    {unresolvedCount > 0 ? (
                      <span className="anomaly-badge">
                        {unresolvedCount} 待确认
                      </span>
                    ) : (
                      <span className="no-anomaly">正常</span>
                    )}
                  </td>
                  <td>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(task.status) }}
                    >
                      {getStatusLabel(task.status)}
                    </span>
                  </td>
                  <td>{formatDate(task.updatedAt)}</td>
                  <td>
                    <button 
                      className="btn btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTask(task);
                      }}
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {tasks.length === 0 && (
          <div className="empty-state">
            暂无符合条件的任务记录
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;

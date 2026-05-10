import { useEffect, useState } from 'react';
import { slopeApi, vehicleApi, taskApi } from '../services/api';
import type { Slope, Vehicle, Task } from '../types';
import { taskStatusLabels, vehicleStatusLabels } from '../types';

function DashboardPage() {
  const [slopes, setSlopes] = useState<Slope[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [slopesRes, vehiclesRes, tasksRes] = await Promise.all([
        slopeApi.getAll(),
        vehicleApi.getAll(),
        taskApi.getAll()
      ]);
      
      setSlopes(slopesRes.data.data);
      setVehicles(vehiclesRes.data.data);
      setTasks(tasksRes.data.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  const stats = {
    totalSlopes: slopes.length,
    slopesNeedingGrooming: slopes.filter(s => s.currentSnowThickness < s.minSnowThickness).length,
    availableVehicles: vehicles.filter(v => v.status === 'AVAILABLE').length,
    totalVehicles: vehicles.length,
    pendingTasks: tasks.filter(t => ['PENDING_ASSIGNMENT', 'PENDING_EXECUTION'].includes(t.status)).length,
    inProgressTasks: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    completedToday: tasks.filter(t => {
      const today = new Date().toDateString();
      return t.status === 'COMPLETED' && new Date(t.actualEndTime!).toDateString() === today;
    }).length
  };

  return (
    <div>
      <h1 className="page-title">总览</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">雪道总数</div>
          <div className="stat-value">{stats.totalSlopes}</div>
          <div className="stat-trend" style={{ color: stats.slopesNeedingGrooming > 0 ? '#ef4444' : '#10b981' }}>
            {stats.slopesNeedingGrooming > 0 ? `${stats.slopesNeedingGrooming} 条需要压雪` : '全部达标'}
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-title">可用压雪车</div>
          <div className="stat-value">{stats.availableVehicles}/{stats.totalVehicles}</div>
          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: `${(stats.availableVehicles / stats.totalVehicles) * 100}%`,
                backgroundColor: stats.availableVehicles > 0 ? '#10b981' : '#ef4444'
              }}
            />
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-title">待执行任务</div>
          <div className="stat-value">{stats.pendingTasks}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-title">进行中任务</div>
          <div className="stat-value">{stats.inProgressTasks}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-title">今日已完成</div>
          <div className="stat-value">{stats.completedToday}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">雪道积雪状态</div>
        <div className="card-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>雪道名称</th>
                  <th>难度</th>
                  <th>开放窗口</th>
                  <th>当前厚度</th>
                  <th>最小要求</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {slopes.map(slope => {
                  const needsGrooming = slope.currentSnowThickness < slope.minSnowThickness;
                  const progress = Math.min(100, (slope.currentSnowThickness / slope.targetSnowThickness) * 100);
                  
                  return (
                    <tr key={slope.id}>
                      <td>{slope.name}</td>
                      <td>
                        <span className="badge" style={{ 
                          backgroundColor: getDifficultyColor(slope.difficulty),
                          color: 'white'
                        }}>
                          {slope.difficulty}
                        </span>
                      </td>
                      <td>{slope.openWindowStart} - {slope.openWindowEnd}</td>
                      <td>
                        <strong>{slope.currentSnowThickness}cm</strong>
                        <div className="progress-bar" style={{ marginTop: 4 }}>
                          <div 
                            className="progress-bar-fill" 
                            style={{ 
                              width: `${progress}%`,
                              backgroundColor: needsGrooming ? '#ef4444' : '#10b981'
                            }}
                          />
                        </div>
                      </td>
                      <td>{slope.minSnowThickness}cm</td>
                      <td>
                        <span className="badge" style={{ 
                          backgroundColor: needsGrooming ? '#fef2f2' : '#ecfdf5',
                          color: needsGrooming ? '#991b1b' : '#065f46',
                          border: `1px solid ${needsGrooming ? '#fecaca' : '#a7f3d0'}`
                        }}>
                          {needsGrooming ? '需要压雪' : '达标'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">车辆状态</div>
        <div className="card-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>车辆名称</th>
                  <th>型号</th>
                  <th>每小时作业能力</th>
                  <th>当前位置</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map(vehicle => (
                  <tr key={vehicle.id}>
                    <td>{vehicle.name}</td>
                    <td>{vehicle.model}</td>
                    <td>{vehicle.capacityPerHour.toLocaleString()} ㎡/h</td>
                    <td>{vehicle.currentLocation}</td>
                    <td>
                      <span className="badge" style={{ 
                        backgroundColor: getVehicleStatusBgColor(vehicle.status),
                        color: getVehicleStatusTextColor(vehicle.status)
                      }}>
                        {vehicleStatusLabels[vehicle.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">近期任务</div>
        <div className="card-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>雪道</th>
                  <th>车辆</th>
                  <th>计划时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, 10).map(task => (
                  <tr key={task.id}>
                    <td>{task.slope?.name}</td>
                    <td>{task.vehicle?.name || '未分配'}</td>
                    <td>
                      {new Date(task.scheduledStartTime).toLocaleString('zh-CN')}
                    </td>
                    <td>
                      <span className="badge" style={{ 
                        backgroundColor: getTaskStatusBgColor(task.status),
                        color: getTaskStatusTextColor(task.status)
                      }}>
                        {taskStatusLabels[task.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDifficultyColor(difficulty: string) {
  const colors: Record<string, string> = {
    EASY: '#10b981',
    MEDIUM: '#3b82f6',
    HARD: '#f59e0b',
    EXPERT: '#ef4444'
  };
  return colors[difficulty] || '#6b7280';
}

function getVehicleStatusBgColor(status: string) {
  const colors: Record<string, string> = {
    AVAILABLE: '#ecfdf5',
    MAINTENANCE: '#fffbeb',
    WORKING: '#eff6ff',
    BROKEN: '#fef2f2'
  };
  return colors[status] || '#f3f4f6';
}

function getVehicleStatusTextColor(status: string) {
  const colors: Record<string, string> = {
    AVAILABLE: '#065f46',
    MAINTENANCE: '#92400e',
    WORKING: '#1e40af',
    BROKEN: '#991b1b'
  };
  return colors[status] || '#374151';
}

function getTaskStatusBgColor(status: string) {
  const colors: Record<string, string> = {
    PENDING_ASSIGNMENT: '#fffbeb',
    PENDING_EXECUTION: '#eff6ff',
    IN_PROGRESS: '#ecfdf5',
    COMPLETED: '#f5f3ff',
    REJECTED: '#fef2f2',
    CANCELLED: '#f3f4f6'
  };
  return colors[status] || '#f3f4f6';
}

function getTaskStatusTextColor(status: string) {
  const colors: Record<string, string> = {
    PENDING_ASSIGNMENT: '#92400e',
    PENDING_EXECUTION: '#1e40af',
    IN_PROGRESS: '#065f46',
    COMPLETED: '#5b21b6',
    REJECTED: '#991b1b',
    CANCELLED: '#374151'
  };
  return colors[status] || '#374151';
}

export default DashboardPage;

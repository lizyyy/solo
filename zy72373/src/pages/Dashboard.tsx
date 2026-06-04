import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, FileText, Clock, User, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useDiagnosisStore } from '../store/useDiagnosisStore';
import { StatusBadge } from '../components/StatusBadge';

export function Dashboard() {
  const navigate = useNavigate();
  const { tasks, createNewTask, loadDemoData } = useDiagnosisStore();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleCreateTask = () => {
    if (newTaskTitle.trim()) {
      const task = createNewTask(newTaskTitle, '新人');
      navigate(`/diagnosis/${task.id}/import`);
    }
  };

  const handleStartDemo = () => {
    loadDemoData();
    navigate('/demo');
  };

  const handleTaskClick = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const stepMap: Record<number, string> = {
        1: 'import',
        2: 'photos',
        3: 'report',
      };
      navigate(`/diagnosis/${taskId}/${stepMap[task.currentStep] || 'import'}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-industrial-900">诊断看板</h1>
          <p className="text-industrial-500 mt-1">管理风扇叶片平衡诊断任务</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleStartDemo} className="btn-secondary flex items-center gap-2">
            <Play className="w-4 h-4" />
            教学演示
          </button>
          <button onClick={() => setShowNewTaskModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            新建诊断
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card flex items-center gap-4">
          <div className="bg-industrial-100 p-3 rounded-lg">
            <FileText className="w-6 h-6 text-industrial-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-industrial-900">{tasks.length}</p>
            <p className="text-sm text-industrial-500">诊断任务总数</p>
          </div>
        </div>
        
        <div className="card flex items-center gap-4">
          <div className="bg-warning-100 p-3 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-warning-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-industrial-900">
              {tasks.filter(t => t.status === 'pending_review').length}
            </p>
            <p className="text-sm text-industrial-500">待老唐复核</p>
          </div>
        </div>
        
        <div className="card flex items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-lg">
            <Clock className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-industrial-900">
              {tasks.filter(t => t.status === 'completed').length}
            </p>
            <p className="text-sm text-industrial-500">已完成</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-industrial-900 mb-4">诊断任务列表</h2>
        
        <div className="space-y-3">
          {tasks.map(task => (
            <div
              key={task.id}
              onClick={() => handleTaskClick(task.id)}
              className="flex items-center justify-between p-4 bg-industrial-50 rounded-lg hover:bg-industrial-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-lg border border-industrial-200">
                  <FileText className="w-5 h-5 text-industrial-600" />
                </div>
                <div>
                  <h3 className="font-medium text-industrial-900">{task.title}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-industrial-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {task.createdBy}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(task.createdAt), 'yyyy-MM-dd HH:mm')}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {task.hasUnitMixing && (
                  <span className="flex items-center gap-1 text-sm text-warning-600 bg-warning-50 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3" />
                    单位混用
                  </span>
                )}
                <StatusBadge status={task.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {showNewTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 animate-slide-up">
            <h3 className="text-lg font-semibold text-industrial-900 mb-4">新建诊断任务</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-industrial-700 mb-2">
                  任务名称
                </label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  placeholder="例如：1号风机月度检测"
                  className="input-field"
                  autoFocus
                />
              </div>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowNewTaskModal(false)}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateTask}
                  className="btn-primary"
                  disabled={!newTaskTitle.trim()}
                >
                  创建任务
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

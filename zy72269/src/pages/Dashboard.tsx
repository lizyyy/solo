import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileUp,
  Map,
  AlertTriangle,
  Compass,
  ClipboardCheck,
  FileText,
  Plus,
  Database,
  HardHat,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useAppStore } from '@/store';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { loadSampleData } from '@/sample/data';

export default function Dashboard() {
  const tasks = useAppStore((state) => state.tasks);
  const currentTask = useAppStore((state) => state.getCurrentTask());
  const createTask = useAppStore((state) => state.createTask);
  const setCurrentTask = useAppStore((state) => state.setCurrentTask);
  const setIsLoading = useAppStore((state) => state.setIsLoading);

  const stats = useMemo(() => {
    if (!currentTask) {
      return {
        totalMarks: 0,
        obstacleCount: 0,
        pendingConflicts: 0,
        pendingAbnormalities: 0,
        completedChecks: 0,
        totalChecks: 0
      };
    }

    return {
      totalMarks: currentTask.marks.length,
      obstacleCount: currentTask.marks.filter(m => m.isObstacle).length,
      pendingConflicts: currentTask.conflicts.filter(c => c.status === 'pending').length,
      pendingAbnormalities: currentTask.abnormalities.filter(a => a.reviewStatus === 'pending').length,
      completedChecks: currentTask.selfCheckReports.filter(r => r.result === 'pass').length,
      totalChecks: currentTask.selfCheckReports.length
    };
  }, [currentTask]);

  const handleCreateTask = () => {
    const task = createTask({
      taskNo: `TASK-${Date.now().toString().slice(-6)}`,
      projectName: '新建巡检项目',
      inspector: '许工'
    });
    setCurrentTask(task.id);
  };

  const handleLoadSample = () => {
    setIsLoading(true);
    setTimeout(() => {
      loadSampleData();
      setIsLoading(false);
    }, 500);
  };

  const quickActions = [
    { path: '/import', label: '数据导入', icon: FileUp, color: 'text-primary-300' },
    { path: '/replay', label: '路径回放', icon: Map, color: 'text-primary-300' },
    { path: '/conflicts', label: '冲突处理', icon: AlertTriangle, color: 'text-accent-warning' },
    { path: '/abnormal', label: 'Z轴复核', icon: Compass, color: 'text-accent-warning' },
    { path: '/self-check', label: '自检中心', icon: ClipboardCheck, color: 'text-accent-success' },
    { path: '/report', label: '报告导出', icon: FileText, color: 'text-primary-300' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold text-primary-100 tracking-wider">
            水下管线巡检标记系统
          </h1>
          <p className="font-mono text-sm text-primary-400 mt-1">
            UNDERWATER PIPELINE INSPECTION SYSTEM
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleLoadSample}>
            <Database size={16} className="mr-2 inline" />
            加载样例数据
          </Button>
          <Button variant="primary" onClick={handleCreateTask}>
            <Plus size={16} className="mr-2 inline" />
            新建任务
          </Button>
        </div>
      </div>

      {!currentTask && tasks.length === 0 && (
        <Card className="text-center py-12">
          <HardHat size={64} className="mx-auto text-primary-500 mb-4" />
          <h3 className="font-mono text-lg text-primary-200 mb-2">欢迎使用水下管线巡检标记系统</h3>
          <p className="text-primary-400 mb-6 max-w-md mx-auto">
            点击"新建任务"开始导入巡检数据，或点击"加载样例数据"体验完整功能流程
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="secondary" onClick={handleLoadSample}>
              加载样例数据
            </Button>
            <Button variant="primary" onClick={handleCreateTask}>
              新建任务
            </Button>
          </div>
        </Card>
      )}

      {currentTask && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Card className="p-4 text-center">
              <p className="font-mono text-3xl font-bold text-primary-200">{stats.totalMarks}</p>
              <p className="font-mono text-xs text-primary-400 mt-1">巡检标记</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="font-mono text-3xl font-bold text-accent-warning">{stats.obstacleCount}</p>
              <p className="font-mono text-xs text-primary-400 mt-1">障碍物</p>
            </Card>
            <Card className="p-4 text-center">
              <p className={`font-mono text-3xl font-bold ${stats.pendingConflicts > 0 ? 'text-accent-warning animate-pulse' : 'text-accent-success'}`}>
                {stats.pendingConflicts}
              </p>
              <p className="font-mono text-xs text-primary-400 mt-1">待处理冲突</p>
            </Card>
            <Card className="p-4 text-center">
              <p className={`font-mono text-3xl font-bold ${stats.pendingAbnormalities > 0 ? 'text-accent-warning animate-pulse' : 'text-accent-success'}`}>
                {stats.pendingAbnormalities}
              </p>
              <p className="font-mono text-xs text-primary-400 mt-1">待复核Z轴</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="font-mono text-3xl font-bold text-accent-success">{stats.completedChecks}</p>
              <p className="font-mono text-xs text-primary-400 mt-1">通过自检</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="font-mono text-3xl font-bold text-primary-300">{stats.totalChecks}</p>
              <p className="font-mono text-xs text-primary-400 mt-1">自检次数</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card title="快捷操作" className="md:col-span-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  const hasWarning = (action.path === '/conflicts' && stats.pendingConflicts > 0) ||
                                    (action.path === '/abnormal' && stats.pendingAbnormalities > 0);
                  return (
                    <Link
                      key={action.path}
                      to={action.path}
                      className="relative p-4 bg-primary-800/30 border-2 border-primary-700 hover:border-primary-500 hover:bg-primary-700/30 transition-all group"
                    >
                      {hasWarning && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-accent-warning text-white text-xs flex items-center justify-center animate-pulse">
                          !
                        </span>
                      )}
                      <Icon size={24} className={`${action.color} group-hover:text-primary-200 transition-colors mb-2`} />
                      <p className="font-mono text-sm text-primary-200">{action.label}</p>
                    </Link>
                  );
                })}
              </div>
            </Card>

            <Card title="任务信息">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-primary-400 text-sm">任务编号</span>
                  <span className="font-mono text-primary-200">{currentTask.taskNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-400 text-sm">项目名称</span>
                  <span className="text-primary-200">{currentTask.projectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-400 text-sm">巡检日期</span>
                  <span className="font-mono text-primary-200">{currentTask.inspectionDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-400 text-sm">巡检人员</span>
                  <span className="text-primary-200">{currentTask.inspector}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-primary-400 text-sm">状态</span>
                  <Badge variant={
                    currentTask.status === 'completed' ? 'success' :
                    currentTask.status === 'conflict_detected' || currentTask.status === 'reviewing' ? 'warning' :
                    'default'
                  }>
                    {{
                      draft: '草稿',
                      imported: '已导入',
                      conflict_detected: '发现冲突',
                      reviewing: '复核中',
                      completed: '已完成'
                    }[currentTask.status]}
                  </Badge>
                </div>
                <div className="pt-2 border-t border-primary-700">
                  <div className="flex justify-between">
                    <span className="text-primary-400 text-sm">创建时间</span>
                    <span className="font-mono text-xs text-primary-400">
                      {new Date(currentTask.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="待处理事项">
              {stats.pendingConflicts === 0 && stats.pendingAbnormalities === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 size={48} className="mx-auto text-accent-success mb-3" />
                  <p className="text-primary-300">暂无待处理事项</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.pendingConflicts > 0 && (
                    <Link to="/conflicts" className="flex items-center gap-3 p-3 bg-accent-warning/10 border border-accent-warning/30 hover:bg-accent-warning/20 transition-colors">
                      <AlertCircle className="text-accent-warning" size={20} />
                      <div className="flex-1">
                        <p className="text-sm text-primary-200">{stats.pendingConflicts} 条冲突待处理</p>
                        <p className="text-xs text-primary-400">障碍物备注与楼层剖面草图冲突</p>
                      </div>
                      <span className="text-xs text-primary-400">→</span>
                    </Link>
                  )}
                  {stats.pendingAbnormalities > 0 && (
                    <Link to="/abnormal" className="flex items-center gap-3 p-3 bg-accent-warning/10 border border-accent-warning/30 hover:bg-accent-warning/20 transition-colors">
                      <Compass className="text-accent-warning" size={20} />
                      <div className="flex-1">
                        <p className="text-sm text-primary-200">{stats.pendingAbnormalities} 条Z轴异常待复核</p>
                        <p className="text-xs text-primary-400">可能按旧习惯写反，需现场班组确认</p>
                      </div>
                      <span className="text-xs text-primary-400">→</span>
                    </Link>
                  )}
                </div>
              )}
            </Card>

            <Card title="核心业务规则">
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <span className="text-accent-warning">●</span>
                  <p className="text-primary-300">原始备注永不清洗，完整保留所有手写、拍照、存疑备注</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent-warning">●</span>
                  <p className="text-primary-300">冲突仅列证据，由许工手动裁决，系统不自动拍板</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent-warning">●</span>
                  <p className="text-primary-300">Z轴写反仅标记待复核，不自动修正，留给现场班组</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent-success">●</span>
                  <p className="text-primary-300">四大自检必过：重复导入、Z轴方向、补录重算、导出一致</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-accent-success">●</span>
                  <p className="text-primary-300">三步流程：导入→补看草图→路径回放更新</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {!currentTask && tasks.length > 0 && (
        <Card title="已有任务">
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 bg-primary-800/30 hover:bg-primary-700/30 transition-colors cursor-pointer"
                onClick={() => setCurrentTask(task.id)}
              >
                <div>
                  <p className="font-mono text-sm text-primary-200">{task.taskNo} - {task.projectName}</p>
                  <p className="font-mono text-xs text-primary-400">
                    {task.marks.length} 条标记 | {task.conflicts.length} 条冲突 | {new Date(task.updatedAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                <span className="text-primary-400">→</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

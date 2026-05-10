import { useApp } from '../context/AppContext';

export function Dashboard() {
  const { data, generateCleaningTasks, importScreenings } = useApp();

  const pendingTasks = data.cleaningTasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = data.cleaningTasks.filter(t => t.status === 'in_progress').length;
  const completedTasks = data.cleaningTasks.filter(t => t.status === 'completed').length;
  const overdueTasks = data.cleaningTasks.filter(t => t.status === 'overdue').length;

  const heldItems = data.lostItems.filter(l => l.status === 'held').length;
  const openEquipment = data.equipmentIssues.filter(e => 
    ['reported', 'in_progress', 'escalated'].includes(e.status)
  ).length;

  const hasTasksForAllScreenings = data.screenings.every(s =>
    data.cleaningTasks.some(t => t.screeningId === s.id)
  );

  const handleLoadSample = () => {
    const today = new Date().toISOString().slice(0, 10);
    const sample = [
      `${today},1厅,流浪地球3,09:00-11:15,120人`,
      `${today},1厅,封神第二部,11:45-14:00,95人`,
      `${today},1厅,哪吒2,14:30-16:45,150人`,
      `${today},2厅,封神第二部,09:30-11:45,88人`,
      `${today},2厅,流浪地球3,12:15-14:30,110人`,
      `${today},2厅,哈利波特重置版,15:00-17:15,75人`,
      `${today},3厅,哪吒2,10:00-12:15,140人`,
      `${today},3厅,哈利波特重置版,12:45-15:00,60人`,
      `${today},3厅,流浪地球3,15:30-17:45,105人`,
    ];
    const result = importScreenings(sample.join('\n'));
    if (result.added > 0) {
      setTimeout(() => generateCleaningTasks(), 100);
    }
  };

  const stats = [
    { label: '排片总数', value: data.screenings.length, color: 'bg-blue-500', icon: '📅' },
    { label: '待清洁', value: pendingTasks, color: 'bg-yellow-500', icon: '⏳' },
    { label: '清洁中', value: inProgressTasks, color: 'bg-cyan-500', icon: '🔄' },
    { label: '已完成', value: completedTasks, color: 'bg-green-500', icon: '✅' },
    { label: '超时', value: overdueTasks, color: 'bg-red-500', icon: '⚠️' },
    { label: '待认领遗失物', value: heldItems, color: 'bg-purple-500', icon: '📦' },
    { label: '待处理设备异常', value: openEquipment, color: 'bg-orange-500', icon: '🔧' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <h2 className="text-xl font-bold mb-2">今日工作概览</h2>
        <p className="text-slate-300 text-sm mb-4">
          业务流程：导入排片 &rarr; 生成清洁任务 &rarr; 清洁交接 &rarr; 登记遗失物/设备异常 &rarr; 导出汇总
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleLoadSample}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm font-medium transition-all shadow-md"
          >
            载入今日样例数据
          </button>
          {data.screenings.length > 0 && !hasTasksForAllScreenings && (
            <button
              onClick={generateCleaningTasks}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-all shadow-md"
            >
              生成清洁任务
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center text-xl mb-3`}>
              {s.icon}
            </div>
            <div className="text-2xl font-bold text-slate-800">{s.value}</div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">最近清洁任务</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {data.cleaningTasks.slice(0, 5).map(task => (
              <div key={task.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {task.hallNumber}厅 - {task.movieName}
                  </div>
                  <div className="text-xs text-slate-500">
                    散场: {task.screeningEndTime} | 截止: {task.deadline.split(' ')[1].slice(0, 5)}
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  task.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  task.status === 'in_progress' ? 'bg-cyan-100 text-cyan-700' :
                  task.status === 'completed' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {{
                    pending: '待开始',
                    in_progress: '进行中',
                    completed: '已完成',
                    overdue: '超时',
                  }[task.status]}
                </span>
              </div>
            ))}
            {data.cleaningTasks.length === 0 && (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">
                暂无清洁任务，请先导入排片数据
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">最近遗失物 / 设备异常</h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {[...data.lostItems.slice(0, 3), ...data.equipmentIssues.slice(0, 3)].slice(0, 5).map((item: any) => (
              <div key={item.id} className="px-6 py-3 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{item.itemName ? '📦' : '🔧'}</span>
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {item.itemName || item.equipmentType}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.hallNumber}厅 | {item.foundTime?.split(' ')[1]?.slice(0, 5) || item.reportedTime?.split(' ')[1]?.slice(0, 5)}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.status === 'held' || item.status === 'reported'
                      ? 'bg-yellow-100 text-yellow-700'
                      : item.status === 'claimed' || item.status === 'resolved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {item.status === 'held' ? '待认领' :
                     item.status === 'claimed' ? '已认领' :
                     item.status === 'disposed' ? '已处理' :
                     item.status === 'reported' ? '已上报' :
                     item.status === 'in_progress' ? '处理中' :
                     item.status === 'resolved' ? '已解决' :
                     item.status === 'escalated' ? '已升级' :
                     item.status}
                  </span>
                </div>
              </div>
            ))}
            {data.lostItems.length === 0 && data.equipmentIssues.length === 0 && (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">
                暂无遗失物或设备异常记录
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

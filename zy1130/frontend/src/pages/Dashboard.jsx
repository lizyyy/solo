import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Upload, 
  Map, 
  GitCompareArrows, 
  FileDown,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  MapPin,
  Calendar
} from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = React.useState({ jobs: 0, workers: 0, plans: 0, activePlan: null });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const { jobsApi, workersApi, plansApi } = await import('../utils/api');
        const [jobsRes, workersRes, plansRes] = await Promise.all([
          jobsApi.getAll(),
          workersApi.getAll(),
          plansApi.getAll()
        ]);
        
        const jobs = jobsRes.data?.data || [];
        const workers = workersRes.data?.data || [];
        const plans = plansRes.data?.data || [];
        const activePlan = plans.find(p => p.isActive);

        setStats({
          jobs: jobs.length,
          workers: workers.length,
          plans: plans.length,
          activePlan
        });
      } catch (error) {
        console.error('加载统计数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const quickActions = [
    { 
      title: '导入数据', 
      description: '导入任务、师傅、行程时间和限行规则数据',
      icon: Upload,
      path: '/import',
      color: 'bg-blue-500'
    },
    { 
      title: '生成路线', 
      description: '基于当前数据生成最优派单路线方案',
      icon: Map,
      path: '/plan',
      color: 'bg-green-500',
      disabled: stats.jobs === 0 || stats.workers === 0
    },
    { 
      title: '方案对比', 
      description: '对比不同派单方案的各项指标',
      icon: GitCompareArrows,
      path: '/compare',
      color: 'bg-purple-500',
      disabled: stats.plans < 2
    },
    { 
      title: '导出报告', 
      description: '导出派单表和复盘报告给师傅和老板',
      icon: FileDown,
      path: '/reports',
      color: 'bg-orange-500',
      disabled: stats.plans === 0
    }
  ];

  const riskTypes = [
    { label: '迟到风险', icon: Clock, color: 'text-red-500', bg: 'bg-red-50' },
    { label: '超时风险', icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: '技能不匹配', icon: Users, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { label: '限行冲突', icon: MapPin, color: 'text-purple-500', bg: 'bg-purple-50' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '任务总数', value: stats.jobs, icon: MapPin, color: 'bg-blue-100 text-blue-600' },
          { label: '师傅总数', value: stats.workers, icon: Users, color: 'bg-green-100 text-green-600' },
          { label: '方案数量', value: stats.plans, icon: Calendar, color: 'bg-purple-100 text-purple-600' },
          { label: '激活方案', value: stats.activePlan ? stats.activePlan.name : '无', icon: CheckCircle, color: 'bg-green-100 text-green-600' }
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{item.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {loading ? '...' : item.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${item.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">快速开始</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                to={action.disabled ? '#' : action.path}
                className={`p-4 rounded-lg border-2 transition-all ${
                  action.disabled
                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50 cursor-pointer'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-medium text-gray-800">{action.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{action.description}</p>
                {!action.disabled && (
                  <div className="flex items-center text-blue-600 text-sm mt-3">
                    <span>开始</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                )}
                {action.disabled && (
                  <p className="text-xs text-gray-400 mt-3">需要先完成前置步骤</p>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">风险类型说明</h2>
          <div className="space-y-3">
            {riskTypes.map((risk, index) => {
              const Icon = risk.icon;
              return (
                <div key={index} className={`flex items-center gap-3 p-3 rounded-lg ${risk.bg}`}>
                  <Icon className={`w-5 h-5 ${risk.color}`} />
                  <div>
                    <p className="font-medium text-gray-800">{risk.label}</p>
                    <p className="text-xs text-gray-500">
                      {risk.label === '迟到风险' && '预计到达时间晚于客户时间窗开始'}
                      {risk.label === '超时风险' && '预计结束时间晚于工作时间限制'}
                      {risk.label === '技能不匹配' && '师傅技能与任务服务类型不匹配'}
                      {risk.label === '限行冲突' && '任务区域或时间存在限行规则冲突'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">使用流程</h2>
          <div className="space-y-4">
            {[
              { step: 1, title: '导入数据', desc: '导入 jobs.csv、workers.csv 等样例数据' },
              { step: 2, title: '生成路线', desc: '系统自动按约束条件生成初始派单方案' },
              { step: 3, title: '手动调整', desc: '可拖拽调整任务顺序或分配给其他师傅' },
              { step: 4, title: '导出报告', desc: '导出派单表给师傅，复盘报告给老板' }
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stats.activePlan && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-2">当前激活方案</h2>
              <p className="text-blue-100">{stats.activePlan.name}</p>
              <p className="text-sm text-blue-200 mt-1">
                创建时间: {new Date(stats.activePlan.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>
            <Link
              to="/plan"
              className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              查看路线
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

import { StoreType } from '../store/useStore';
import { Film, RefreshCw, Settings, History, BarChart3, AlertTriangle } from 'lucide-react';

interface HomePageProps {
  store: StoreType;
}

const HomePage = ({ store }: HomePageProps) => {
  const { navigate, getStatistics, state } = store;
  const stats = getStatistics();

  const quickActions = [
    {
      id: 'pickup',
      title: '取片服务',
      description: '输入取片码，快速打印胶片',
      icon: Film,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600'
    },
    {
      id: 'reprint',
      title: '补打申请',
      description: '胶片丢失或损坏，申请补打',
      icon: RefreshCw,
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600'
    },
    {
      id: 'admin',
      title: '管理中心',
      description: '审核补打申请、处理异常',
      icon: Settings,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600'
    },
    {
      id: 'history',
      title: '历史记录',
      description: '查看所有操作历史',
      icon: History,
      color: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-600'
    },
    {
      id: 'statistics',
      title: '统计分析',
      description: '取片和打印数据统计',
      icon: BarChart3,
      color: 'bg-teal-500',
      hoverColor: 'hover:bg-teal-600'
    }
  ];

  const pendingAbnormals = state.abnormalRecords.filter(r => r.status === 'pending');
  const pendingReprints = state.reprintRequests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">欢迎使用影像科胶片自助取片台</h2>
        <p className="text-gray-600">请选择您需要的服务，或使用下方快捷操作</p>
      </div>

      {(pendingAbnormals.length > 0 || pendingReprints.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingReprints.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center space-x-4">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <RefreshCw className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-800">待审核补打申请</p>
                <p className="text-2xl font-bold text-yellow-900">{pendingReprints.length} 条</p>
              </div>
              <button
                onClick={() => navigate('admin')}
                className="ml-auto bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700 transition-colors"
              >
                前往处理
              </button>
            </div>
          )}
          {pendingAbnormals.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-4">
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-800">待处理异常记录</p>
                <p className="text-2xl font-bold text-red-900">{pendingAbnormals.length} 条</p>
              </div>
              <button
                onClick={() => navigate('admin')}
                className="ml-auto bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                前往处理
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">总取片码</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalPickups}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">总打印次数</p>
          <p className="text-3xl font-bold text-blue-600">{stats.totalPrints}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">补打申请</p>
          <p className="text-3xl font-bold text-green-600">{stats.reprintRequests}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">异常记录</p>
          <p className="text-3xl font-bold text-red-600">{stats.abnormalRecords}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quickActions.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => navigate(action.id as any)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md transition-all hover:-translate-y-1 group"
            >
              <div className={`w-12 h-12 ${action.color} ${action.hoverColor} rounded-lg flex items-center justify-center mb-4 transition-colors`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{action.title}</h3>
              <p className="text-sm text-gray-500">{action.description}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">测试样例数据</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-blue-600">正常取片样例</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><strong>取片码：</strong>20260510-8876（张三 - 胸部CT）</li>
              <li><strong>取片码：</strong>20260511-6543（李四 - 腰椎MRI）</li>
              <li><strong>身份证号：</strong>110101197901011234（张三）</li>
              <li><strong>身份证号：</strong>110101199202022345（李四）</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-red-600">异常拦截样例</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li><strong>格式错误：</strong>12345-678（缺少数字）</li>
              <li><strong>不存在：</strong>20260512-0000</li>
              <li><strong>已使用：</strong>20260509-9876</li>
              <li><strong>身份不匹配：</strong>用张三的取片码 + 李四的身份证</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;

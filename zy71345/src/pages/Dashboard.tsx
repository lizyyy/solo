import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileUp,
  FileCheck,
  AlertTriangle,
  Users,
  FileText,
  Music,
  BookOpen,
  ChevronRight,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { getCheckSummary } from '../services/checkService';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentData, checkResults, versions, importSampleData, isChecked } = useDataStore();
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    setHasData(currentData.parts.length > 0);
  }, [currentData]);

  const summary = isChecked ? getCheckSummary(checkResults) : null;

  const exceptionByTypeData = summary
    ? [
        { name: '页码问题', value: summary.byType.page, color: '#ef4444' },
        { name: '发放问题', value: summary.byType.distribution, color: '#f59e0b' },
        { name: '修订页问题', value: summary.byType.revision, color: '#3b82f6' },
      ]
    : [];

  const severityData = summary
    ? [
        { name: '错误', count: summary.errors, fill: '#ef4444' },
        { name: '警告', count: summary.warnings, fill: '#f59e0b' },
        { name: '信息', count: summary.infos, fill: '#3b82f6' },
      ]
    : [];

  const quickActions = [
    { label: '导入样例数据', icon: Sparkles, action: importSampleData, color: 'bg-purple-500', disabled: hasData },
    { label: '导入数据', icon: FileUp, action: () => navigate('/import'), color: 'bg-blue-500' },
    { label: '执行检查', icon: PlayCircle, action: () => navigate('/check'), color: 'bg-green-500', disabled: !hasData },
    { label: '查看异常', icon: AlertTriangle, action: () => navigate('/exceptions'), color: 'bg-orange-500', disabled: !hasData || !isChecked },
  ];

  const recentVersions = versions.slice(-5).reverse();

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mb-6">
          <Music className="w-12 h-12 text-primary-500" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-gray-800 mb-2">欢迎使用乐谱检查系统</h2>
        <p className="text-gray-500 mb-8 text-center max-w-md">
          请先导入数据或使用样例数据开始检查乐谱发放情况
        </p>
        <div className="flex gap-4">
          <button
            onClick={importSampleData}
            className="flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-lg shadow-primary-200"
          >
            <Sparkles className="w-5 h-5" />
            <span>导入样例数据</span>
          </button>
          <button
            onClick={() => navigate('/import')}
            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileUp className="w-5 h-5" />
            <span>导入数据</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="声部数量"
          value={currentData.parts.length}
          icon={<Music className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="乐手人数"
          value={currentData.musicians.length}
          icon={<Users className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="修订页数"
          value={currentData.revisions.length}
          icon={<BookOpen className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="发放记录"
          value={currentData.distributions.length}
          icon={<FileText className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      {isChecked && summary ? (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="待处理异常"
            value={summary.open}
            icon={<AlertTriangle className="w-6 h-6" />}
            color="red"
          />
          <StatCard
            title="已解决问题"
            value={summary.resolved}
            icon={<FileCheck className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title="总检查项"
            value={summary.total}
            icon={<FileText className="w-6 h-6" />}
            color="blue"
          />
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-800">尚未执行检查</h3>
                <p className="text-sm text-yellow-600">点击右侧按钮开始检查乐谱发放情况</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/check')}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <PlayCircle className="w-5 h-5" />
              <span>执行检查</span>
            </button>
          </div>
        </div>
      )}

      {isChecked && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">异常类型分布</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={exceptionByTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {exceptionByTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">严重程度统计</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={60} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">快捷操作</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                disabled={action.disabled}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                  action.disabled
                    ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100 cursor-pointer'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">最近版本</h3>
            <button
              onClick={() => navigate('/compare')}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {recentVersions.length > 0 ? (
            <div className="space-y-3">
              {recentVersions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => {
                    useDataStore.getState().setCurrentVersion(version.id);
                  }}
                >
                  <div>
                    <div className="font-medium text-gray-800">{version.name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(version.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  {version.id === useDataStore.getState().currentVersionId && (
                    <StatusBadge status="success">当前</StatusBadge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>暂无版本记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

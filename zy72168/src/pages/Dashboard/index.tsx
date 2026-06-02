import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  MessageSquare,
  FileText,
  BarChart3,
  AlertTriangle,
  ChevronRight,
  Play,
  CheckCircle2,
  Circle,
  ArrowRight,
  TrendingUp,
  Users,
  Clock,
  Database,
  GitBranch,
  FileOutput,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { useAppStore } from '@/store';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatDateTime } from '@/utils/export';

const processSteps = [
  {
    id: 1,
    title: '样例数据导入',
    description: '导入包含同名路口、重复投诉、坐标偏移、跨时段统计的样例数据',
    icon: Database,
    details: [
      '同名路口：人民路与建设路交叉口 / 人民路口 / 建设路与人民路交叉口',
      '重复投诉：3条同点位同时段的堵车投诉',
      '坐标偏移：中山路与解放路交叉口坐标存在偏差',
      '跨时段统计：早高峰、日间、晚高峰、夜间四个时段',
    ],
  },
  {
    id: 2,
    title: '点位智能识别',
    description: '自动标记同名路口、检测坐标偏移、区分相邻点位',
    icon: MapPin,
    details: [
      '同名路口归并：使用Jaccard相似度+编辑距离算法',
      '坐标偏移检测：对比原始坐标与录入坐标差异',
      '相邻点位校验：距离50-200米标记为相邻，禁止自动合并',
      '时段识别：自动识别每条记录涉及的时段',
    ],
  },
  {
    id: 3,
    title: '反馈数据清洗',
    description: '去重处理、空值标记、冲突检测',
    icon: MessageSquare,
    details: [
      '重复投诉检测：同点位7天内相似度>90%标记重复',
      '空值处理：标记缺失字段，提供补全建议',
      '冲突检测：会议纪要与导入数据不一致时触发警告',
      '边界记录：夜间数据、多字段缺失等特殊标记',
    ],
  },
  {
    id: 4,
    title: '绕行方案编制',
    description: '基于点位和反馈生成初版方案，保留版本历史',
    icon: FileText,
    details: [
      '方案v1：基于初始数据制定绕行路线',
      '业务建议：以周姐提醒的形式展示可执行操作',
      '版本追溯：记录每次变更原因和变更内容',
      '点位关联：方案与点位、反馈双向追溯',
    ],
  },
  {
    id: 5,
    title: '方案迭代优化',
    description: '根据新反馈更新方案，记录每次变更原因',
    icon: GitBranch,
    details: [
      '版本对比：v1→v2变更内容高亮显示',
      '绕行路线优化：根据居民反馈调整路线',
      '建议更新：补充新增的业务操作提醒',
      '生效状态：自动切换当前生效版本',
    ],
  },
  {
    id: 6,
    title: '冲突证据处理',
    description: '会议纪要与系统数据不一致时，展示双边证据供人工判断',
    icon: AlertTriangle,
    details: [
      '双边展示：左侧会议纪要，右侧系统导入数据',
      '建议动作：自动生成建议的核实步骤',
      '人工决策：不自动处理，由周姐选择采信来源',
      '处理留痕：记录决策人和决策时间',
    ],
  },
  {
    id: 7,
    title: '分类报告生成',
    description: '按状态分类导出，形成可交接的评估报告',
    icon: FileOutput,
    details: [
      '已处理点位：方案已生效，反馈已解决',
      '待核实点位：存在空值或数据待确认',
      '需复看点位：边界记录或坐标存疑，需现场复核',
      '导出格式：支持CSV导出、打印预览、交接视图',
    ],
  },
];

const todoItems = [
  { id: 1, title: '处理中山路与解放路交叉口数据冲突', priority: 'high', type: 'conflict' },
  { id: 2, title: '补全长江路与淮海路交叉口巡查记录内容', priority: 'high', type: 'empty' },
  { id: 3, title: '合并人民路口3条重复投诉', priority: 'medium', type: 'duplicate' },
  { id: 4, title: '现场复核黄河路夜间施工噪音问题', priority: 'high', type: 'boundary' },
  { id: 5, title: '生成5月份评估报告准备交接', priority: 'medium', type: 'report' },
];

export default function Dashboard() {
  const {
    points,
    feedbacks,
    plans,
    crossPeriodData,
    loading,
    mainProcessStep,
    fetchPoints,
    fetchFeedbacks,
    fetchPlans,
    fetchCrossPeriodData,
    setMainProcessStep,
  } = useAppStore();

  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);

  useEffect(() => {
    fetchPoints();
    fetchFeedbacks();
    fetchPlans();
    fetchCrossPeriodData();
  }, [fetchPoints, fetchFeedbacks, fetchPlans, fetchCrossPeriodData]);

  useEffect(() => {
    if (isDemoPlaying && mainProcessStep < 7) {
      const timer = setTimeout(() => {
        setExpandedStep(mainProcessStep + 2);
        setMainProcessStep(mainProcessStep + 1);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (mainProcessStep >= 7) {
      setIsDemoPlaying(false);
    }
  }, [isDemoPlaying, mainProcessStep, setMainProcessStep]);

  const chartData = crossPeriodData.map((item) => ({
    name: item.periodLabel,
    点位数量: item.pointCount,
    反馈数量: item.feedbackCount,
    完成率: item.completedRate,
  }));

  const todoTypeColors: Record<string, string> = {
    conflict: 'bg-orange-100 text-orange-700 border-orange-200',
    empty: 'bg-red-100 text-red-700 border-red-200',
    duplicate: 'bg-purple-100 text-purple-700 border-purple-200',
    boundary: 'bg-amber-100 text-amber-700 border-amber-200',
    report: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  const todoTypeLabels: Record<string, string> = {
    conflict: '数据冲突',
    empty: '空值补全',
    duplicate: '重复合并',
    boundary: '边界复核',
    report: '报告生成',
  };

  if (loading && crossPeriodData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner text="加载数据中..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-5">
        <StatCard
          title="施工点位总数"
          value={points.length}
          icon={MapPin}
          color="blue"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="反馈记录数"
          value={feedbacks.length}
          icon={MessageSquare}
          color="green"
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="方案版本数"
          value={plans.length}
          icon={FileText}
          color="yellow"
        />
        <StatCard
          title="待处理事项"
          value={todoItems.length}
          icon={AlertTriangle}
          color="orange"
          trend={{ value: 3, isPositive: false }}
        />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">跨时段趋势分析</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <TrendingUp className="w-4 h-4" />
              <span>近两周数据</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="点位数量"
                  stroke="#1e40af"
                  strokeWidth={2}
                  dot={{ fill: '#1e40af', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="反馈数量"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: '#f97316', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">待办事项</h3>
            <span className="text-xs text-slate-500">{todoItems.length}项待处理</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {todoItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border ${todoTypeColors[item.type]}`}
                    >
                      {todoTypeLabels[item.type]}
                    </span>
                    <span
                      className={`text-xs ${
                        item.priority === 'high' ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {item.priority === 'high' ? '高优先级' : '中优先级'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">主流程演示</h3>
            <p className="text-sm text-slate-500 mt-1">
              从样例数据导入到报告生成的完整"道路施工绕行评估"流程
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>进度：</span>
              <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${(mainProcessStep / 7) * 100}%` }}
                />
              </div>
              <span className="font-medium text-slate-700">{mainProcessStep}/7</span>
            </div>
            <button
              onClick={() => {
                if (isDemoPlaying) {
                  setIsDemoPlaying(false);
                } else {
                  setMainProcessStep(0);
                  setExpandedStep(1);
                  setIsDemoPlaying(true);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isDemoPlaying
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-blue-700 text-white hover:bg-blue-800'
              }`}
            >
              <Play className="w-4 h-4" />
              {isDemoPlaying ? '暂停演示' : '开始演示'}
            </button>
            <button
              onClick={() => {
                setMainProcessStep(0);
                setExpandedStep(1);
                setIsDemoPlaying(false);
              }}
              className="px-4 py-2 border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              重置
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
          <div className="space-y-4">
            {processSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = mainProcessStep >= step.id;
              const isCurrent = mainProcessStep === step.id - 1 && isDemoPlaying;
              const isExpanded = expandedStep === step.id;

              return (
                <div
                  key={step.id}
                  className={`relative pl-16 transition-all duration-300 ${
                    isCompleted ? 'opacity-100' : 'opacity-60'
                  }`}
                >
                  <div
                    className={`absolute left-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-green-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white animate-pulse'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>

                  <div
                    className={`bg-slate-50 rounded-lg border transition-all cursor-pointer ${
                      isExpanded
                        ? 'border-blue-300 bg-blue-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    } ${isCurrent ? 'ring-2 ring-blue-200' : ''}`}
                    onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  >
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm font-bold ${
                            isCompleted ? 'text-green-600' : 'text-slate-400'
                          }`}
                        >
                          步骤 {step.id}
                        </span>
                        <h4 className="font-semibold text-slate-800">{step.title}</h4>
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            进行中
                          </span>
                        )}
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 text-slate-400 transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                    <p className="px-4 pb-3 text-sm text-slate-600">{step.description}</p>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-200 pt-3 mt-2">
                        <h5 className="text-sm font-medium text-slate-700 mb-2">处理细节：</h5>
                        <ul className="space-y-1.5">
                          {step.details.map((detail, i) => (
                            <li
                              key={i}
                              className="text-sm text-slate-600 flex items-start gap-2"
                            >
                              <span className="text-blue-600 mt-0.5">•</span>
                              {detail}
                            </li>
                          ))}
                        </ul>
                        {index < processSteps.length - 1 && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>下一步：{processSteps[index + 1].title}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-200 flex justify-center gap-4">
          <Link
            to="/points/merge"
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            进入点位归并
          </Link>
          <Link
            to="/feedbacks"
            className="flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white rounded-md text-sm font-medium hover:bg-green-800 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            处理反馈记录
          </Link>
          <Link
            to="/reports"
            className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            生成评估报告
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">各时段完成率</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, '完成率']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                />
                <Bar dataKey="完成率" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">最近动态</h3>
          <div className="space-y-3">
            {feedbacks.slice(0, 4).map((feedback) => (
              <div
                key={feedback.id}
                className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0"
              >
                <div className="p-2 bg-slate-100 rounded-md flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 truncate">{feedback.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={feedback.status} showIcon={false} />
                    <span className="text-xs text-slate-400">
                      {formatDateTime(feedback.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import {
  FileUp,
  Tags,
  FileBarChart,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Music,
  DollarSign,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { useAppStore } from '../store';
import { formatCurrency, formatDateTime } from '../utils/helpers';

export default function Dashboard() {
  const navigate = useNavigate();
  const { contracts, tracks, trackAliases, conflicts, weeklyReports, operationLogs, runAllSelfChecks } = useAppStore();

  const pendingConflicts = conflicts.filter((c) => c.status === '待处理');
  const totalAmount = tracks.reduce((s, t) => s + t.amount, 0);
  const pendingReview = tracks.filter((t) => t.reviewStatus === '待复核').length;

  const steps = [
    {
      step: 1,
      title: '合同页截图第一次导入',
      desc: '上传合同截图，录入曲目明细',
      icon: FileUp,
      path: '/contract-import',
      count: contracts.length,
      status: contracts.length > 0 ? 'done' : 'current',
    },
    {
      step: 2,
      title: '录音师小段补看曲目别名表',
      desc: '核对现场名与版权名的映射',
      icon: Tags,
      path: '/alias-management',
      count: trackAliases.length,
      status: contracts.length > 0 ? (pendingConflicts.length > 0 ? 'current' : 'done') : 'pending',
    },
    {
      step: 3,
      title: '给店长看的周报更新',
      desc: '生成汇总周报，确保数据一致',
      icon: FileBarChart,
      path: '/weekly-report',
      count: weeklyReports.length,
      status: pendingConflicts.length === 0 && contracts.length > 0 ? 'current' : 'pending',
    },
  ];

  const stats = [
    { label: '合同总数', value: contracts.length, icon: FileText, color: 'bg-slate-800 text-white' },
    { label: '曲目总数', value: tracks.length, icon: Music, color: 'bg-amber-500 text-white' },
    { label: '总金额', value: formatCurrency(totalAmount), icon: DollarSign, color: 'bg-emerald-600 text-white' },
    { label: '别名映射', value: trackAliases.length, icon: Tags, color: 'bg-sky-600 text-white' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">标准三步工作流</h3>
            <p className="text-sm text-slate-500">按步骤完成，确保每一步都有证据链可追溯</p>
          </div>
          {pendingConflicts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-md border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-700 font-medium">
                {pendingConflicts.length} 个冲突待处理
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            const isClickable = item.status !== 'pending';

            return (
              <div
                key={item.step}
                onClick={() => isClickable && navigate(item.path)}
                className={`relative p-5 rounded-lg border-2 transition-all duration-200 ${
                  isClickable
                    ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
                    : 'opacity-60'
                } ${
                  item.status === 'current'
                    ? 'border-amber-400 bg-amber-50'
                    : item.status === 'done'
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      item.status === 'current'
                        ? 'bg-amber-500 text-white'
                        : item.status === 'done'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-300 text-white'
                    }`}
                  >
                    {item.status === 'done' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.status === 'current'
                        ? 'bg-amber-200 text-amber-800'
                        : item.status === 'done'
                        ? 'bg-emerald-200 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    第{item.step}步
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-slate-800 mb-1">{item.title}</h4>
                <p className="text-xs text-slate-500 mb-3">{item.desc}</p>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    已有 <span className="font-medium text-slate-700">{item.count}</span> 条记录
                  </span>
                  {isClickable && <ArrowRight className="w-4 h-4 text-slate-400" />}
                </div>

                {idx < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-0.5 bg-slate-200" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-lg border border-slate-200 p-5">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-800">待处理事项</h4>
            <span className="text-xs text-slate-500">
              {pendingConflicts.length + pendingReview} 项待处理
            </span>
          </div>
          <div className="space-y-3">
            {pendingConflicts.length > 0 && (
              <div
                onClick={() => navigate('/conflicts')}
                className="flex items-center gap-3 p-3 bg-amber-50 rounded-md border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800 truncate">
                    {pendingConflicts.length} 个冲突需要处理
                  </p>
                  <p className="text-xs text-amber-600">合同与别名表存在矛盾，需人工确认</p>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
              </div>
            )}
            {pendingReview > 0 && (
              <div
                onClick={() => navigate('/conflicts')}
                className="flex items-center gap-3 p-3 bg-sky-50 rounded-md border border-sky-200 cursor-pointer hover:bg-sky-100 transition-colors"
              >
                <Clock className="w-4 h-4 text-sky-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sky-800 truncate">
                    {pendingReview} 首曲目待复核
                  </p>
                  <p className="text-xs text-sky-600">同一首歌有现场名和版权名，留给音乐老师</p>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-400 flex-shrink-0" />
              </div>
            )}
            {pendingConflicts.length === 0 && pendingReview === 0 && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">所有事项已处理完毕</p>
                  <p className="text-xs text-emerald-600">可以生成周报了</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-800">快速自检</h4>
            <button
              onClick={() => {
                runAllSelfChecks();
                navigate('/self-check');
              }}
              className="text-xs px-3 py-1.5 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              运行全部自检
            </button>
          </div>
          <div className="space-y-2.5">
            {['重复导入', '同名异曲', '补录重算', '导出一致'].map((type) => (
              <div
                key={type}
                className="flex items-center justify-between p-2.5 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors"
              >
                <span className="text-sm text-slate-700">{type}检测</span>
                <span className="text-xs text-slate-400">随时可运行</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h4 className="text-sm font-semibold text-slate-800 mb-4">最近操作记录</h4>
        <div className="space-y-3">
          {operationLogs.slice(0, 5).map((log) => (
            <div key={log.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0">
              <div className="w-2 h-2 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700">{log.description}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {log.operator} · {formatDateTime(new Date(log.timestamp))}
                </p>
              </div>
            </div>
          ))}
          {operationLogs.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">暂无操作记录</p>
          )}
        </div>
      </div>
    </div>
  );
}

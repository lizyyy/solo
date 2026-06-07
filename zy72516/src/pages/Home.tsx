import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileUp,
  ClipboardCheck,
  AlertTriangle,
  Download,
  BookOpen,
  BarChart3,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { StatusBadge } from '../components/common/StatusBadge';
import { RecordStatus, AbnormalType } from '../types';

export default function Home() {
  const { records, initMockData, getConflictSamples } = useRecordStore();

  useEffect(() => {
    initMockData();
  }, [initMockData]);

  const stats = {
    total: records.length,
    pending: records.filter(r => r.currentStatus === RecordStatus.PENDING).length,
    passed: records.filter(r =>
      r.currentStatus === RecordStatus.PASSED ||
      r.currentStatus === RecordStatus.REVIEW_PASSED
    ).length,
    conflicts: getConflictSamples().length,
    url404: records.filter(r => r.abnormalType === AbnormalType.URL_404_PASSED).length
  };

  const quickActions = [
    {
      path: '/import',
      title: '标注导入',
      description: '导入标注员留言文件，保留原始行号',
      icon: FileUp,
      color: 'from-blue-500 to-blue-600'
    },
    {
      path: '/workbench',
      title: '质检工作台',
      description: 'AI产品经理补看模型输出片段',
      icon: ClipboardCheck,
      color: 'from-emerald-500 to-emerald-600'
    },
    {
      path: '/conflicts',
      title: '冲突样本表',
      description: '异常样本汇总，产品经理复核',
      icon: AlertTriangle,
      color: 'from-amber-500 to-amber-600'
    },
    {
      path: '/export',
      title: '数据导出',
      description: '统一数据源导出明细',
      icon: Download,
      color: 'from-violet-500 to-violet-600'
    }
  ];

  const recentRecords = records.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              欢迎回来，阿宁
            </h1>
            <p className="mt-2 text-slate-500">
              售后机器人转人工判断质检系统 · 今日需处理
              <span className="font-semibold text-amber-600 mx-1">{stats.conflicts}</span>
              条冲突样本
            </p>
          </div>
          <Link
            to="/rules"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-sm font-medium"
          >
            <BookOpen className="w-4 h-4" />
            查看边界规则
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">总记录数</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">待处理</p>
              <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">已通过</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.passed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">冲突样本</p>
              <p className="text-2xl font-bold text-amber-600">{stats.conflicts}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-white/80">链接404待复核</p>
              <p className="text-2xl font-bold">{stats.url404}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.path}
              to={action.path}
              className="group bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition-all duration-200"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                {action.title}
              </h3>
              <p className="text-sm text-slate-500">{action.description}</p>
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">最近记录</h2>
          <Link
            to="/conflicts"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            查看全部 →
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {recentRecords.map((record) => (
            <div
              key={record.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                  {record.originalLineNumber}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 line-clamp-1 max-w-xl">
                    {record.annotatorMessage}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    导入时间：{new Date(record.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
              <StatusBadge status={record.currentStatus} size="sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

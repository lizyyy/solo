import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  FileText,
  Download,
  ChevronDown,
  ChevronRight,
  MapPin,
  Play,
  Terminal,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { useStatistics } from '../hooks/useRecordQueries';
import { exportToCSV } from '../utils/export';

export default function Dashboard() {
  const navigate = useNavigate();
  const stats = useStatistics();
  const resetToSample = useRecordStore(s => s.resetToSample);
  const setFilter = useRecordStore(s => s.setFilter);
  const [expandedGuide, setExpandedGuide] = useState<number | null>(0);

  const handleExport = () => {
    const records = useRecordStore.getState().records;
    exportToCSV(records);
  };

  const handleGoToAnomaly = () => {
    setFilter('status', 'anomaly');
    navigate('/annotation');
  };

  const guides = [
    {
      icon: BookOpen,
      title: '样例在哪',
      content: [
        '数据样例存放位置：',
        '  · 控制台 → 数据管理 → 导入记录',
        '  · 点击底部"重置为样例数据"可恢复演示数据',
        '  · 样例包含12条记录，覆盖正常/异常/边界/云遮挡',
      ],
    },
    {
      icon: Play,
      title: '怎么重跑',
      content: [
        '重新标注流程：',
        '  1. 进入「空间标注」页面',
        '  2. 点击复核栏"重新计算"按钮',
        '  3. 选择计算口径版本后确认',
        '  4. 系统按经纬度+时间匹配，自动更新标注结果',
        '注意：人工备注不会被重跑覆盖',
      ],
    },
    {
      icon: Terminal,
      title: '接口返回去哪看',
      content: [
        '接口返回查看方式：',
        '  · 按 F12 打开开发者工具',
        '  · 切换到 Console（控制台）标签',
        '  · 执行操作后会打印接口响应数据',
        '  · 也可在 Network（网络）标签查看请求详情',
        '当前系统为前端演示版，数据存储于浏览器本地',
      ],
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-slate-800">接班速览</h1>
        <p className="text-sm text-slate-500 mt-1">快速了解当前数据状态，执行核心操作</p>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-8">
        <button
          onClick={() => navigate('/annotation')}
          className="group text-left bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-ocean-50 flex items-center justify-center group-hover:bg-ocean-100 transition-colors">
              <FileText className="w-6 h-6 text-ocean-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-500">查看样例</p>
              <p className="text-2xl font-semibold text-slate-800 mt-1">{stats.total} 条记录</p>
              <p className="text-xs text-ocean-600 mt-2 flex items-center gap-1">
                进入空间标注
                <ChevronRight className="w-3 h-3" />
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={handleGoToAnomaly}
          className="group text-left bg-white rounded-xl p-5 border border-alert-400/30 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-alert-400/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="flex items-start gap-4 relative">
            <div className="w-12 h-12 rounded-lg bg-alert-400/10 flex items-center justify-center group-hover:bg-alert-400/20 transition-colors">
              <AlertTriangle className="w-6 h-6 text-alert-500 animate-pulse-soft" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-500">待处理异常</p>
              <p className="text-2xl font-semibold text-alert-500 mt-1">{stats.anomaly} 条</p>
              <p className="text-xs text-alert-500 mt-2 flex items-center gap-1">
                去复核异常
                <ChevronRight className="w-3 h-3" />
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={handleExport}
          className="group text-left bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <Download className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-500">导出结果</p>
              <p className="text-lg font-semibold text-slate-800 mt-1">一键导出 CSV</p>
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                包含全部字段
                <ChevronRight className="w-3 h-3" />
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-medium text-slate-800">数据统计速览</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">已复核</span>
              <span className="text-sm font-medium text-ocean-600">{stats.reviewed} / {stats.total}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-ocean-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.total ? (stats.reviewed / stats.total) * 100 : 0}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-3">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">待复核</p>
                <p className="text-lg font-semibold text-slate-700 mt-1">{stats.pending}</p>
              </div>
              <div className="text-center p-3 bg-alert-400/10 rounded-lg">
                <p className="text-xs text-slate-500">异常</p>
                <p className="text-lg font-semibold text-alert-500 mt-1">{stats.anomaly}</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-slate-500">边界样本</p>
                <p className="text-lg font-semibold text-purple-600 mt-1">{stats.boundary}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-medium text-slate-800">操作指引</h3>
            <p className="text-xs text-slate-500 mt-0.5">接班人照做即可</p>
          </div>
          <div className="divide-y divide-slate-100">
            {guides.map((guide, idx) => (
              <div key={idx}>
                <button
                  onClick={() => setExpandedGuide(expandedGuide === idx ? null : idx)}
                  className="w-full px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <guide.icon className="w-4 h-4 text-ocean-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 flex-1">{guide.title}</span>
                  {expandedGuide === idx ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                {expandedGuide === idx && (
                  <div className="px-5 pb-4 animate-fade-in">
                    <div className="pl-7 space-y-1">
                      {guide.content.map((line, i) => (
                        <p key={i} className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-gradient-to-r from-ocean-600 to-cyan-500 rounded-xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur">
            <MapPin className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium">开始空间标注</h3>
            <p className="text-sm text-white/80 mt-0.5">复核海况数据，处理异常点，导出标注结果</p>
          </div>
          <button
            onClick={() => navigate('/annotation')}
            className="px-5 py-2 bg-white text-ocean-600 rounded-lg font-medium text-sm hover:bg-white/90 transition-colors shadow-md"
          >
            进入标注页
          </button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={resetToSample}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          重置为样例数据
        </button>
      </div>
    </div>
  );
}

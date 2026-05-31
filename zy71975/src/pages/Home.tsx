import { useNavigate } from 'react-router-dom';
import { Upload, Search, Edit3, History, Download, FileText, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react';

const features = [
  {
    title: '导入会议纪要',
    description: '上传会议纪要文件，系统自动解析并准备复核',
    icon: Upload,
    path: '/import',
    color: 'from-blue-500 to-blue-600',
  },
  {
    title: '智能复核',
    description: '基于知识库自动检测会议纪要中的偏差和问题',
    icon: Search,
    path: '/review',
    color: 'from-orange-500 to-orange-600',
  },
  {
    title: '内容修正',
    description: '对比原文与建议，快速修正会议纪要内容',
    icon: Edit3,
    path: '/correct',
    color: 'from-green-500 to-green-600',
  },
  {
    title: '历史记录',
    description: '查看所有历史版本和操作记录，支持版本对比',
    icon: History,
    path: '/history',
    color: 'from-purple-500 to-purple-600',
  },
  {
    title: '导出报告',
    description: '导出质检周报和原始数据，支持多种格式',
    icon: Download,
    path: '/export',
    color: 'from-pink-500 to-pink-600',
  },
];

const stats = [
  { label: '已处理会议', value: '128', icon: FileText, color: 'text-blue-500', bgColor: 'bg-blue-50' },
  { label: '发现问题', value: '356', icon: AlertTriangle, color: 'text-orange-500', bgColor: 'bg-orange-50' },
  { label: '已修正', value: '342', icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-50' },
  { label: '准确率', value: '96.1%', icon: TrendingUp, color: 'text-purple-500', bgColor: 'bg-purple-50' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-gradient-to-r from-primary to-primary-dark rounded-3xl p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold mb-2">会议纪要智能纠偏系统</h1>
        <p className="text-white/80 text-lg">基于知识库的会议纪要质量检测与智能修正平台</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4">功能导航</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <div
              key={index}
              onClick={() => navigate(feature.path)}
              className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer group hover:scale-[1.02]"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-slate-500 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-4">使用流程</h2>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {[
            { step: 1, title: '上传文件', desc: '导入会议纪要和知识库' },
            { step: 2, title: '智能检测', desc: '系统自动分析问题' },
            { step: 3, title: '人工复核', desc: '确认或修改修正建议' },
            { step: 4, title: '导出结果', desc: '生成报告和修正文档' },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                {item.step}
              </div>
              <div>
                <p className="font-medium text-slate-800">{item.title}</p>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
              {index < 3 && (
                <div className="hidden md:block flex-1 h-0.5 bg-slate-200 mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

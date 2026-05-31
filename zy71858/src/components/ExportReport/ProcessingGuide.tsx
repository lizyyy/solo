import { BookOpen, CheckCircle, AlertTriangle, Edit3 } from 'lucide-react';

const guides = [
  {
    icon: CheckCircle,
    title: '已确认',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    content:
      '数据经过复核确认无误，日照推演结果符合预期标准，可直接用于教学评估和成绩判定。',
  },
  {
    icon: AlertTriangle,
    title: '待补充',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    content:
      '记录存在信息缺失或参数不全的情况，需要补充实测数据、修正参数后重新复核。建议在3个工作日内完成补充。',
  },
  {
    icon: Edit3,
    title: '人工改过',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    content:
      '原始数据存在错误或偏差，已进行人工修正。需要持续跟踪验证修正效果，确保最终结果的准确性。',
  },
];

export function ProcessingGuide() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary-600" />
        处理口径说明
      </h3>

      <div className="grid md:grid-cols-3 gap-4">
        {guides.map((guide) => (
          <div key={guide.title} className={`${guide.bgColor} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <guide.icon className={`w-5 h-5 ${guide.color}`} />
              <span className={`font-semibold ${guide.color}`}>{guide.title}</span>
            </div>
            <p className="text-sm text-slate-600">{guide.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

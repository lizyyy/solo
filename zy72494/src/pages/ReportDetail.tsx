import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { ArrowLeft, User, CheckSquare, AlertTriangle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DateDisplay from '../components/DateDisplay';

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reports, complaints } = useAppStore();

  const report = reports.find((r) => r.id === id);
  const complaint = complaints.find((c) => c.id === report?.complaintId);

  if (!report) {
    return <div className="text-center py-20 text-gray-500">报告不存在</div>;
  }

  const priorityColors = {
    high: 'bg-red-50 border-red-200 text-red-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    low: 'bg-green-50 border-green-200 text-green-800',
  };

  const priorityLabels = { high: '高优先级', medium: '中优先级', low: '低优先级' };

  const nextHandlerLabels: Record<string, string> = {
    zhoujie: '社区书记周姐',
    traffic: '交通协管',
    grid: '网格员',
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/reports')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回报告列表
      </button>

      <PageHeader
        title={complaint?.title || '整改报告'}
        subtitle={`生成人：${report.generatedBy}`}
      />

      <div className="card p-8">
        <div className="text-center mb-8 pb-8 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 font-serif">
            宠物活动区投诉调解整改报告
          </h1>
          <p className="text-gray-500 mt-2">
            报告编号：{report.id} · 生成时间：<DateDisplay date={report.generatedAt} formatStr="yyyy年MM月dd日 HH:mm" />
          </p>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              整改建议
            </h2>
            <div className="space-y-4">
              {report.suggestions.map((suggestion, index) => (
                <div key={suggestion.id} className={`p-5 rounded-lg border ${priorityColors[suggestion.priority]}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <h3 className="font-medium text-lg">{suggestion.content}</h3>
                    </div>
                    <span className="badge bg-white/50 text-xs">{priorityLabels[suggestion.priority]}</span>
                  </div>
                  
                  <div className="ml-11 space-y-3">
                    <div>
                      <p className="text-sm font-medium opacity-80">为什么需要整改？</p>
                      <p className="text-sm opacity-90 mt-1">{suggestion.reason}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium opacity-80">还缺什么材料？</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {suggestion.requiredMaterials.map((m, i) => (
                          <span key={i} className="px-2 py-1 bg-white/50 rounded text-xs">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 opacity-70" />
                      <span className="text-sm">下一步该找谁：<strong>{suggestion.handler}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary-600" />
              材料清单汇总
            </h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-2">
                {report.materialList.map((material, i) => (
                  <label key={i} className="flex items-center gap-3 p-2 hover:bg-white rounded transition-colors cursor-pointer">
                    <input type="checkbox" className="rounded text-primary-600 w-4 h-4" />
                    <span className="text-sm text-gray-700">{material}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 bg-primary-50 rounded-lg border border-primary-200">
            <h2 className="text-lg font-semibold text-primary-900 mb-3">备注说明</h2>
            <p className="text-primary-800">{report.notes}</p>
            <div className="mt-4 pt-4 border-t border-primary-200 flex items-center justify-between">
              <span className="text-primary-700">
                最终责任人：
              </span>
              <span className="font-semibold text-primary-900">
                {nextHandlerLabels[report.nextHandler]}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 flex justify-between items-center text-sm text-gray-500">
          <span>报告生成系统 v1.0</span>
          <span>本报告所有建议均结合红线图备注与网格员巡查表综合生成</span>
        </div>
      </div>
    </div>
  );
}

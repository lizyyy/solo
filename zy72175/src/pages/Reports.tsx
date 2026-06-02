
import React, { useState } from 'react';
import { Download, FileText, CheckCircle, AlertTriangle, Users, RefreshCw, Calendar, Share2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { exportToCSV, formatDate } from '../utils';

export const Reports: React.FC = () => {
  const { report, samples, detections, reviews, generateReport, getSampleById, getDetectionBySampleId, getReviewBySampleId } = useAppStore();
  const [activeTab, setActiveTab] = useState<'model' | 'manual' | 'review'>('model');

  const handleExport = () => {
    const exportData = samples.map((sample) => {
      const detection = getDetectionBySampleId(sample.id);
      const review = getReviewBySampleId(sample.id);
      return {
        样本ID: sample.id,
        对话内容: sample.content.split('\n')[0],
        原始意图: sample.originalIntent,
        模型判断: detection?.modelIntent || '-',
        模型置信度: detection ? `${(detection.modelConfidence * 100).toFixed(0)}%` : '-',
        人工标注: detection?.manualIntent || '-',
        最终判定: review?.finalIntent || '-',
        改判理由: review?.reason || '-',
        是否漂移: detection?.isDrift ? '是' : '否',
        漂移分数: detection?.driftScore.toFixed(2) || '-',
        状态: sample.status,
        更新时间: sample.updatedAt,
      };
    });
    exportToCSV(exportData, `客服意图漂移监控报告_${new Date().toISOString().split('T')[0]}`);
  };

  const handleGenerateReport = () => {
    generateReport();
    alert('报告已生成！');
  };

  const getSamplesByCategory = (category: 'model' | 'manual' | 'review') => {
    const sampleIds = report.samples[
      category === 'model' ? 'modelDecision' : category === 'manual' ? 'manualCorrection' : 'needReview'
    ];
    return sampleIds.map((id) => getSampleById(id)).filter(Boolean);
  };

  const categoryConfig = {
    model: {
      title: '模型判断',
      description: '模型判断准确，无需改判',
      icon: CheckCircle,
      color: 'green',
      count: report.statistics.modelDecision,
    },
    manual: {
      title: '人工修正',
      description: '经过人工改判的样本',
      icon: Users,
      color: 'orange',
      count: report.statistics.manualCorrection,
    },
    review: {
      title: '仍需复核',
      description: '待进一步确认的样本',
      icon: AlertTriangle,
      color: 'amber',
      count: report.statistics.needReview,
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">报告中心</h1>
          <p className="text-gray-500 mt-1">生成和导出客服意图漂移检测报告</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新报告
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            导出报告
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{report.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  生成时间：{formatDate(report.generatedAt)}
                </span>
                <span>报告编号：{report.id}</span>
              </div>
            </div>
          </div>
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {(Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>).map((key) => {
          const config = categoryConfig[key];
          const Icon = config.icon;
          const colorClasses = {
            green: 'from-green-500 to-emerald-500 bg-green-100 text-green-600',
            orange: 'from-orange-500 to-red-500 bg-orange-100 text-orange-600',
            amber: 'from-amber-500 to-yellow-500 bg-amber-100 text-amber-600',
          };
          
          return (
            <div
              key={key}
              className={`bg-white rounded-xl border-2 ${
                activeTab === key ? 'border-blue-500 shadow-md' : 'border-gray-200'
              } cursor-pointer transition-all hover:shadow-md`}
              onClick={() => setActiveTab(key)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2.5 rounded-lg ${colorClasses[config.color as keyof typeof colorClasses].split(' ').slice(2).join(' ')}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-3xl font-bold ${colorClasses[config.color as keyof typeof colorClasses].split(' ').slice(3).join(' ')}`}>
                    {config.count}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-800">{config.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{config.description}</p>
              </div>
              <div className={`h-1.5 bg-gradient-to-r ${colorClasses[config.color as keyof typeof colorClasses].split(' ').slice(0, 2).join(' ')}`} />
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">检测统计概览</h3>
        <div className="grid grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-800">{report.statistics.totalSamples}</p>
            <p className="text-sm text-gray-500 mt-1">样本总数</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{report.statistics.modelDecision}</p>
            <p className="text-sm text-gray-500 mt-1">模型判断</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-600">{report.statistics.manualCorrection}</p>
            <p className="text-sm text-gray-500 mt-1">人工修正</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-amber-600">{report.statistics.needReview}</p>
            <p className="text-sm text-gray-500 mt-1">需复核</p>
          </div>
        </div>
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">整体漂移率</span>
            <span className="font-semibold text-orange-600">{report.statistics.driftRate}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-500"
              style={{ width: `${report.statistics.driftRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            {categoryConfig[activeTab].title}样本列表
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  样本ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  对话内容
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  模型判断
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  人工标注
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  最终判定
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {getSamplesByCategory(activeTab).map((sample) => {
                if (!sample) return null;
                const detection = getDetectionBySampleId(sample.id);
                const review = getReviewBySampleId(sample.id);

                return (
                  <tr key={sample.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {sample.id}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 max-w-xs truncate">
                        {sample.content.split('\n')[0]}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-blue-600">{detection?.modelIntent || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-emerald-600">{detection?.manualIntent || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-800">
                        {review?.finalIntent || detection?.modelIntent || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          sample.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : sample.status === 'reviewing'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {sample.status === 'completed' ? '已完成' : sample.status === 'reviewing' ? '待复核' : '处理中'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {getSamplesByCategory(activeTab).length === 0 && (
          <div className="p-12 text-center text-gray-500">
            暂无样本数据
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">交接说明</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-700">已完成复核</p>
                <p className="text-xs text-gray-500">{report.statistics.modelDecision + report.statistics.manualCorrection} 条样本已完成评审</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-700">待跟进事项</p>
                <p className="text-xs text-gray-500">{report.statistics.needReview} 条样本需进一步复核确认</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <p className="text-sm font-medium text-gray-700 mb-2">给产品和算法的建议</p>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              <li>当前漂移率 {report.statistics.driftRate}%，建议关注漂移趋势</li>
              <li>重点复核"投诉建议"与"发票问题"的边界样本</li>
              <li>考虑补充训练数据以优化模型在边缘场景的表现</li>
              <li>建议周姐交接时重点说明 {report.statistics.manualCorrection} 条人工改判案例</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

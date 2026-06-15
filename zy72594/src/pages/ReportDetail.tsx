import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BarChart3, AlertTriangle, ArrowLeft, Edit3, Check } from 'lucide-react';
import { useReportStore } from '../store/useReportStore';
import { StatusBadge } from '../components/common/StatusBadge';
import { StepIndicator } from '../components/common/StepIndicator';
import { VersionTimeline } from '../components/report/VersionTimeline';
import { ParamCard } from '../components/report/ParamCard';

export function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const {
    getReportById,
    getVersionsByReportId,
    getParamsByReportId,
    getNegativeSamplesByBucketId,
    getBucketById,
    updateRemark,
    advanceWorkflow,
    reviewTimeWindowIssue,
  } = useReportStore();

  const report = getReportById(id!);
  const versions = getVersionsByReportId(id!);
  const params = getParamsByReportId(id!);
  const bucket = report ? getBucketById(report.bucketId) : undefined;
  const negativeSamples = report ? getNegativeSamplesByBucketId(report.bucketId) : [];

  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [editRemark, setEditRemark] = useState('');

  if (!report) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">报告不存在</p>
        <Link to="/" className="text-sky-600 hover:text-sky-700 text-sm mt-2 inline-block">
          返回列表
        </Link>
      </div>
    );
  }

  const handleStartEdit = (sampleId: string, currentRemark: string) => {
    setEditingSampleId(sampleId);
    setEditRemark(currentRemark);
  };

  const handleSaveRemark = (sampleId: string) => {
    updateRemark(report.id, sampleId, editRemark, '推荐策略老唐');
    setEditingSampleId(null);
    if (report.workflowStep < 3) {
      advanceWorkflow(report.id);
    }
  };

  const handleReview = (approved: boolean) => {
    reviewTimeWindowIssue(report.id, approved);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft size={14} />
          返回报告列表
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-serif">{report.name}</h1>
            <p className="text-sm text-slate-500 mt-1">关联实验桶：{bucket?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={report.status} type="report" />
            <span className="text-sm text-slate-500">{report.currentVersion}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 bg-white rounded-xl p-6 border border-slate-200">
        <StepIndicator
          currentStep={report.workflowStep}
          steps={['导入实验桶', '补看负样本', '更新异常页']}
        />
      </div>

      {report.hasTimeWindowIssue && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">存在时间窗穿越问题</p>
                <p className="text-sm text-amber-700">检测到数据采集存在跨天统计，可能导致效果虚高，请实验平台负责人复核</p>
              </div>
            </div>
          </div>
          <div className="ml-8 p-3 bg-amber-100/60 rounded-lg mb-3">
            <p className="text-xs text-amber-800">
              <span className="font-medium">当前状态：</span>
              {report.status === 'pending_review'
                ? '待实验平台负责人复核，暂不归为正常。复核通过后状态将变为「已复核」，驳回则需重新统计。'
                : report.status === 'reviewed'
                ? '已由实验平台负责人复核通过，时间窗问题确认无误。'
                : '正常'}
            </p>
          </div>
          <div className="flex gap-2 ml-8">
            <button
              onClick={() => handleReview(false)}
              className="px-3 py-1.5 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
            >
              驳回重算
            </button>
            <button
              onClick={() => handleReview(true)}
              className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors"
            >
              确认无误
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">负样本列表</h2>
              <Link
                to={`/report/${report.id}/anomalies`}
                className="inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700"
              >
                <AlertTriangle size={14} />
                查看异常分析
              </Link>
            </div>
            <div className="space-y-3">
              {negativeSamples.map((sample) => (
                <div key={sample.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-sm text-slate-700 mb-2">{sample.content}</p>
                  {editingSampleId === sample.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editRemark}
                        onChange={(e) => setEditRemark(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveRemark(sample.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
                        >
                          <Check size={14} />
                          保存备注
                        </button>
                        <button
                          onClick={() => setEditingSampleId(null)}
                          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-600 bg-white px-3 py-1.5 rounded border border-slate-200 flex-1 mr-3">
                        <span className="text-slate-500 text-xs">备注：</span>
                        {sample.remark}
                      </p>
                      <button
                        onClick={() => handleStartEdit(sample.id, sample.remark)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                      >
                        <Edit3 size={14} />
                        修改
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">版本历史</h2>
            <VersionTimeline versions={versions} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">快速导航</h2>
            <div className="space-y-2">
              <Link
                to={`/report/${report.id}/visualization`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                  <BarChart3 size={20} className="text-sky-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">可视化分析</p>
                  <p className="text-xs text-slate-500">2D图表 / 3D展示</p>
                </div>
              </Link>
              <Link
                to={`/report/${report.id}/anomalies`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">异常样本分析</p>
                  <p className="text-xs text-slate-500">查看异常详情与责任分工</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">计算参数说明</h2>
            <div className="space-y-3">
              {params.map((param) => (
                <ParamCard key={param.id} param={param} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

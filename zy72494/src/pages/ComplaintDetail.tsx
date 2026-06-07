import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { 
  ArrowLeft, CheckCircle2, FileText, BarChart3,
  MapPin, ClipboardList, Calculator, FileCheck, User, Send,
  ChevronRight, Info, RefreshCw, AlertOctagon
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import AssigneeBadge from '../components/AssigneeBadge';
import DateDisplay from '../components/DateDisplay';
import { TYPE_LABELS } from '../types';

const workflowSteps = [
  { key: 'import', label: '红线图备注导入', icon: MapPin },
  { key: 'review', label: '书记查看巡查表', icon: ClipboardList },
  { key: 'rectify', label: '整改建议更新', icon: FileCheck },
];

export default function ComplaintDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getComplaintWithRelations, updateComplaintStatus, updateComplaintScore, generateReport } = useAppStore();
  const { complaint, redlineRemark, inspection, calculation, report } = getComplaintWithRelations(id || '');
  const [showRampSupplement, setShowRampSupplement] = useState(false);
  const [rampNote, setRampNote] = useState('');
  const [trafficReviewNote, setTrafficReviewNote] = useState('');

  if (!complaint) {
    return <div className="text-center py-20 text-gray-500">投诉记录不存在</div>;
  }

  const getCurrentStep = () => {
    if (complaint.status === 'pending') return 0;
    if (complaint.status === 'reviewing' || complaint.status === 'pending_traffic_review') return 1;
    if (complaint.status === 'rectifying' || complaint.status === 'completed') return 2;
    return 0;
  };

  const currentStep = getCurrentStep();

  const handleRampSupplement = () => {
    if (!rampNote.trim()) return;
    updateComplaintStatus(complaint.id, 'pending_traffic_review', rampNote);
    updateComplaintScore(
      complaint.id,
      complaint.currentScore,
      {
        score: complaint.currentScore,
        modelVersion: 'v2.1.0',
        params: {
          version: 'v2.1.0',
          rampWeight: 0.4,
          complaintWeight: 0.3,
          areaSizeFactor: 0.2,
          populationDensity: 0.1,
        },
        tradeOffReason: '坡道补录后评分未变化，原因是坡度测量值处于临界值，按现行规范无需扣分，但考虑到老年人和宠物通行安全，建议留待交通协管专业复核。',
        calculatedBy: 'system',
      }
    );
    setShowRampSupplement(false);
    setRampNote('');
  };

  const handleTrafficReview = () => {
    if (!trafficReviewNote.trim()) return;
    updateComplaintStatus(complaint.id, 'rectifying', trafficReviewNote);
    setTrafficReviewNote('');
  };

  const handleGenerateReport = () => {
    generateReport(complaint.id);
  };

  const priorityColors = {
    high: 'bg-red-50 border-red-200 text-red-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    low: 'bg-green-50 border-green-200 text-green-800',
  };

  const priorityLabels = { high: '高', medium: '中', low: '低' };

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate('/complaints')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回投诉列表
      </button>

      <PageHeader
        title={complaint.title}
        subtitle={`${complaint.code} · ${TYPE_LABELS[complaint.type]}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={complaint.status} />
            <AssigneeBadge assignee={complaint.assignee} />
          </div>
        }
      />

      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">处理流程</h3>
        <div className="flex items-center justify-between relative">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-10">
            <div 
              className="h-full bg-primary-600 transition-all duration-500"
              style={{ width: `${(currentStep / 2) * 100}%` }}
            />
          </div>
          {workflowSteps.map((step, index) => (
            <div key={step.key} className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${
                index <= currentStep 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-gray-200 text-gray-400'
              }`}>
                {index < currentStep ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
              </div>
              <p className={`mt-2 text-sm font-medium ${
                index <= currentStep ? 'text-primary-700' : 'text-gray-500'
              }`}>
                {step.label}
              </p>
            </div>
          ))}
        </div>

        {complaint.status === 'pending_traffic_review' && (
          <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800">特殊分支：坡道补录评分无变化</p>
                <p className="text-sm text-orange-700 mt-1">
                  系统检测到坡道补录后评分未变化，未直接标记为正常，已自动流转至交通协管复核。
                  {complaint.rampSupplementNote && (
                    <span className="block mt-1 text-orange-600 italic">
                      补录说明：{complaint.rampSupplementNote}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary-600" />
              关联红线图备注
            </h3>
            {redlineRemark ? (
              <div 
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => navigate(`/redline/${redlineRemark.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{redlineRemark.areaName}</p>
                    <p className="text-sm text-gray-500 mt-1">{redlineRemark.location}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  <span>宠物活动区：{redlineRemark.hasPetArea ? '是' : '否'}</span>
                  <span>坡道数量：{redlineRemark.rampCount}</span>
                  <span>版本：v{redlineRemark.currentVersion}</span>
                </div>
                <p className="mt-3 text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">
                  "{redlineRemark.remark}"
                </p>
              </div>
            ) : (
              <p className="text-gray-500">暂未关联红线图备注</p>
            )}
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary-600" />
              网格员巡查表
            </h3>
            {inspection ? (
              <div 
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => navigate(`/inspection/${inspection.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{inspection.areaName}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      巡查人：{inspection.inspector} · <DateDisplay date={inspection.inspectionDate} formatStr="yyyy-MM-dd" />
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  <span className="text-orange-600">宠物区投诉：{inspection.petAreaComplaints} 起</span>
                  <span className="text-red-600">坡道问题：{inspection.rampIssues.length} 项</span>
                </div>
                {inspection.rampIssues.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">发现的问题：</p>
                    <div className="flex flex-wrap gap-2">
                      {inspection.rampIssues.map((issue, i) => (
                        <span key={i} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded">
                          {issue}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-3 text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">
                  "{inspection.remarks}"
                </p>
              </div>
            ) : (
              <p className="text-gray-500">暂未关联巡查表</p>
            )}
          </div>

          {calculation && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary-600" />
                专业评分计算
                <span className="ml-auto text-xs font-normal bg-gray-100 px-2 py-1 rounded text-gray-600">
                  模型版本：{calculation.modelVersion}
                </span>
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-primary-50 rounded-lg text-center">
                  <p className="text-4xl font-bold text-primary-700">{calculation.score}</p>
                  <p className="text-sm text-gray-600 mt-1">综合评分</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 mb-2">计算参数</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>坡道权重</span>
                      <span className="font-mono">{calculation.params.rampWeight}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>投诉权重</span>
                      <span className="font-mono">{calculation.params.complaintWeight}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>区域系数</span>
                      <span className="font-mono">{calculation.params.areaSizeFactor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>人口密度</span>
                      <span className="font-mono">{calculation.params.populationDensity}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800 flex items-center gap-2 mb-1">
                  <Info className="w-4 h-4" />
                  取舍理由
                </p>
                <p className="text-sm text-blue-700">{calculation.tradeOffReason}</p>
              </div>

              <p className="mt-3 text-xs text-gray-500 text-right">
                计算时间：<DateDisplay date={calculation.calculatedAt} />
              </p>
            </div>
          )}

          {report && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                整改报告
                <span className="ml-auto text-xs font-normal bg-gray-100 px-2 py-1 rounded text-gray-600">
                  生成人：{report.generatedBy}
                </span>
              </h3>

              <div className="space-y-4">
                {report.suggestions.map((suggestion) => (
                  <div key={suggestion.id} className={`p-4 rounded-lg border ${priorityColors[suggestion.priority]}`}>
                    <div className="flex items-start justify-between">
                      <p className="font-medium">{suggestion.content}</p>
                      <span className="badge bg-white/50 text-xs">
                        优先级：{priorityLabels[suggestion.priority]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm opacity-80">
                      <span className="font-medium">原因：</span>{suggestion.reason}
                    </p>
                    <div className="mt-3">
                      <p className="text-xs font-medium mb-1">所需材料：</p>
                      <div className="flex flex-wrap gap-1">
                        {suggestion.requiredMaterials.map((m, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white/50 rounded text-xs">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-xs">
                      <User className="w-3 h-3 inline mr-1" />
                      责任人：{suggestion.handler}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">材料清单汇总</p>
                <div className="flex flex-wrap gap-2">
                  {report.materialList.map((m, i) => (
                    <label key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded border text-sm">
                      <input type="checkbox" className="rounded text-primary-600" />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 p-4 bg-primary-50 rounded-lg">
                <p className="text-sm text-gray-700">{report.notes}</p>
                <p className="mt-2 text-sm font-medium text-primary-700">
                  下一步责任人：{report.nextHandler === 'zhoujie' ? '社区书记周姐' : report.nextHandler === 'traffic' ? '交通协管' : '网格员'}
                </p>
              </div>

              <p className="mt-3 text-xs text-gray-500 text-right">
                生成时间：<DateDisplay date={report.generatedAt} />
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">操作</h3>
            <div className="space-y-3">
              {complaint.status === 'pending' && (
                <>
                  <button
                    onClick={() => updateComplaintStatus(complaint.id, 'reviewing')}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    开始审核
                  </button>
                </>
              )}
              
              {complaint.status === 'reviewing' && (
                <>
                  <button
                    onClick={() => setShowRampSupplement(true)}
                    className="btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    坡道补录
                  </button>
                  <button
                    onClick={() => updateComplaintStatus(complaint.id, 'rectifying')}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    提交整改
                  </button>
                </>
              )}

              {complaint.status === 'pending_traffic_review' && (
                <>
                  <textarea
                    className="input h-24 text-sm"
                    placeholder="请交通协管填写复核意见..."
                    value={trafficReviewNote}
                    onChange={(e) => setTrafficReviewNote(e.target.value)}
                  />
                  <button
                    onClick={handleTrafficReview}
                    className="btn-warning w-full flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    完成复核，进入整改
                  </button>
                </>
              )}

              {complaint.status === 'rectifying' && !report && (
                <button
                  onClick={handleGenerateReport}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  生成整改报告
                </button>
              )}

              {complaint.status === 'rectifying' && report && (
                <button
                  onClick={() => updateComplaintStatus(complaint.id, 'completed')}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  标记完成
                </button>
              )}

              <Link
                to="/visualization"
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                3D/图表展示
              </Link>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">投诉编号</span>
                <span className="font-mono text-gray-900">{complaint.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">类型</span>
                <span>{TYPE_LABELS[complaint.type]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">当前状态</span>
                <StatusBadge status={complaint.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">负责人</span>
                <AssigneeBadge assignee={complaint.assignee} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">创建时间</span>
                <DateDisplay date={complaint.createdAt} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新时间</span>
                <DateDisplay date={complaint.updatedAt} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showRampSupplement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">坡道补录</h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                补充坡道相关信息。如果补录后评分无变化，系统将自动流转至交通协管复核。
              </p>
              <textarea
                className="input h-32"
                placeholder="请填写坡道补录说明..."
                value={rampNote}
                onChange={(e) => setRampNote(e.target.value)}
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowRampSupplement(false)}
                  className="btn-secondary flex-1"
                >
                  取消
                </button>
                <button
                  onClick={handleRampSupplement}
                  className="btn-primary flex-1"
                >
                  提交补录
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

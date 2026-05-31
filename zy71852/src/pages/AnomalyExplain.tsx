import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, User, ArrowRight, Clock, FileText } from 'lucide-react';
import { useExperiments } from '@/hooks/useExperiments';
import { AnomalyTypeBadge } from '@/components/StatusBadge';
import { SourceTag } from '@/components/SourceTag';
import { formatDateTime } from '@/utils/date';
import type { Anomaly } from '@/types';

export function AnomalyExplain() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getExperimentById, getAnomaliesByExperimentId, resolveAnomaly } = useExperiments();

  const experiment = id ? getExperimentById(id) : undefined;
  const anomalies = id ? getAnomaliesByExperimentId(id) : [];

  if (!experiment) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <p>实验不存在</p>
        <button onClick={() => navigate('/experiments')} className="mt-4 text-primary hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  const resolvedCount = anomalies.filter((a) => a.resolved).length;
  const unresolvedCount = anomalies.filter((a) => !a.resolved).length;

  const handleResolve = (anomalyId: string) => {
    resolveAnomaly(anomalyId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/experiments/${id}`)}
          className="flex items-center gap-1 text-neutral-600 hover:text-primary transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">返回详情</span>
        </button>
        <h2 className="text-lg font-mono font-semibold text-neutral-900">
          异常解释 - {experiment.studentName}
        </h2>
        <AlertTriangle size={20} className="text-red-500" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-2xl font-mono font-bold text-neutral-900">{anomalies.length}</div>
          <div className="text-sm text-neutral-500">异常总数</div>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-4 bg-red-50/30">
          <div className="text-2xl font-mono font-bold text-red-600">{unresolvedCount}</div>
          <div className="text-sm text-red-600">待解决</div>
        </div>
        <div className="bg-white border border-green-200 rounded-lg p-4 bg-green-50/30">
          <div className="text-2xl font-mono font-bold text-green-600">{resolvedCount}</div>
          <div className="text-sm text-green-600">已解决</div>
        </div>
      </div>

      {anomalies.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <p className="text-neutral-700 font-medium">暂无异常记录</p>
          <p className="text-sm text-neutral-500 mt-1">学生记录与评分表数据一致</p>
        </div>
      ) : (
        <div className="space-y-4">
          {anomalies.map((anomaly) => (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              onResolve={() => handleResolve(anomaly.id)}
            />
          ))}
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="text-sm font-medium text-neutral-700 mb-3">处理流程说明</div>
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-medium">1</div>
            <span>发现异常</span>
          </div>
          <ArrowRight size={16} className="text-neutral-400" />
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-medium">2</div>
            <span>明确责任人</span>
          </div>
          <ArrowRight size={16} className="text-neutral-400" />
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium">3</div>
            <span>补录或重做</span>
          </div>
          <ArrowRight size={16} className="text-neutral-400" />
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-medium">4</div>
            <span>标记解决</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AnomalyCardProps {
  anomaly: Anomaly;
  onResolve: () => void;
}

function AnomalyCard({ anomaly, onResolve }: AnomalyCardProps) {
  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        anomaly.resolved
          ? 'bg-gray-50 border-neutral-200'
          : 'bg-white border-red-200 shadow-sm'
      }`}
    >
      <div className={`px-4 py-3 border-b ${
        anomaly.resolved ? 'bg-neutral-100 border-neutral-200' : 'bg-red-50 border-red-100'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {anomaly.resolved ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <AlertTriangle size={20} className="text-red-500" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <AnomalyTypeBadge type={anomaly.type} />
                {anomaly.relatedStepNumber && (
                  <span className="text-xs font-mono text-neutral-600">
                    涉及步骤 {anomaly.relatedStepNumber}
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                <Clock size={12} />
                {formatDateTime(anomaly.createdAt)}
              </div>
            </div>
          </div>
          <SourceTag source={anomaly.source} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="text-xs font-medium text-neutral-500 mb-1">异常描述</div>
          <p className={`text-sm ${anomaly.resolved ? 'text-neutral-600' : 'text-neutral-800'}`}>
            {anomaly.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded">
            <div className="flex items-center gap-1 text-xs font-medium text-orange-700 mb-1">
              <User size={12} />
              责任人
            </div>
            <div className="text-sm text-orange-800">{anomaly.responsiblePerson}</div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center gap-1 text-xs font-medium text-blue-700 mb-1">
              <ArrowRight size={12} />
              下一步措施
            </div>
            <div className="text-sm text-blue-800">{anomaly.nextAction}</div>
          </div>
        </div>

        {anomaly.type === 'step_skip' && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="text-xs font-medium text-yellow-700 mb-1">
              <FileText size={12} className="inline mr-1" />
              跳过来源说明
            </div>
            <div className="text-sm text-yellow-800">
              此步骤跳过标记来自
              <span className="font-medium mx-1">
                {anomaly.source === 'student' ? '[学生记录]' : '[评分表]'}
              </span>
              。如为学生误操作需联系学生补做；如为评分表标记需教师确认。
            </div>
          </div>
        )}

        {anomaly.type === 'conclusion_diff' && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded">
            <div className="text-xs font-medium text-purple-700 mb-1">
              <FileText size={12} className="inline mr-1" />
              结论改动说明
            </div>
            <div className="text-sm text-purple-800">
              此为结论修改记录，原始结论与最终结论不一致，已记录修改原因。
              请核对是否为"补材料"性质的修改，还是真正改变了实验结论。
            </div>
          </div>
        )}

        {anomaly.type === 'timing_diff' && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="text-xs font-medium text-yellow-700 mb-1">
              <Clock size={12} className="inline mr-1" />
              时序差异说明
            </div>
            <div className="text-sm text-yellow-800">
              学生记录与评分表到达时间差过大，属于"学生误操作记录先到、评分表晚半天"的典型情况。
              请确认是否为正常工作流程，还是存在数据延迟问题。
            </div>
          </div>
        )}

        {!anomaly.resolved && (
          <div className="flex justify-end pt-2 border-t border-neutral-100">
            <button
              onClick={onResolve}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              <CheckCircle size={14} />
              标记已解决
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AnomaliesOverview() {
  const navigate = useNavigate();
  const { experiments, anomalies } = useExperiments();

  const allAnomalies = anomalies.map((a) => {
    const exp = experiments.find((e) => e.id === a.experimentId);
    return { ...a, experiment: exp };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-mono font-semibold text-neutral-900">异常总览</h2>
        <div className="text-sm text-neutral-500">
          共 <span className="font-mono font-semibold text-red-600">{allAnomalies.length}</span> 条异常
        </div>
      </div>

      {allAnomalies.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <p className="text-neutral-700 font-medium">暂无异常记录</p>
          <p className="text-sm text-neutral-500 mt-1">所有实验数据一致</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allAnomalies.map((anomaly) => (
            <div
              key={anomaly.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                anomaly.resolved
                  ? 'bg-gray-50 border-neutral-200 hover:bg-gray-100'
                  : 'bg-white border-red-200 hover:bg-red-50/50'
              }`}
              onClick={() => navigate(`/experiments/${anomaly.experimentId}/anomalies`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {anomaly.resolved ? (
                    <CheckCircle size={18} className="text-green-600" />
                  ) : (
                    <AlertTriangle size={18} className="text-red-500" />
                  )}
                  <AnomalyTypeBadge type={anomaly.type} />
                  <span className="text-sm font-medium text-neutral-800">
                    {anomaly.experiment?.studentName}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {anomaly.experiment?.className}
                  </span>
                </div>
                <span className="text-xs text-neutral-500">
                  {formatDateTime(anomaly.createdAt)}
                </span>
              </div>
              <p className="text-sm text-neutral-600 mt-2 ml-7">{anomaly.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

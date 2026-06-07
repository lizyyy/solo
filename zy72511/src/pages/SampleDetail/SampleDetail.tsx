import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, FileText, Database, User, Send } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { WrongWordDiff } from '../../components/WrongWordDiff/WrongWordDiff';
import { ConflictPanel } from '../../components/ConflictPanel/ConflictPanel';
import { Timeline } from '../../components/Timeline/Timeline';
import { getSampleTypeLabel, getSampleTypeColor, getStatusLabel, getStatusColor, getStepLabel } from '../../utils';

const SampleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getSampleById, getLogsBySampleId, submitForReview, currentUser } = useStore();
  
  const sample = getSampleById(id || '');
  const logs = getLogsBySampleId(id || '');

  if (!sample) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-slate-500">样本不存在</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const handleSubmitReview = () => {
    if (confirm('确定要提交运营复核吗？')) {
      submitForReview(sample.id, currentUser.name, currentUser.role);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 mb-4"
        >
          <ArrowLeft size={16} />
          返回列表
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                样本 {sample.sampleNo} 详情
              </h2>
              <span className={`px-2 py-0.5 rounded text-xs border ${getSampleTypeColor(sample.type)}`}>
                {getSampleTypeLabel(sample.type)}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(sample.status)}`}>
                {getStatusLabel(sample.status)}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {getStepLabel(sample.currentStep)}
            </p>
          </div>

          {sample.status === 'conflict' && (
            <button
              onClick={handleSubmitReview}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors"
            >
              <Send size={16} />
              提交运营复核
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
              <FileText size={16} />
              归因分析
            </h3>
            <WrongWordDiff
              originalText={sample.originalText}
              transcribedText={sample.transcribedText}
              wrongWords={sample.wrongWords}
            />
          </div>

          {sample.hasConflict && sample.conflictEvidence && (
            <ConflictPanel
              sampleId={sample.id}
              evidence={sample.conflictEvidence}
              status={sample.status}
            />
          )}

          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
              <Clock size={16} />
              操作历史
            </h3>
            <Timeline logs={logs} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
              <Database size={16} />
              版本信息
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">模型版本</span>
                <span className="font-medium text-slate-800">{sample.modelVersion}</span>
              </div>
              {sample.originalModelVersion && (
                <div className="flex justify-between text-amber-600">
                  <span>原始模型版本</span>
                  <span className="font-medium">{sample.originalModelVersion}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">样本编号</span>
                <span className="font-medium text-slate-800">{sample.sampleNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">创建时间</span>
                <span className="text-slate-700">{sample.createdAt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">更新时间</span>
                <span className="text-slate-700">{sample.updatedAt}</span>
              </div>
            </div>
          </div>

          {sample.desensitizationRule && (
            <div className="bg-white rounded-lg border border-blue-200 p-5">
              <h3 className="text-sm font-medium text-blue-700 mb-4 flex items-center gap-2">
                <FileText size={16} />
                脱敏规则
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">规则版本</span>
                  <span className="font-medium text-slate-800">{sample.desensitizationRule.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">导入人</span>
                  <span className="text-slate-700">{sample.desensitizationRule.importedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">导入时间</span>
                  <span className="text-slate-700">{sample.desensitizationRule.importTime}</span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">备注</p>
                  <p className="text-sm text-slate-700">{sample.desensitizationRule.remarks}</p>
                </div>
              </div>
            </div>
          )}

          {sample.grayBatch && (
            <div className="bg-white rounded-lg border border-violet-200 p-5">
              <h3 className="text-sm font-medium text-violet-700 mb-4 flex items-center gap-2">
                <Database size={16} />
                灰度批次
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">批次编号</span>
                  <span className="font-medium text-slate-800">{sample.grayBatch.batchNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">模型版本</span>
                  <span className="text-slate-700">{sample.grayBatch.modelVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">样本数</span>
                  <span className="text-slate-700">{sample.grayBatch.sampleCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">数据来源</span>
                  <span className="text-slate-700">{sample.grayBatch.dataSource}</span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">备注</p>
                  <p className="text-sm text-slate-700">{sample.grayBatch.remarks}</p>
                </div>
              </div>
            </div>
          )}

          {sample.decisionRemark && (
            <div className="bg-white rounded-lg border border-emerald-200 p-5">
              <h3 className="text-sm font-medium text-emerald-700 mb-4 flex items-center gap-2">
                <CheckCircle size={16} />
                决策信息
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">复核人</span>
                  <span className="font-medium text-slate-800">{sample.reviewBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">复核时间</span>
                  <span className="text-slate-700">{sample.reviewTime}</span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">决策备注</p>
                  <p className="text-sm text-slate-700">{sample.decisionRemark}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SampleDetail;

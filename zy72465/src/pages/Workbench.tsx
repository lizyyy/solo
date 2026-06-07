import { useNavigate } from 'react-router-dom';
import { Eye, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { StatusTag, StepProgress, NameConflictTag } from '@/components/StatusTag';

export default function Workbench() {
  const navigate = useNavigate();
  const { records, currentUser } = useAppStore();

  const getDisplayCommunityName = (record: typeof records[0]) => {
    if (record.communityFinalName) return record.communityFinalName;
    if (record.communityNewName) return record.communityNewName;
    return record.communityOldName || '未知';
  };

  const stats = {
    total: records.length,
    pendingReview: records.filter(r => r.status === 'pending_review').length,
    inProgress: records.filter(r => ['imported', 'sampling_reviewed', 'summary_updated'].includes(r.status)).length,
    completed: records.filter(r => r.status === 'completed').length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: 'Source Han Serif SC, serif' }}
        >
          审批工作台
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          当前登录：{currentUser.name}（{currentUser.role === 'aning' ? '城更项目经理' : '市政巡检员'}）
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">记录总数</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-amber-200 p-5 shadow-sm bg-amber-50/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-600">待巡检员复核</p>
              <p className="mt-1 text-2xl font-bold text-amber-700">{stats.pendingReview}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">进行中</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{stats.inProgress}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Eye className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-green-200 p-5 shadow-sm bg-green-50/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">已完成</p>
              <p className="mt-1 text-2xl font-bold text-green-700">{stats.completed}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">审批记录列表</h2>
          <div className="text-xs text-gray-400">
            点击记录查看详情和证据链
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {records.map((record) => (
            <div 
              key={record.id}
              className="p-5 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => navigate(`/record/${record.id}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-medium text-gray-900 truncate">
                      {getDisplayCommunityName(record)}
                    </h3>
                    <NameConflictTag hasConflict={record.hasNameConflict} />
                    <StatusTag status={record.status} />
                  </div>
                  
                  <div className="mt-2 flex items-center gap-4 flex-wrap text-xs text-gray-500">
                    <span>原始行号: <span className="font-mono text-gray-700">#{record.originalLineNumber}</span></span>
                    {record.communityOldName && record.communityNewName && (
                      <span className="text-amber-600">
                        旧称: {record.communityOldName} → 新称: {record.communityNewName}
                      </span>
                    )}
                    <span>
                      坡道: {record.rampRecord.exists ? '有' : '无'}
                      {record.rampRecord.location && ` (${record.rampRecord.location})`}
                    </span>
                    {record.samplingPoint && (
                      <span>
                        采样点: {record.samplingPoint.exists ? '有' : '无'}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-3">
                    <StepProgress currentStep={record.currentStep} />
                  </div>
                </div>
                
                <button className="shrink-0 text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1">
                  查看详情
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

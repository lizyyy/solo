import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  MapPin, 
  CheckCircle, 
  XCircle,
  Edit3,
  Save,
  AlertTriangle
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import Timeline from '@/components/Timeline';
import { StatusTag, StepProgress, CredibilityTag, NameConflictTag } from '@/components/StatusTag';
import type { SamplingPoint, Summary } from '@/types';

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    getRecordById, 
    getHistoryByRecordId, 
    addSamplingPoint, 
    updateSummary,
    confirmFinalName,
    rollbackToHistory,
    currentUser
  } = useAppStore();

  const record = getRecordById(id || '');
  const history = getHistoryByRecordId(id || '');
  
  const [isEditingSampling, setIsEditingSampling] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isEditingFinalName, setIsEditingFinalName] = useState(false);
  
  const [samplingForm, setSamplingForm] = useState({
    exists: record?.samplingPoint?.exists ?? true,
    location: record?.samplingPoint?.location ?? '',
    credibility: record?.samplingPoint?.credibility ?? 'medium',
  });
  
  const [summaryText, setSummaryText] = useState(record?.summary?.content ?? '');
  const [finalName, setFinalName] = useState(record?.communityFinalName ?? '');
  const [rollbackConfirm, setRollbackConfirm] = useState<string | null>(null);

  if (!record) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">记录不存在</p>
        <button 
          onClick={() => navigate('/')}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          返回工作台
        </button>
      </div>
    );
  }

  const getDisplayCommunityName = () => {
    if (record.communityFinalName) return record.communityFinalName;
    if (record.communityNewName) return record.communityNewName;
    return record.communityOldName || '未知';
  };

  const handleSaveSampling = () => {
    const sampling: SamplingPoint = {
      exists: samplingForm.exists,
      location: samplingForm.location,
      credibility: samplingForm.credibility,
      reviewedBy: currentUser.name,
      reviewedAt: new Date(),
    };
    addSamplingPoint(record.id, sampling);
    setIsEditingSampling(false);
  };

  const handleSaveSummary = () => {
    const summary: Summary = {
      content: summaryText,
      updatedBy: currentUser.name,
      updatedAt: new Date(),
    };
    updateSummary(record.id, summary);
    setIsEditingSummary(false);
  };

  const handleSaveFinalName = () => {
    confirmFinalName(record.id, finalName, currentUser.name);
    setIsEditingFinalName(false);
  };

  const handleRollback = (historyId: string) => {
    if (rollbackConfirm === historyId) {
      rollbackToHistory(record.id, historyId, currentUser.name);
      setRollbackConfirm(null);
    } else {
      setRollbackConfirm(historyId);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回工作台
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 
                className="text-xl font-bold text-gray-900"
                style={{ fontFamily: 'Source Han Serif SC, serif' }}
              >
                {getDisplayCommunityName()}
              </h1>
              <NameConflictTag hasConflict={record.hasNameConflict} />
              <StatusTag status={record.status} />
            </div>
            
            <div className="mt-3 space-y-1.5 text-sm text-gray-500">
              <p className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                原始行号: <span className="font-mono text-gray-700">#{record.originalLineNumber}</span>
              </p>
              {(record.communityOldName || record.communityNewName) && (
                <p>
                  {record.communityOldName && <span>旧称: {record.communityOldName}</span>}
                  {record.communityOldName && record.communityNewName && <span className="mx-2">→</span>}
                  {record.communityNewName && <span>新称: {record.communityNewName}</span>}
                  {record.communityFinalName && (
                    <span className="ml-2 text-green-600">（已确认为: {record.communityFinalName}）</span>
                  )}
                </p>
              )}
            </div>
          </div>
          
          <StepProgress currentStep={record.currentStep} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              无障碍坡道记录
            </h2>
            <span className="text-xs text-gray-400">来源：导入数据</span>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              {record.rampRecord.exists ? (
                <span className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </span>
              ) : (
                <span className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-500" />
                </span>
              )}
              <div>
                <p className="font-medium text-gray-900">
                  {record.rampRecord.exists ? '存在无障碍坡道' : '未设置无障碍坡道'}
                </p>
                <p className="text-sm text-gray-500">原始导入数据</p>
              </div>
            </div>
            
            {record.rampRecord.location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">位置: {record.rampRecord.location}</span>
              </div>
            )}
            
            {record.rampRecord.condition && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500">状况:</span>
                <span className="text-gray-700">{record.rampRecord.condition}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              夜间采样点记录
            </h2>
            {currentUser.role === 'aning' && (
              <button
                onClick={() => setIsEditingSampling(!isEditingSampling)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                {isEditingSampling ? '取消' : '阿宁补看'}
              </button>
            )}
          </div>
          
          {isEditingSampling ? (
            <div className="p-5 space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={samplingForm.exists}
                    onChange={(e) => setSamplingForm({ ...samplingForm, exists: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  存在夜间采样点
                </label>
              </div>
              
              {samplingForm.exists && (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">采样点位置</label>
                    <input
                      type="text"
                      value={samplingForm.location}
                      onChange={(e) => setSamplingForm({ ...samplingForm, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="如：南门保安亭旁"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">可信度</label>
                    <select
                      value={samplingForm.credibility}
                      onChange={(e) => setSamplingForm({ ...samplingForm, credibility: e.target.value as 'high' | 'medium' | 'low' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                    </select>
                  </div>
                </>
              )}
              
              <button
                onClick={handleSaveSampling}
                className="w-full py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                保存补看结果
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {record.samplingPoint ? (
                <>
                  <div className="flex items-center gap-3">
                    {record.samplingPoint.exists ? (
                      <span className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </span>
                    ) : (
                      <span className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-gray-400" />
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {record.samplingPoint.exists ? '存在夜间采样点' : '未设置夜间采样点'}
                      </p>
                      <p className="text-sm text-gray-500">
                        审阅人: {record.samplingPoint.reviewedBy}
                      </p>
                    </div>
                  </div>
                  
                  {record.samplingPoint.location && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">位置: {record.samplingPoint.location}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 text-sm">
                    <CredibilityTag credibility={record.samplingPoint.credibility} />
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-amber-400" />
                  <p className="text-sm">阿宁尚未补看夜间采样点</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {record.hasNameConflict && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800">新旧名称待复核</h3>
                <p className="mt-1 text-sm text-amber-700">
                  该小区存在新旧两个名称：
                  <span className="font-medium">「{record.communityOldName}」</span>
                  <span className="mx-2">→</span>
                  <span className="font-medium">「{record.communityNewName}」</span>
                </p>
                {record.communityFinalName ? (
                  <p className="mt-2 text-sm text-green-700">
                    ✓ 巡检员已确认为：<span className="font-medium">「{record.communityFinalName}」</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amber-600">
                    请巡检员确认最终名称后再继续
                  </p>
                )}
              </div>
            </div>
            
            {currentUser.role === 'inspector' && !record.communityFinalName && (
              <div className="shrink-0">
                {isEditingFinalName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={finalName}
                      onChange={(e) => setFinalName(e.target.value)}
                      className="px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="输入最终名称"
                    />
                    <button
                      onClick={handleSaveFinalName}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700"
                    >
                      确认
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setFinalName(record.communityNewName || record.communityOldName || '');
                      setIsEditingFinalName(true);
                    }}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors"
                  >
                    确认最终名称
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            街道会看摘要
          </h2>
          {currentUser.role === 'aning' && record.currentStep >= 2 && (
            <button
              onClick={() => setIsEditingSummary(!isEditingSummary)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              {isEditingSummary ? '取消' : '更新摘要'}
            </button>
          )}
        </div>
        
        {isEditingSummary ? (
          <div className="p-5 space-y-4">
            <textarea
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="请输入给街道会看的摘要内容..."
            />
            <button
              onClick={handleSaveSummary}
              className="px-5 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存摘要
            </button>
          </div>
        ) : (
          <div className="p-5">
            {record.summary ? (
              <div>
                <p className="text-gray-700 leading-relaxed">{record.summary.content}</p>
                <p className="mt-3 text-xs text-gray-400">
                  更新人: {record.summary.updatedBy} | {new Date(record.summary.updatedAt).toLocaleString('zh-CN')}
                </p>
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">
                尚未更新街道会看摘要
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-600" />
            操作历史（证据链）
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            原始行号、人工改动、处理状态全部留存，市政巡检员可回溯查证
          </p>
        </div>
        <div className="p-5">
          <Timeline 
            entries={history} 
            canRollback={currentUser.role === 'aning' || currentUser.role === 'inspector'}
            onRollback={handleRollback}
          />
          {rollbackConfirm && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-700">
                确定要回滚到该状态吗？回滚操作本身也会被记录。
                <button
                  onClick={() => setRollbackConfirm(null)}
                  className="ml-3 text-xs text-gray-500 hover:text-gray-700"
                >
                  取消
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

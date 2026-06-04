import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, History, Edit3, Calculator, CheckCircle2, XCircle } from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import type { AnswerStatus } from '@/types';

const AnswerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    studentAnswers,
    getStudentAnswersByStudentId,
    getHistoryByTargetId,
    updateAnswerStatus,
    updateAnswerRemark,
    updateAnswerManualExample,
  } = useAppStore();

  const answer = studentAnswers.find((a) => a.id === id);
  const [editingRemark, setEditingRemark] = useState(false);
  const [remarkValue, setRemarkValue] = useState(answer?.remark || '');
  const [editingExample, setEditingExample] = useState(false);
  const [exampleValue, setExampleValue] = useState(answer?.manualExample || '');
  const [showHistory, setShowHistory] = useState(false);

  if (!answer) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">答案不存在</p>
        <button
          onClick={() => navigate('/answers')}
          className="mt-4 text-amber-600 hover:text-amber-700"
        >
          返回列表
        </button>
      </div>
    );
  }

  const allVersions = getStudentAnswersByStudentId(answer.studentId);
  const historyRecords = getHistoryByTargetId(answer.id);

  const handleSaveRemark = () => {
    updateAnswerRemark(answer.id, remarkValue);
    setEditingRemark(false);
  };

  const handleSaveExample = () => {
    updateAnswerManualExample(answer.id, exampleValue);
    setEditingExample(false);
  };

  const handleStatusChange = (status: AnswerStatus) => {
    updateAnswerStatus(answer.id, status);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/answers')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {answer.studentName} - 答案详情
          </h1>
          <p className="text-slate-500">版本 v{answer.version} · 提交于 {answer.createdAt}</p>
        </div>
      </div>

      {allVersions.length > 1 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <History className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-800">
                该学生提交了 {allVersions.length} 版答案
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {allVersions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => navigate(`/answers/${v.id}`)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      v.id === answer.id
                        ? 'bg-amber-500 text-white'
                        : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    v{v.version}
                    {v.id === answer.id && ' (当前)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">答案内容</h3>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-slate-700 whitespace-pre-wrap">{answer.content}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800">手算反例（吴老师补充）</h3>
              </div>
              {!editingExample ? (
                <button
                  onClick={() => {
                    setExampleValue(answer.manualExample || '');
                    setEditingExample(true);
                  }}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
                >
                  <Edit3 className="w-4 h-4" />
                  编辑
                </button>
              ) : (
                <button
                  onClick={handleSaveExample}
                  className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
                >
                  <Save className="w-4 h-4" />
                  保存
                </button>
              )}
            </div>
            {editingExample ? (
              <textarea
                value={exampleValue}
                onChange={(e) => setExampleValue(e.target.value)}
                className="w-full h-32 px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 resize-none"
                placeholder="输入手算反例验证过程..."
              />
            ) : (
              <div className="bg-blue-50 rounded-lg p-4">
                {answer.manualExample ? (
                  <p className="text-slate-700 whitespace-pre-wrap">{answer.manualExample}</p>
                ) : (
                  <p className="text-slate-400 italic">暂无手算反例，点击编辑添加</p>
                )}
              </div>
            )}
          </div>

          {showHistory && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">修改历史</h3>
              <div className="space-y-4">
                {historyRecords.length > 0 ? (
                  historyRecords.map((record) => (
                    <div key={record.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-slate-300 rounded-full" />
                        <div className="w-px h-full bg-slate-200" />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">
                            {record.operator}
                          </span>
                          <span className="text-xs text-slate-400">
                            {record.operatedAt}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          修改了 <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">
                            {record.fieldName}
                          </code>
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-400">修改前</p>
                            <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded mt-1">
                              {record.oldValue || '(空)'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">修改后</p>
                            <p className="text-sm text-emerald-600 bg-emerald-50 px-2 py-1 rounded mt-1">
                              {record.newValue || '(空)'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-sm">暂无修改记录</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">状态管理</h3>
            <div className="space-y-3">
              <StatusBadge status={answer.status} />
              <div className="pt-4 space-y-2">
                <button
                  onClick={() => handleStatusChange('normal')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-emerald-50 text-left transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-slate-700">标记为正常</span>
                </button>
                <button
                  onClick={() => handleStatusChange('exception')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-left transition-colors"
                >
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-slate-700">标记为异常</span>
                </button>
                <button
                  onClick={() => handleStatusChange('reviewing')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-50 text-left transition-colors"
                >
                  <History className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-slate-700">留待运营复核</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">备注</h3>
              {!editingRemark ? (
                <button
                  onClick={() => {
                    setRemarkValue(answer.remark);
                    setEditingRemark(true);
                  }}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <Edit3 className="w-4 h-4 text-slate-400" />
                </button>
              ) : (
                <button
                  onClick={handleSaveRemark}
                  className="p-1 hover:bg-emerald-50 rounded"
                >
                  <Save className="w-4 h-4 text-emerald-600" />
                </button>
              )}
            </div>
            {editingRemark ? (
              <textarea
                value={remarkValue}
                onChange={(e) => setRemarkValue(e.target.value)}
                className="w-full h-24 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 text-sm resize-none"
              />
            ) : (
              <p className="text-sm text-slate-600">{answer.remark}</p>
            )}
          </div>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <History className="w-4 h-4" />
            {showHistory ? '隐藏修改历史' : '查看修改历史'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnswerDetail;

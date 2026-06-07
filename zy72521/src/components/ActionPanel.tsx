import { useState } from 'react';
import { Link, RefreshCw, UserCheck, AlertTriangle, X, Check } from 'lucide-react';
import { CopyrightRecord } from '../types';
import { useRecordStore } from '../store/useRecordStore';

interface ActionPanelProps {
  record: CopyrightRecord;
}

export function ActionPanel({ record }: ActionPanelProps) {
  const { supplementKnowledgeBase, submitAlgorithmReview, confirmFixComplete, rerunExport } = useRecordStore();
  const [showKbForm, setShowKbForm] = useState(false);
  const [kbLink, setKbLink] = useState(record.knowledgeBaseLink);
  const [kbSource, setKbSource] = useState(record.knowledgeBaseSource);
  const [operator, setOperator] = useState('小乔');

  const handleSupplementKb = () => {
    if (!kbLink.trim() || !kbSource.trim()) return;
    supplementKnowledgeBase(record.id, kbLink, kbSource, operator);
    setShowKbForm(false);
  };

  const needsKbSupplement = !record.knowledgeBaseLink;
  const hasPhoneLeak = record.hasPhoneLeak;
  const isPendingReview = record.status === 'pending_review';

  return (
    <div className="space-y-4">
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
          快捷操作
        </h4>
        
        <div className="space-y-2">
          {needsKbSupplement && (
            <button
              onClick={() => setShowKbForm(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Link className="w-4 h-4" />
              补录知识库引用链接
            </button>
          )}

          {hasPhoneLeak && isPendingReview && (
            <>
              <button
                onClick={() => submitAlgorithmReview(record.id, operator)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors text-sm font-medium"
              >
                <AlertTriangle className="w-4 h-4" />
                通知算法同事复核
              </button>
              
              <button
                onClick={() => confirmFixComplete(record.id, '算法同事')}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium"
              >
                <UserCheck className="w-4 h-4" />
                算法同事已复核，确认修正
              </button>
            </>
          )}

          <button
            onClick={() => rerunExport(record.id, operator)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            重新生成脱敏导出
          </button>
        </div>
      </div>

      {showKbForm && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-blue-800 flex items-center gap-2">
              <Link className="w-4 h-4" />
              补录知识库引用
            </h4>
            <button
              onClick={() => setShowKbForm(false)}
              className="text-blue-400 hover:text-blue-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">
                操作人
              </label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="输入操作人姓名"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">
                知识库链接
              </label>
              <input
                type="text"
                value={kbLink}
                onChange={(e) => setKbLink(e.target.value)}
                className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="https://kb.example.com/article/..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">
                口径来源说明
              </label>
              <input
                type="text"
                value={kbSource}
                onChange={(e) => setKbSource(e.target.value)}
                className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例如：2023年版权口径第1版"
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSupplementKb}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Check className="w-4 h-4" />
                确认补录
              </button>
              <button
                onClick={() => setShowKbForm(false)}
                className="px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50 transition-colors text-sm font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {hasPhoneLeak && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800 mb-1">
                手机号在导出里漏遮
              </h4>
              <p className="text-sm text-red-600 mb-2">
                检测到导出内容中包含未脱敏的手机号，别急着归为正常记录。
              </p>
              <p className="text-sm text-red-500">
                请通知算法同事复核，确认修正完成后再标记为正常。
              </p>
              {record.leakedPhone && (
                <p className="mt-2 text-sm font-mono bg-red-100 px-2 py-1 rounded inline-block text-red-700">
                  检测到：{record.leakedPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {record.status === 'supplemented' && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 mb-1">
                已补录知识库引用
              </h4>
              <p className="text-sm text-blue-600">
                这条记录的知识库链接是后来补录的，来源为旧口径文档。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

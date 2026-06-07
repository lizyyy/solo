import { FileText, Clock, Link as LinkIcon, Database, History } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { StatusBadge } from './StatusBadge';
import { HistoryTimeline } from './HistoryTimeline';
import { ActionPanel } from './ActionPanel';

export function DetailPanel() {
  const getSelectedRecord = useRecordStore((state) => state.getSelectedRecord);
  const record = getSelectedRecord();

  if (!record) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <div className="text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>请选择一条记录查看详情</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              {record.materialName}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md text-sm font-mono text-slate-700">
                <Database className="w-3.5 h-3.5" />
                提示词版本 {record.promptVersion}
              </span>
              <StatusBadge status={record.status} />
              <span className="inline-flex items-center gap-1 text-sm text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                {record.createdAt}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-slate-500" />
                  知识库引用
                </h3>
                {record.knowledgeBaseLink ? (
                  <div className="space-y-2">
                    <a
                      href={record.knowledgeBaseLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm break-all font-mono"
                    >
                      {record.knowledgeBaseLink}
                    </a>
                    <p className="text-sm text-slate-500">
                      来源：{record.knowledgeBaseSource}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-amber-600">
                    ⚠️ 缺少知识库引用链接，请在右侧操作面板补录
                  </p>
                )}
              </div>

              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  脱敏导出预览
                </h3>
                <div className={`p-4 rounded-lg font-mono text-sm whitespace-pre-wrap leading-relaxed ${
                  record.hasPhoneLeak 
                    ? 'bg-red-50 border border-red-200 text-red-900' 
                    : 'bg-slate-50 border border-slate-200 text-slate-700'
                }`}>
                  {record.exportContent}
                </div>
                
                {record.hasPhoneLeak && (
                  <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-md">
                    <p className="text-sm text-red-800 font-medium">
                      ⚠️ 重要提示：手机号在导出里漏遮了！
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      请不要直接标记为正常，先让算法同事复核一下。
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white rounded-lg border border-slate-200">
                <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  操作历史
                </h3>
                <HistoryTimeline history={record.history} />
              </div>
            </div>

            <div className="space-y-6">
              <ActionPanel record={record} />
              
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-medium text-slate-700 mb-2 text-sm">💡 演示说明</h4>
                <ul className="text-xs text-slate-500 space-y-1.5">
                  <li>• <span className="text-emerald-600 font-medium">正常记录</span>：流程顺利，无异常</li>
                  <li>• <span className="text-amber-600 font-medium">待复核记录</span>：手机号漏遮，需算法确认</li>
                  <li>• <span className="text-blue-600 font-medium">已补录记录</span>：知识库链接后补的</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

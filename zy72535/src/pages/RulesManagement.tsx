import { useState } from 'react';
import {
  Upload,
  Plus,
  Edit3,
  History,
  CheckCircle,
  XCircle,
  Save,
} from 'lucide-react';
import { useReviewStore } from '@/store';
import { formatDate } from '@/utils/hash';
import type { ImportResult } from '@/types';

export default function RulesManagement() {
  const {
    rules,
    records,
    importRules,
    updateRuleRemark,
    getChangeHistoryByRecord,
  } = useReviewStore();

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRemark, setEditRemark] = useState('');
  const [editReason, setEditReason] = useState('');
  const [showHistoryRuleId, setShowHistoryRuleId] = useState<string | null>(null);

  const handleImport = async () => {
    if (!importText.trim()) return;

    const lines = importText.split('\n').filter(line => line.trim());
    const rulesToImport = lines.map(line => {
      const [content, remark] = line.split('|').map(s => s.trim());
      return {
        content: content || '',
        remark: remark || '初次导入',
      };
    }).filter(r => r.content);

    const result = await importRules(rulesToImport);
    setImportResult(result);
    setImportText('');

    setTimeout(() => setImportResult(null), 5000);
  };

  const startEdit = (ruleId: string, currentRemark: string) => {
    setEditingId(ruleId);
    setEditRemark(currentRemark);
    setEditReason('');
  };

  const saveEdit = (ruleId: string) => {
    if (!editReason.trim()) {
      alert('请填写变更原因');
      return;
    }
    updateRuleRemark(ruleId, editRemark, editReason);
    setEditingId(null);
    setEditRemark('');
    setEditReason('');
  };

  const getRuleHistory = (ruleId: string) => {
    const record = records.find(r => r.ruleId === ruleId);
    if (!record) return [];
    return getChangeHistoryByRecord(record.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary-500">
            脱敏规则备注管理
          </h1>
          <p className="mt-2 text-slate-600">
            导入脱敏规则，自动去重不翻倍。编辑备注自动记录变更历史。
          </p>
        </div>
        <button
          onClick={() => setShowImport(!showImport)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-md"
        >
          <Upload className="w-4 h-4" />
          导入脱敏规则
        </button>
      </div>

      {showImport && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-primary-200">
          <h3 className="text-lg font-semibold text-primary-500 mb-4">
            导入脱敏规则备注
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            格式：规则内容 | 备注结论（每行一条，系统自动去重）
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={`主播真实姓名需脱敏 | 姓名脱敏-结论：职场类脚本高发\n手机号中间四位打码 | 手机号脱敏-结论：电商类脚本常见`}
            className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
          <div className="flex justify-between items-center mt-4">
            {importResult && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  新增 {importResult.added} 条
                </span>
                <span className="text-slate-500 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  跳过重复 {importResult.skipped} 条
                </span>
                <span className="text-slate-700">
                  共 {importResult.total} 条
                </span>
              </div>
            )}
            <div className="flex gap-3 ml-auto">
              <button
                onClick={() => setShowImport(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                className="flex items-center gap-2 px-4 py-2 bg-accent-teal text-white rounded-lg hover:bg-teal-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-primary-50">
            <tr>
              <th className="text-left py-4 px-6 font-medium text-primary-500">规则内容</th>
              <th className="text-left py-4 px-6 font-medium text-primary-500">备注结论</th>
              <th className="text-left py-4 px-6 font-medium text-primary-500">创建人</th>
              <th className="text-left py-4 px-6 font-medium text-primary-500">创建时间</th>
              <th className="text-left py-4 px-6 font-medium text-primary-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="py-4 px-6">
                  <p className="text-sm text-slate-800 max-w-sm">{rule.content}</p>
                </td>
                <td className="py-4 px-6">
                  {editingId === rule.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editRemark}
                        onChange={(e) => setEditRemark(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="输入新的备注结论"
                      />
                      <input
                        type="text"
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        className="w-full px-3 py-1.5 border border-amber-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="* 必填：变更原因"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">{rule.remark}</p>
                  )}
                </td>
                <td className="py-4 px-6 text-sm text-slate-500">
                  {rule.createdBy}
                </td>
                <td className="py-4 px-6 text-sm text-slate-500">
                  {formatDate(rule.createdAt)}
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-2">
                    {editingId === rule.id ? (
                      <>
                        <button
                          onClick={() => saveEdit(rule.id)}
                          className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-sm"
                        >
                          <Save className="w-4 h-4" />
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-slate-500 hover:text-slate-700 text-sm"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(rule.id, rule.remark)}
                          className="text-primary-500 hover:text-primary-600 flex items-center gap-1 text-sm"
                        >
                          <Edit3 className="w-4 h-4" />
                          编辑备注
                        </button>
                        <button
                          onClick={() => setShowHistoryRuleId(showHistoryRuleId === rule.id ? null : rule.id)}
                          className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-sm"
                        >
                          <History className="w-4 h-4" />
                          变更历史
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showHistoryRuleId && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-primary-500 mb-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            变更历史记录
          </h3>
          {getRuleHistory(showHistoryRuleId).length === 0 ? (
            <p className="text-slate-500 text-sm">暂无变更历史</p>
          ) : (
            <div className="space-y-4">
              {getRuleHistory(showHistoryRuleId).map((history) => (
                <div key={history.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        变更字段：{history.fieldName}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {history.changedBy} · {formatDate(history.changedAt)}
                      </p>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                      {history.changeReason}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 p-3 rounded">
                      <p className="text-xs text-red-600 font-medium mb-1">变更前</p>
                      <p className="text-sm text-slate-700 line-through">{history.oldValue}</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded">
                      <p className="text-xs text-emerald-600 font-medium mb-1">变更后</p>
                      <p className="text-sm text-slate-700">{history.newValue}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

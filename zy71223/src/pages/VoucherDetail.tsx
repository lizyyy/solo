import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useVoucherStore } from '../store/voucherStore';
import { formatStatus, formatMoney, formatDate, formatDateTime } from '../components/Layout';
import {
  ArrowLeft, Image, FileText, BookOpen, MessageSquare, History,
  AlertTriangle, CheckCircle, RefreshCw, Save, Zap
} from 'lucide-react';
import type { SubjectMapping } from '../../shared/types';

export default function VoucherDetail() {
  const { id } = useParams<{ id: string }>();
  const {
    voucher, subjects, suggestions, fetchVoucher, fetchSubjects,
    getSubjectSuggestions, parseVoucher, updateSubjectMapping,
    addNote, completeVoucher, loading, error, clearError
  } = useVoucherStore();

  const [noteContent, setNoteContent] = useState('');
  const [editingMapping, setEditingMapping] = useState<string | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState('');

  useEffect(() => {
    if (id) {
      fetchVoucher(id);
      fetchSubjects();
    }
  }, [id, fetchVoucher, fetchSubjects]);

  useEffect(() => {
    if (id && voucher?.status === 'reviewing') {
      getSubjectSuggestions(id);
    }
  }, [id, voucher?.status, getSubjectSuggestions]);

  if (!voucher && !loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>凭证不存在或已被删除</p>
        <Link to="/vouchers" className="text-primary-600 hover:underline mt-2 inline-block">返回列表</Link>
      </div>
    );
  }

  const status = voucher ? formatStatus(voucher.status) : null;
  const isException = voucher?.status === 'exception';
  const needsReview = voucher?.status === 'reviewing' || voucher?.status === 'exception';

  const totalDebit = voucher?.mappings.filter(m => m.direction === 'debit').reduce((sum, m) => sum + m.amount, 0) || 0;
  const totalCredit = voucher?.mappings.filter(m => m.direction === 'credit').reduce((sum, m) => sum + m.amount, 0) || 0;
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleUpdateMapping = async (mappingId: string, subjectId: string) => {
    if (!id || !adjustmentReason.trim()) return;
    await updateSubjectMapping(id, mappingId, { subjectId, adjustmentReason }, '张会计');
    setEditingMapping(null);
    setAdjustmentReason('');
  };

  const handleAddNote = async () => {
    if (!id || !noteContent.trim()) return;
    await addNote(id, noteContent.trim(), '张会计');
    setNoteContent('');
  };

  const handleParse = async () => {
    if (!id) return;
    await parseVoucher(id, '张会计');
  };

  const handleComplete = async () => {
    if (!id || !isBalanced) return;
    await completeVoucher(id, '张会计');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/vouchers" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {voucher?.voucherNo} - {voucher?.customerName}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {formatDate(voucher?.date || '')} · {formatMoney(voucher?.amount || 0)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${status.class}`}>
              {status.label}
            </span>
          )}
          {needsReview && (
            <button
              onClick={handleParse}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              重新解析
            </button>
          )}
          {needsReview && isBalanced && (
            <button
              onClick={handleComplete}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle size={16} />
              审核完成
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            {error}
          </div>
          <button onClick={clearError} className="text-sm hover:underline">关闭</button>
        </div>
      )}

      {isException && (
        <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-amber-800">票据清晰度不足，需要人工确认</p>
              <p className="text-sm text-amber-700 mt-1">
                识别置信度：{voucher?.parseResult?.confidence || 0}%，建议核对金额和日期后再进行审核
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Image size={18} className="text-primary-600" />
              <h3 className="font-semibold text-gray-900">票据照片</h3>
            </div>
            <div className="p-5">
              {voucher?.images.length === 0 ? (
                <div className="text-center py-8 text-gray-400">无票据照片</div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {voucher?.images.map(img => (
                    <div key={img.id} className="relative group">
                      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                        <div className="text-center p-4">
                          <Image size={40} className="mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600 font-medium truncate">{img.fileName}</p>
                          <p className="text-xs text-gray-400 mt-1">清晰度：{img.clarity}%</p>
                        </div>
                      </div>
                      {img.clarity < 70 && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full flex items-center gap-1">
                          <AlertTriangle size={10} />
                          模糊
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <FileText size={18} className="text-primary-600" />
              <h3 className="font-semibold text-gray-900">解析结果</h3>
            </div>
            <div className="p-5">
              {!voucher?.parseResult ? (
                <div className="text-center py-8 text-gray-400">未解析</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">识别金额</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {formatMoney(voucher.parseResult.amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">识别日期</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {formatDate(voucher.parseResult.date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">置信度</p>
                      <p className={`text-lg font-semibold mt-1 ${voucher.parseResult.confidence < 70 ? 'text-red-600' : 'text-gray-900'}`}>
                        {voucher.parseResult.confidence}%
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">识别商户</p>
                    <p className="text-gray-900 mt-1">{voucher.parseResult.merchant}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">原始识别文本</p>
                    <p className="text-gray-600 mt-1 text-sm bg-gray-50 p-3 rounded-lg font-mono">
                      {voucher.parseResult.rawText}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-primary-600" />
                <h3 className="font-semibold text-gray-900">科目映射</h3>
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {isBalanced ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                借 {formatMoney(totalDebit)} = 贷 {formatMoney(totalCredit)}
                {isBalanced ? ' 平衡' : ' 不平衡'}
              </div>
            </div>
            <div className="p-5">
              {voucher?.mappings.length === 0 ? (
                <div className="text-center py-8 text-gray-400">暂无科目映射</div>
              ) : (
                <div className="space-y-3">
                  {voucher?.mappings.map(mapping => (
                    <div
                      key={mapping.id}
                      className={`p-4 rounded-lg border ${
                        mapping.adjustedBy ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            mapping.direction === 'debit' ? 'bg-amber-100 text-amber-800' : 'bg-cyan-100 text-cyan-800'
                          }`}>
                            {mapping.direction === 'debit' ? '借' : '贷'}
                          </span>
                          {editingMapping === mapping.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={mapping.subjectId}
                                onChange={(e) => handleUpdateMapping(mapping.id, e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                autoFocus
                              >
                                {subjects.map(s => (
                                  <option key={s.id} value={s.id}>{s.code} {s.name}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="调整原因..."
                                value={adjustmentReason}
                                onChange={(e) => setAdjustmentReason(e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
                              />
                              <button
                                onClick={() => { setEditingMapping(null); setAdjustmentReason(''); }}
                                className="p-1.5 text-gray-400 hover:text-gray-600"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium text-gray-900">
                                {mapping.subjectCode} {mapping.subjectName}
                              </span>
                              {mapping.isSuggested && (
                                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                  <Zap size={10} className="inline mr-1" />
                                  智能建议
                                </span>
                              )}
                              {mapping.adjustedBy && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  人工调整
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-gray-900">{formatMoney(mapping.amount)}</span>
                          {needsReview && editingMapping !== mapping.id && (
                            <button
                              onClick={() => { setEditingMapping(mapping.id); setAdjustmentReason(''); }}
                              className="text-xs text-primary-600 hover:text-primary-700"
                            >
                              调整科目
                            </button>
                          )}
                        </div>
                      </div>
                      {mapping.suggestionReason && (
                        <p className="text-xs text-gray-500 mt-2 pl-20">
                          建议理由：{mapping.suggestionReason}
                        </p>
                      )}
                      {mapping.adjustmentReason && (
                        <p className="text-xs text-blue-600 mt-2 pl-20">
                          调整理由：{mapping.adjustmentReason} · {mapping.adjustedBy} · {formatDateTime(mapping.adjustedAt || '')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {suggestions.length > 0 && needsReview && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500 mb-3">智能科目建议</p>
                  <div className="grid grid-cols-3 gap-3">
                    {suggestions.map((s, idx) => (
                      <div key={idx} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 text-sm">{s.subjectCode} {s.subjectName}</span>
                          <span className="text-xs text-purple-600">{s.confidence}%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{s.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <MessageSquare size={18} className="text-primary-600" />
              <h3 className="font-semibold text-gray-900">客户备注</h3>
            </div>
            <div className="p-5">
              {needsReview && (
                <div className="mb-4">
                  <textarea
                    placeholder="添加备注..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows={3}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!noteContent.trim() || loading}
                    className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    <Save size={14} />
                    添加
                  </button>
                </div>
              )}
              <div className="space-y-3 max-h-64 overflow-auto">
                {voucher?.notes.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">暂无备注</div>
                ) : (
                  voucher?.notes.map(note => (
                    <div key={note.id} className={`p-3 rounded-lg ${
                      note.createdBy === 'system' ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'
                    }`}>
                      <p className="text-sm text-gray-700">{note.content}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {note.createdBy} · {formatDateTime(note.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <History size={18} className="text-primary-600" />
              <h3 className="font-semibold text-gray-900">修订历史</h3>
            </div>
            <div className="p-5">
              <div className="space-y-3 max-h-96 overflow-auto">
                {voucher?.revisions.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">暂无修订记录</div>
                ) : (
                  voucher?.revisions.map(rev => (
                    <div key={rev.id} className="relative pl-6 pb-4 border-l-2 border-gray-100 last:border-0 last:pb-0">
                      <div className="absolute -left-1.5 top-0 w-3 h-3 bg-primary-500 rounded-full" />
                      <p className="text-sm text-gray-900 font-medium">{rev.fieldName}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="text-red-500 line-through">{rev.oldValue || '(空)'}</span>
                        <span className="mx-2">→</span>
                        <span className="text-green-600">{rev.newValue || '(空)'}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {rev.reason} · {rev.revisedBy}
                      </p>
                      <p className="text-xs text-gray-300 mt-0.5">{formatDateTime(rev.revisedAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

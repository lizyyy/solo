import React, { useState, useEffect } from 'react';
import { 
  XCircle, 
  CheckCircle, 
  MessageSquare,
  Filter,
  ChevronDown,
  RotateCcw,
  Eye
} from 'lucide-react';
import { wrongNotesApi } from '../services/api';

// 状态映射
const STATUS_LABELS = {
  'active': { label: '待复习', color: 'text-orange-600 bg-orange-100' },
  'reviewed': { label: '已复习', color: 'text-blue-600 bg-blue-100' },
  'mastered': { label: '已掌握', color: 'text-green-600 bg-green-100' }
};

// 错题卡片组件
function WrongNoteCard({ wrongNote, onViewDetails, onUpdateStatus, onAddAnnotation }) {
  const statusInfo = STATUS_LABELS[wrongNote.status] || STATUS_LABELS['active'];
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);
  const [annotation, setAnnotation] = useState('');

  const handleAddAnnotation = async () => {
    if (!annotation.trim()) return;
    try {
      await onAddAnnotation(wrongNote.id, annotation);
      setAnnotation('');
      setShowAnnotationInput(false);
    } catch (error) {
      alert('添加批注失败');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* 卡片头部 */}
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm text-gray-600">
              {wrongNote.type === 'scale_identification' ? '音阶音级识别' :
               wrongNote.type === 'chord_construction' ? '和弦构成' :
               wrongNote.type === 'inversion' ? '转位判断' :
               wrongNote.type === 'roman_numeral' ? '罗马数字功能' : '终止式判断'}
            </span>
            <span className="text-xs text-gray-400">
              难度: {'★'.repeat(wrongNote.difficulty)}
            </span>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* 卡片内容 */}
      <div className="px-5 py-4">
        <h3 className="font-medium text-gray-900 mb-3">
          {wrongNote.content?.question || '题目'}
        </h3>
        
        {/* 错因标签 */}
        {wrongNote.error_tags && wrongNote.error_tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {wrongNote.error_tags.map((tag, index) => (
              <span 
                key={index}
                className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded"
              >
                {tag.label || tag}
              </span>
            ))}
          </div>
        )}

        {/* 教师批注 */}
        {wrongNote.teacher_comment && (
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-700">教师批注</span>
            </div>
            <p className="text-sm text-yellow-800">{wrongNote.teacher_comment}</p>
          </div>
        )}

        {/* 解析预览 */}
        {wrongNote.explanation && (
          <p className="text-sm text-gray-500 line-clamp-2">
            解析: {wrongNote.explanation}
          </p>
        )}
      </div>

      {/* 卡片底部操作 */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            复习次数: {wrongNote.review_count || 0}
          </span>
          
          <div className="flex items-center gap-2">
            {/* 查看详情 */}
            <button
              onClick={() => onViewDetails(wrongNote)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
              查看
            </button>

            {/* 状态更新下拉 */}
            <div className="relative">
              <select
                value={wrongNote.status}
                onChange={(e) => onUpdateStatus(wrongNote.id, e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">待复习</option>
                <option value="reviewed">已复习</option>
                <option value="mastered">已掌握</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* 批注输入 */}
        {showAnnotationInput && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <textarea
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value)}
              placeholder="添加教师批注..."
              className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowAnnotationInput(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleAddAnnotation}
                className="px-3 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg"
              >
                添加
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 详情弹窗组件
function WrongNoteDetailModal({ wrongNote, onClose }) {
  if (!wrongNote) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">错题详情</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XCircle className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 题目信息 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">题目</h3>
            <p className="text-base font-medium text-gray-900">
              {wrongNote.content?.question || '无题'}
            </p>
            {wrongNote.content?.key && (
              <p className="text-sm text-blue-600 mt-2">
                调性: {wrongNote.content.key} {wrongNote.content.scaleType === 'major' ? '大调' : '小调'}
              </p>
            )}
          </div>

          {/* 用户答案 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">你的答案</h3>
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-red-700">
                {Array.isArray(wrongNote.user_answer) 
                  ? wrongNote.user_answer.join(' - ')
                  : JSON.stringify(wrongNote.user_answer)}
              </p>
            </div>
          </div>

          {/* 正确答案 */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">正确答案</h3>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-green-700">
                {Array.isArray(wrongNote.correct_answer?.notes)
                  ? wrongNote.correct_answer.notes.join(' - ')
                  : wrongNote.correct_answer?.note || JSON.stringify(wrongNote.correct_answer)}
              </p>
            </div>
          </div>

          {/* 错因分析 */}
          {wrongNote.error_tags && wrongNote.error_tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">错因分析</h3>
              <div className="flex flex-wrap gap-2">
                {wrongNote.error_tags.map((tag, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1.5 bg-orange-100 text-orange-700 text-sm rounded-full"
                  >
                    {tag.label || tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 解析 */}
          {wrongNote.explanation && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">解析</h3>
              <p className="text-gray-700 leading-relaxed">{wrongNote.explanation}</p>
            </div>
          )}

          {/* 教师批注 */}
          {wrongNote.teacher_comment && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">教师批注</h3>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-yellow-800">{wrongNote.teacher_comment}</p>
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

// 主页面组件
function WrongNotesPage() {
  const [wrongNotes, setWrongNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedWrongNote, setSelectedWrongNote] = useState(null);
  const [errorTags, setErrorTags] = useState([]);

  useEffect(() => {
    fetchWrongNotes();
    fetchErrorTags();
  }, [pagination.page, statusFilter]);

  const fetchWrongNotes = async () => {
    try {
      setLoading(true);
      const response = await wrongNotesApi.getWrongNotes({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter || undefined
      });
      setWrongNotes(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        pages: response.data.pagination?.pages || 0
      }));
    } catch (error) {
      console.error('Failed to fetch wrong notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchErrorTags = async () => {
    try {
      const response = await wrongNotesApi.getErrorTagStats();
      setErrorTags(response.data.data || []);
    } catch (error) {
      console.log('No error tags data');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await wrongNotesApi.updateStatus(id, status);
      fetchWrongNotes();
    } catch (error) {
      alert('更新状态失败');
    }
  };

  const handleViewDetails = (wrongNote) => {
    setSelectedWrongNote(wrongNote);
  };

  const handleAddAnnotation = async (id, content) => {
    await wrongNotesApi.addAnnotation(id, content);
    fetchWrongNotes();
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">错题本</h1>
          <p className="text-gray-500 mt-1">复习错题，巩固薄弱知识点</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 状态筛选 */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm text-gray-700 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部状态</option>
              <option value="active">待复习</option>
              <option value="reviewed">已复习</option>
              <option value="mastered">已掌握</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={fetchWrongNotes}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      {errorTags.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">错因分布</h3>
          <div className="flex flex-wrap gap-3">
            {errorTags.slice(0, 6).map((tag, index) => (
              <div key={index} className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">{tag.label || tag.tag}</span>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                  {tag.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 错题列表 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-500">加载中...</p>
          </div>
        </div>
      ) : wrongNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {wrongNotes.map((wn) => (
            <WrongNoteCard
              key={wn.id}
              wrongNote={wn}
              onViewDetails={handleViewDetails}
              onUpdateStatus={handleUpdateStatus}
              onAddAnnotation={handleAddAnnotation}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无错题</h3>
          <p className="text-gray-500">继续保持，你的表现很不错！</p>
          <button
            onClick={() => window.location.href = '/practice'}
            className="mt-6 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            开始练习
          </button>
        </div>
      )}

      {/* 分页 */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page === 1}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <span className="text-sm text-gray-500">
            第 {pagination.page} 页 / 共 {pagination.pages} 页
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
            disabled={pagination.page === pagination.pages}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
        </div>
      )}

      {/* 详情弹窗 */}
      {selectedWrongNote && (
        <WrongNoteDetailModal
          wrongNote={selectedWrongNote}
          onClose={() => setSelectedWrongNote(null)}
        />
      )}
    </div>
  );
}

export default WrongNotesPage;

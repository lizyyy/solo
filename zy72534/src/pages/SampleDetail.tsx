import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, GitCompare, MessageSquare, Send, AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { CommentCard } from '../components/CommentCard';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../utils/formatters';
import { CommentAuthor, SampleStatus } from '../types';

export default function SampleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sample = useAppStore((state) => state.getSampleById(id || ''));
  const addComment = useAppStore((state) => state.addComment);
  const updateSampleStatus = useAppStore((state) => state.updateSampleStatus);

  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState<CommentAuthor>('小孟');

  if (!sample) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500">样本不存在</p>
        <Link to="/" className="text-amber-600 hover:text-amber-700 mt-4 inline-block">返回首页</Link>
      </div>
    );
  }

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment(sample.id, commentAuthor, newComment.trim());
    setNewComment('');
  };

  const handleStatusChange = (status: SampleStatus) => {
    updateSampleStatus(sample.id, status);
  };

  const versions = sample.versions;
  const hasMultipleVersions = versions.length > 1;
  const oldVersion = versions[0];
  const newVersion = versions[versions.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-stone-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-stone-800">{sample.sampleNo}</h1>
            <StatusBadge status={sample.status} isAnomaly={sample.isAnomaly} />
          </div>
          <p className="text-sm text-stone-500 mt-0.5">导入时间：{formatDate(sample.createdAt)}</p>
        </div>
        <Link
          to={`/review/${sample.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors"
        >
          <FileText className="w-4 h-4" />
          产品复盘页
        </Link>
      </div>

      {sample.isAnomaly && (
        <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
          <div className="flex gap-4">
            <div className="p-2 bg-amber-100 rounded-xl h-fit">
              <AlertTriangle className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900">异常：模型版本换了但样本编号没变</h3>
              <p className="text-sm text-amber-800 mt-1">
                同一样本编号出现了 {versions.length} 个不同模型版本的预测结果。
                <span className="font-medium">系统未自动归为正常，请运营复核人确认。</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <GitCompare className="w-5 h-5 text-stone-600" />
            <h2 className="text-lg font-semibold text-stone-800">模型版本对比</h2>
          </div>

          {hasMultipleVersions ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
                  <p className="text-xs font-medium text-stone-500 mb-2">旧版本 · {oldVersion.modelVersion}</p>
                  <div className="space-y-2">
                    {Object.entries(oldVersion.tags).map(([key, value]) => {
                      const newValue = newVersion.tags[key];
                      const changed = newValue !== value;
                      return (
                        <div key={key} className={`text-sm p-2 rounded ${changed ? 'bg-rose-50 border border-rose-200' : ''}`}>
                          <span className="text-stone-500 text-xs">{key}：</span>
                          <span className={`font-medium ${changed ? 'text-rose-700 line-through' : 'text-stone-700'}`}>
                            {value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-xs font-medium text-emerald-600 mb-2">新版本 · {newVersion.modelVersion}</p>
                  <div className="space-y-2">
                    {Object.entries(newVersion.tags).map(([key, value]) => {
                      const oldValue = oldVersion.tags[key];
                      const changed = oldValue !== value;
                      return (
                        <div key={key} className={`text-sm p-2 rounded ${changed ? 'bg-emerald-100 border border-emerald-300' : ''}`}>
                          <span className="text-emerald-600 text-xs">{key}：</span>
                          <span className={`font-medium ${changed ? 'text-emerald-800' : 'text-stone-700'}`}>
                            {value}
                          </span>
                          {changed && <span className="ml-2 text-xs text-emerald-600">↻</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 py-2 text-xs text-stone-500">
                <Clock className="w-4 h-4" />
                <span>{formatDate(oldVersion.timestamp)} → {formatDate(newVersion.timestamp)}</span>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-stone-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
              <p>仅一个模型版本，无版本差异</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-800 mb-5">状态操作</h2>
          
          <div className="space-y-3">
            <button
              onClick={() => handleStatusChange('pending_review')}
              className={`w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-all ${
                sample.status === 'pending_review'
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-stone-200 hover:border-amber-300 hover:bg-amber-50/50'
              }`}
            >
              <Clock className={`w-5 h-5 ${sample.status === 'pending_review' ? 'text-amber-600' : 'text-stone-400'}`} />
              <div>
                <p className="font-medium text-stone-800">待运营复核</p>
                <p className="text-xs text-stone-500">留给运营复核人确认，不急着归正常</p>
              </div>
            </button>

            <button
              onClick={() => handleStatusChange('confirmed_normal')}
              className={`w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-all ${
                sample.status === 'confirmed_normal'
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/50'
              }`}
            >
              <CheckCircle className={`w-5 h-5 ${sample.status === 'confirmed_normal' ? 'text-emerald-600' : 'text-stone-400'}`} />
              <div>
                <p className="font-medium text-stone-800">确认正常</p>
                <p className="text-xs text-stone-500">运营复核后确认无问题，可归档</p>
              </div>
            </button>

            <button
              onClick={() => handleStatusChange('needs_attention')}
              className={`w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-all ${
                sample.status === 'needs_attention'
                  ? 'border-rose-400 bg-rose-50'
                  : 'border-stone-200 hover:border-rose-300 hover:bg-rose-50/50'
              }`}
            >
              <AlertTriangle className={`w-5 h-5 ${sample.status === 'needs_attention' ? 'text-rose-600' : 'text-stone-400'}`} />
              <div>
                <p className="font-medium text-stone-800">需重点关注</p>
                <p className="text-xs text-stone-500">标签差异较大，需进一步核实素材</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-stone-600" />
            <h2 className="text-lg font-semibold text-stone-800">标注员留言</h2>
            <span className="text-sm text-stone-500">({sample.comments.length} 条)</span>
          </div>
        </div>

        {sample.comments.length > 0 ? (
          <div className="space-y-3 mb-6">
            {sample.comments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-stone-400 mb-6 border border-dashed border-stone-200 rounded-lg">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无留言，小孟可以补充标注员的原始留言</p>
          </div>
        )}

        <div className="p-4 bg-stone-50 rounded-xl">
          <p className="text-sm font-medium text-stone-700 mb-3">补录留言（模型评测 · 小孟）</p>
          <div className="flex gap-3 mb-3">
            {(['小孟', '标注员', '运营复核'] as CommentAuthor[]).map((author) => (
              <button
                key={author}
                onClick={() => setCommentAuthor(author)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  commentAuthor === author
                    ? 'bg-amber-500 text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:border-amber-300'
                }`}
              >
                {author}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="输入留言内容，补录标注员的原始说明..."
              className="flex-1 px-4 py-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-stone-300 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              发送
            </button>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            补录留言后，产品复盘页会自动更新时间戳，运营复核人可追溯
          </p>
        </div>
      </div>
    </div>
  );
}

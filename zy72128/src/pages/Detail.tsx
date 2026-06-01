import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Edit, 
  Download, 
  Clock, 
  User, 
  Music, 
  FileText,
  Calendar,
  MessageSquare,
  Paperclip,
  GitCompare,
  ChevronDown,
  ChevronUp,
  Plus,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { 
  statusLabels, 
  statusColors, 
  sourceTypeLabels, 
  sourceTypeColors,
  commentTypeLabels,
  commentTypeColors,
  CommentType
} from '../types';
import { formatFieldName, formatValue } from '../utils/diff';
import { exportToMarkdown, downloadFile } from '../utils/export';

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const { 
    getNotification, 
    getVersions, 
    getSources, 
    getComments,
    addComment,
    getExportData,
    currentUser
  } = useStore();

  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [newCommentType, setNewCommentType] = useState<CommentType>('supplement');

  if (!id) return <div>无效的通知ID</div>;

  const notification = getNotification(id);
  const versions = getVersions(id);
  const sources = getSources(id);
  const comments = getComments(id);

  if (!notification) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
        <h2 className="text-xl font-serif font-bold mb-2">通知不存在</h2>
        <Link to="/" className="text-burgundy-700 hover:underline">返回列表</Link>
      </div>
    );
  }

  const handleExport = () => {
    const data = getExportData(id);
    const md = exportToMarkdown(data);
    const filename = `通知_${notification.studentName}_${format(new Date(), 'yyyyMMdd')}.md`;
    downloadFile(md, filename, 'text/markdown');
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment(id, newComment, newCommentType);
    setNewComment('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-burgundy-700 hover:text-burgundy-900">
          <ArrowLeft className="w-5 h-5" />
          <span>返回列表</span>
        </Link>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-parchment-200 text-burgundy-800 rounded hover:bg-parchment-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出文档
          </button>
          <Link
            to={`/edit/${id}`}
            className="flex items-center gap-2 btn-primary"
          >
            <Edit className="w-4 h-4" />
            编辑通知
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-burgundy-900 mb-2">
              {notification.title}
            </h1>
            <span className={`status-badge ${statusColors[notification.status]}`}>
              {statusLabels[notification.status]}
            </span>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>当前版本：v{notification.currentVersion}</p>
            <p>更新于 {format(new Date(notification.updatedAt), 'yyyy-MM-dd HH:mm')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-parchment-300">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-burgundy-600" />
            <div>
              <p className="text-xs text-gray-500">学生姓名</p>
              <p className="font-medium">{notification.studentName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-burgundy-600" />
            <div>
              <p className="text-xs text-gray-500">乐器</p>
              <p className="font-medium">{notification.instrument}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-burgundy-600" />
            <div>
              <p className="text-xs text-gray-500">曲目</p>
              <p className="font-medium">{notification.piece}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-burgundy-600" />
            <div>
              <p className="text-xs text-gray-500">排练时间</p>
              <p className="font-medium">{notification.rehearsalTime || '待定'}</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-gold-600" />
            替补原因说明
          </h3>
          <div className="bg-gold-50 border border-gold-200 rounded p-4">
            <p className="text-gray-700 whitespace-pre-wrap">{notification.reason}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-serif font-bold text-burgundy-900 mb-4 flex items-center gap-2">
          <GitCompare className="w-5 h-5" />
          版本历史
        </h2>
        <div className="space-y-4">
          {[...versions].reverse().map((version, index) => (
            <div 
              key={version.id}
              className={`relative pl-8 ${index !== versions.length - 1 ? 'pb-4' : ''}`}
            >
              {index !== versions.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-parchment-300" />
              )}
              <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-burgundy-700 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{version.versionNumber}</span>
              </div>
              
              <div className="bg-parchment-50 rounded-lg p-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedVersion(
                    expandedVersion === version.versionNumber ? null : version.versionNumber
                  )}
                >
                  <div>
                    <span className="font-medium">v{version.versionNumber}</span>
                    <span className="mx-2 text-gray-400">·</span>
                    <span className="text-sm text-gray-600">{version.changeReason}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {version.modifiedBy}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(new Date(version.modifiedAt), 'MM-dd HH:mm')}
                    </span>
                    {expandedVersion === version.versionNumber ? 
                      <ChevronUp className="w-4 h-4" /> : 
                      <ChevronDown className="w-4 h-4" />
                    }
                  </div>
                </div>
                
                {expandedVersion === version.versionNumber && version.diff && version.diff.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-parchment-200 space-y-2">
                    <p className="text-sm font-medium text-gray-700">变更内容：</p>
                    {version.diff.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          d.action === 'add' ? 'bg-green-100 text-green-700' :
                          d.action === 'remove' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {d.action === 'add' ? '新增' : d.action === 'remove' ? '删除' : '修改'}
                        </span>
                        <span className="text-gray-700">
                          <span className="font-medium">{formatFieldName(d.field)}：</span>
                          {d.action !== 'add' && (
                            <span className="line-through text-gray-400 mr-2">
                              {formatValue(d.oldValue)}
                            </span>
                          )}
                          {d.action !== 'remove' && (
                            <span className={d.action === 'add' ? 'text-green-700' : 'text-burgundy-700'}>
                              {formatValue(d.newValue)}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-serif font-bold text-burgundy-900 mb-4 flex items-center gap-2">
          <Paperclip className="w-5 h-5" />
          来源材料追踪
        </h2>
        {sources.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无来源材料</p>
        ) : (
          <div className="grid gap-3">
            {sources.map(source => (
              <div 
                key={source.id} 
                className="flex items-start gap-4 p-3 bg-parchment-50 rounded-lg hover:bg-parchment-100 transition-colors"
              >
                <div className={`source-badge ${sourceTypeColors[source.type]} mt-0.5`}>
                  {sourceTypeLabels[source.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800">{source.name}</p>
                  {source.description && (
                    <p className="text-sm text-gray-600 mt-1">{source.description}</p>
                  )}
                  {source.reference && (
                    <p className="text-xs text-gray-500 mt-1 font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                      {source.reference}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400">
                  <p>{source.uploadedBy}</p>
                  <p>{format(new Date(source.uploadTime), 'MM-dd HH:mm')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-serif font-bold text-burgundy-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          批注与补录
        </h2>

        <div className="mb-6 p-4 bg-parchment-50 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-600">添加批注类型：</span>
            <div className="flex gap-2">
              {(['supplement', 'annotation', 'decision'] as CommentType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setNewCommentType(type)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    newCommentType === type 
                      ? 'bg-burgundy-700 text-white' 
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {commentTypeLabels[type]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="输入批注内容..."
              className="flex-1 input-field resize-none"
              rows={2}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="self-end btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4 mr-1" />
              添加
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            将以 <span className="font-medium">{currentUser}</span> 的身份添加
          </p>
        </div>

        {comments.length === 0 ? (
          <p className="text-gray-500 text-center py-4">暂无批注记录</p>
        ) : (
          <div className="space-y-3">
            {[...comments].reverse().map(comment => (
              <div 
                key={comment.id} 
                className={`p-4 rounded-lg border ${commentTypeColors[comment.type]}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`source-badge ${
                      comment.type === 'supplement' ? 'bg-amber-100 text-amber-700' :
                      comment.type === 'decision' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {commentTypeLabels[comment.type]}
                    </span>
                    <span className="text-sm font-medium">{comment.author}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(comment.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

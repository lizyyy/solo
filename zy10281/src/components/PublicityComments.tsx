import React, { useState } from 'react';
import { PublicityComment } from '../types';

interface PublicityCommentsProps {
  comments: PublicityComment[];
  onAddComment: (content: string, commenter: string) => void;
  onRespond: (commentId: string, response: string, responder: string) => void;
}

export const PublicityComments: React.FC<PublicityCommentsProps> = ({
  comments,
  onAddComment,
  onRespond,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commenter, setCommenter] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [responder, setResponder] = useState('');

  const handleAdd = () => {
    if (newComment.trim()) {
      onAddComment(newComment, commenter || '匿名');
      setShowAddModal(false);
      setNewComment('');
      setCommenter('');
    }
  };

  const handleRespond = () => {
    if (respondingId && response.trim()) {
      onRespond(respondingId, response, responder || '管理员');
      setRespondingId(null);
      setResponse('');
      setResponder('');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">公示意见</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
        >
          + 添加意见
        </button>
      </div>

      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无公示意见
          </div>
        ) : (
          comments.map(comment => (
            <div
              key={comment.id}
              className={`p-4 rounded-lg border-2 ${
                comment.isResolved
                  ? 'border-green-200 bg-green-50'
                  : 'border-orange-200 bg-orange-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-800">{comment.commenter}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.commentDate).toLocaleString()}
                    </span>
                    {comment.isResolved && (
                      <span className="px-2 py-1 bg-green-200 text-green-700 rounded text-xs">
                        已回复
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700">{comment.content}</p>
                </div>
                {!comment.isResolved && (
                  <button
                    onClick={() => setRespondingId(comment.id)}
                    className="text-blue-500 hover:text-blue-700 text-sm ml-4"
                  >
                    回复
                  </button>
                )}
              </div>

              {comment.response && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-green-700">{comment.responder} 回复</span>
                    {comment.responseDate && (
                      <span className="text-xs text-gray-500">
                        {new Date(comment.responseDate).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-green-700">{comment.response}</p>
                </div>
              )}

              {respondingId === comment.id && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">回复人</label>
                      <input
                        type="text"
                        value={responder}
                        onChange={(e) => setResponder(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        placeholder="您的姓名"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">回复内容</label>
                      <textarea
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        rows={2}
                        placeholder="请输入回复内容..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setRespondingId(null)}
                        className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleRespond}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                      >
                        提交回复
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">添加公示意见</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">您的姓名</label>
                <input
                  type="text"
                  value={commenter}
                  onChange={(e) => setCommenter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  placeholder="可匿名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">意见内容</label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  rows={3}
                  placeholder="请详细描述您的意见或建议..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

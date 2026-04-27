import React, { useState } from 'react';
import { Header, EmptyState } from '@/components/common';
import { useApp } from '@/context/AppContext';
import { getRelativeTime } from '@/utils/date';
import { Heart, MessageCircle, Share2, Plus, X, Send, Check } from 'lucide-react';

const CommunityPage: React.FC = () => {
  const { state, togglePostLike, addComment, addPost } = useApp();
  const { posts, comments, userProfile } = state;

  const [showNewPost, setShowNewPost] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newPostTags, setNewPostTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showShareToast, setShowShareToast] = useState(false);

  const selectedPost = selectedPostId ? posts.find(p => p.id === selectedPostId) : null;

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !newPostTags.includes(tag) && newPostTags.length < 3) {
      setNewPostTags([...newPostTags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNewPostTags(newPostTags.filter(t => t !== tag));
  };

  const handleSubmitPost = () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      alert('请填写标题和内容');
      return;
    }

    addPost({
      author: userProfile.name,
      avatar: userProfile.avatar,
      title: newPostTitle,
      content: newPostContent,
      images: [],
      tags: newPostTags
    });

    setNewPostTitle('');
    setNewPostContent('');
    setNewPostTags([]);
    setShowNewPost(false);
  };

  const handleSubmitComment = () => {
    if (!newComment.trim() || !selectedPost) return;

    addComment({
      postId: selectedPost.id,
      author: userProfile.name,
      avatar: userProfile.avatar,
      content: newComment
    });

    setNewComment('');
  };

  const handleShare = async (post: typeof posts[0]) => {
    const shareText = `【${post.title}】\n${post.content.substring(0, 100)}...\n\n来自经期养生APP`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2000);
      }
    } catch (err) {
      try {
        await navigator.clipboard.writeText(shareText);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2000);
      } catch {
        alert('分享内容已准备好，请手动复制');
      }
    }
  };

  if (selectedPost) {
    const postComments = comments.filter(c => c.postId === selectedPost.id);

    return (
      <div className="safe-area">
        <Header title="帖子详情" showBack onBack={() => setSelectedPostId(null)} />
        
        <div className="screen-container pb-32">
          <div className="card mb-4">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={selectedPost.avatar}
                alt={selectedPost.author}
                className="w-10 h-10 rounded-full bg-gray-200"
              />
              <div>
                <p className="font-medium text-gray-800">{selectedPost.author}</p>
                <p className="text-xs text-gray-400">{getRelativeTime(selectedPost.createdAt)}</p>
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-800 mb-2">{selectedPost.title}</h2>
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{selectedPost.content}</p>

            {selectedPost.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedPost.tags.map(tag => (
                  <span key={tag} className="chip bg-pink-50 text-pink-600">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => togglePostLike(selectedPost.id)}
                className={`flex items-center gap-1 transition-colors ${
                  selectedPost.isLiked ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Heart size={18} fill={selectedPost.isLiked ? 'currentColor' : 'none'} />
                <span className="text-sm">{selectedPost.likes}</span>
              </button>
              <div className="flex items-center gap-1 text-gray-400">
                <MessageCircle size={18} />
                <span className="text-sm">{postComments.length}</span>
              </div>
              <button 
                onClick={() => handleShare(selectedPost)}
                className="flex items-center gap-1 text-gray-400 hover:text-blue-500 transition-colors"
              >
                <Share2 size={18} />
                <span className="text-sm">分享</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-gray-800 mb-4">评论 ({postComments.length})</h3>
            
            {postComments.length === 0 ? (
              <EmptyState
                icon="💬"
                title="还没有评论"
                description="快来发表第一条评论吧"
              />
            ) : (
              <div className="space-y-4">
                {postComments.map(comment => (
                  <div key={comment.id} className="card">
                    <div className="flex items-start gap-3">
                      <img
                        src={comment.avatar}
                        alt={comment.author}
                        className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-gray-800 text-sm">{comment.author}</p>
                          <p className="text-xs text-gray-400">{getRelativeTime(comment.createdAt)}</p>
                        </div>
                        <p className="text-gray-600 text-sm">{comment.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 pb-8 z-[60] shadow-lg">
          <div className="max-w-md mx-auto flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()}
              placeholder="写下你的评论..."
              className="input-field flex-1 min-h-0 py-2.5"
            />
            <button
              onClick={handleSubmitComment}
              disabled={!newComment.trim()}
              className="px-4 py-2 bg-primary text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-500 transition-colors flex-shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        {showShareToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg z-[70] flex items-center gap-2">
            <Check size={18} className="text-green-400" />
            <span className="text-sm">已复制到剪贴板</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="safe-area">
      <Header title="分享圈" />
      
      <div className="screen-container pb-20">
        <div className="card mb-4">
          <button
            onClick={() => setShowNewPost(true)}
            className="w-full flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
              <Plus size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-gray-400">分享你的经期养生经验...</p>
            </div>
          </button>
        </div>

        {posts.length === 0 ? (
          <EmptyState
            icon="📝"
            title="还没有帖子"
            description="快来分享你的经验吧"
            action={
              <button
                onClick={() => setShowNewPost(true)}
                className="btn-primary"
              >
                发布帖子
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <button
                key={post.id}
                onClick={() => setSelectedPostId(post.id)}
                className="card w-full text-left hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={post.avatar}
                    alt={post.author}
                    className="w-10 h-10 rounded-full bg-gray-200"
                  />
                  <div>
                    <p className="font-medium text-gray-800">{post.author}</p>
                    <p className="text-xs text-gray-400">{getRelativeTime(post.createdAt)}</p>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-800 mb-2">{post.title}</h3>
                <p className="text-gray-600 text-sm line-clamp-3">{post.content}</p>

                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {post.tags.map(tag => (
                      <span key={tag} className="chip bg-pink-50 text-pink-600 text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100">
                  <div className={`flex items-center gap-1 ${
                    post.isLiked ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    <Heart size={16} fill={post.isLiked ? 'currentColor' : 'none'} />
                    <span className="text-xs">{post.likes}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <MessageCircle size={16} />
                    <span className="text-xs">{comments.filter(c => c.postId === post.id).length}</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleShare(post); }}
                    className="flex items-center gap-1 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    <Share2 size={16} />
                    <span className="text-xs">分享</span>
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showNewPost && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md my-8">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <button
                onClick={() => setShowNewPost(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
              <h3 className="font-bold text-gray-800">发布帖子</h3>
              <button
                onClick={handleSubmitPost}
                disabled={!newPostTitle.trim() || !newPostContent.trim()}
                className="px-4 py-1 bg-primary text-white rounded-full text-sm font-medium disabled:opacity-50 transition-colors"
              >
                发布
              </button>
            </div>

            <div className="p-4 space-y-4">
              <input
                type="text"
                value={newPostTitle}
                onChange={e => setNewPostTitle(e.target.value)}
                placeholder="写一个吸引人的标题..."
                className="input-field text-lg font-medium"
              />

              <textarea
                value={newPostContent}
                onChange={e => setNewPostContent(e.target.value)}
                placeholder="分享你的经期养生经验..."
                className="input-field min-h-[200px] resize-none"
              />

              <div>
                <p className="text-sm text-gray-600 mb-2">标签（最多3个）</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {newPostTags.map(tag => (
                    <span
                      key={tag}
                      className="chip bg-pink-100 text-pink-700 flex items-center gap-1"
                    >
                      #{tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-pink-900">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {newPostTags.length < 3 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      placeholder="添加标签"
                      className="input-field flex-1"
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-pink-500 transition-colors"
                    >
                      添加
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showShareToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg z-[70] flex items-center gap-2">
          <Check size={18} className="text-green-400" />
          <span className="text-sm">已复制到剪贴板</span>
        </div>
      )}
    </div>
  );
};

export default CommunityPage;

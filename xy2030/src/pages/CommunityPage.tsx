import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Plus,
  User,
  MoreHorizontal,
  Award,
  TrendingUp,
  Users,
  Sparkles,
  X,
  Send,
  Check,
  Copy,
  ExternalLink,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Header from '@/components/Header';
import { CommunityPost, Comment, TreeHolePost } from '@/types';

type CommunityTab = 'posts' | 'treehole';

export default function CommunityPage() {
  const navigate = useNavigate();
  const { 
    communityPosts, 
    treeHolePosts, 
    togglePostLike, 
    togglePostSave, 
    toggleTreeHoleLike,
    addCommunityComment,
    addTreeHoleComment,
    toggleCommentLike,
    user,
  } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<CommunityTab>('posts');
  
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPostType, setSelectedPostType] = useState<'community' | 'treehole' | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [sharePostType, setSharePostType] = useState<'community' | 'treehole' | null>(null);
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const emotionLabels: Record<string, { label: string; color: string }> = {
    anxiety: { label: '焦虑', color: 'bg-orange-100 text-orange-700' },
    stress: { label: '压力', color: 'bg-red-100 text-red-700' },
    confusion: { label: '困惑', color: 'bg-blue-100 text-blue-700' },
    relief: { label: '释然', color: 'bg-green-100 text-green-700' },
    excitement: { label: '激动', color: 'bg-yellow-100 text-yellow-700' },
    other: { label: '其他', color: 'bg-gray-100 text-gray-700' },
  };

  const stats = [
    { icon: Users, label: '活跃用户', value: '12.5K' },
    { icon: TrendingUp, label: '今日帖子', value: '256' },
    { icon: Sparkles, label: '精选话题', value: '8' },
  ];

  const showNotification = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(null), 2000);
  };

  const handleOpenComments = (postId: string, type: 'community' | 'treehole') => {
    setSelectedPostId(postId);
    setSelectedPostType(type);
    setShowComments(true);
  };

  const handleSubmitComment = () => {
    if (!newComment.trim() || !selectedPostId || !selectedPostType) return;
    
    if (selectedPostType === 'community') {
      addCommunityComment(selectedPostId, newComment.trim());
    } else {
      addTreeHoleComment(selectedPostId, newComment.trim());
    }
    
    setNewComment('');
    showNotification('评论发送成功！');
  };

  const handleShare = (postId: string, type: 'community' | 'treehole') => {
    setSharePostId(postId);
    setSharePostType(type);
    setShowShare(true);
  };

  const handleCopyLink = () => {
    if (sharePostId) {
      navigator.clipboard.writeText(`https://i-to-e.app/post/${sharePostId}`).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleShareToPoster = () => {
    setShowShare(false);
    navigate('/poster');
  };

  const currentPostForComments = useMemo(() => {
    if (!selectedPostId || !selectedPostType) return null;
    if (selectedPostType === 'community') {
      return communityPosts.find(p => p.id === selectedPostId) || null;
    }
    return treeHolePosts.find(p => p.id === selectedPostId) || null;
  }, [selectedPostId, selectedPostType, communityPosts, treeHolePosts]);

  const currentPostForShare = useMemo(() => {
    if (!sharePostId || !sharePostType) return null;
    if (sharePostType === 'community') {
      return communityPosts.find(p => p.id === sharePostId) || null;
    }
    return treeHolePosts.find(p => p.id === sharePostId) || null;
  }, [sharePostId, sharePostType, communityPosts, treeHolePosts]);

  const getCommentList = () => {
    if (!currentPostForComments) return [];
    return (currentPostForComments as CommunityPost).commentList || (currentPostForComments as TreeHolePost).commentList || [];
  };

  useEffect(() => {
    if (showComments && commentInputRef.current) {
      setTimeout(() => commentInputRef.current?.focus(), 300);
    }
  }, [showComments]);

  return (
    <div className="min-h-screen pb-24">
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-4 left-4 right-4 z-50 bg-gray-800 text-white py-3 px-4 rounded-xl shadow-lg flex items-center justify-center"
          >
            <Check className="w-5 h-5 mr-2 text-green-400" />
            {showToast}
          </motion.div>
        )}
      </AnimatePresence>

      <Header
        title="社区"
        rightContent={
          <button
            onClick={() => navigate(activeTab === 'posts' ? '/community/post' : '/hole/create')}
            className="flex items-center p-2 rounded-full bg-i-500 text-white hover:bg-i-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />
      
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="card text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-i-100 to-e-100 flex items-center justify-center mx-auto mb-2">
                  <Icon className="w-5 h-5 text-i-500" />
                </div>
                <p className="text-lg font-bold text-gray-800">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="flex mb-4 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'posts'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            经验分享
          </button>
          <button
            onClick={() => setActiveTab('treehole')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'treehole'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            匿名树洞
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'posts' && (
            <motion.div
              key="posts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {communityPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <img
                        src={post.userAvatar}
                        alt={post.userName}
                        className="w-10 h-10 rounded-full mr-3"
                      />
                      <div>
                        <div className="flex items-center">
                          <h4 className="font-medium text-gray-800">{post.userName}</h4>
                          {post.isAnonymous && (
                            <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                              匿名
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(post.createdAt), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </p>
                      </div>
                    </div>
                    <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                      <MoreHorizontal className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <p className="text-gray-700 mb-3 whitespace-pre-line">{post.content}</p>

                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {post.tags.map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="px-3 py-1 bg-i-50 text-i-600 text-xs rounded-full"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-6">
                      <button
                        onClick={() => togglePostLike(post.id)}
                        className="flex items-center space-x-1 transition-transform active:scale-95"
                      >
                        <Heart
                          className={`w-5 h-5 ${
                            post.isLiked
                              ? 'fill-red-500 text-red-500'
                              : 'text-gray-400 hover:text-red-500'
                          } transition-colors`}
                        />
                        <span className="text-sm text-gray-500">{post.likes}</span>
                      </button>
                      <button
                        onClick={() => handleOpenComments(post.id, 'community')}
                        className="flex items-center space-x-1 transition-transform active:scale-95"
                      >
                        <MessageCircle className="w-5 h-5 text-gray-400 hover:text-i-500 transition-colors" />
                        <span className="text-sm text-gray-500">{post.comments}</span>
                      </button>
                      <button
                        onClick={() => handleShare(post.id, 'community')}
                        className="flex items-center space-x-1 transition-transform active:scale-95"
                      >
                        <Share2 className="w-5 h-5 text-gray-400 hover:text-green-500 transition-colors" />
                      </button>
                    </div>
                    <button
                      onClick={() => togglePostSave(post.id)}
                      className="p-1 transition-transform active:scale-95"
                    >
                      <Bookmark
                        className={`w-5 h-5 ${
                          post.isSaved
                            ? 'fill-yellow-500 text-yellow-500'
                            : 'text-gray-400 hover:text-yellow-500'
                        } transition-colors`}
                      />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === 'treehole' && (
            <motion.div
              key="treehole"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {treeHolePosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white mr-3">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center">
                          <h4 className="font-medium text-gray-800">匿名用户</h4>
                          <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                            emotionLabels[post.emotion]?.color || 'bg-gray-100 text-gray-700'
                          }`}>
                            {emotionLabels[post.emotion]?.label || '其他'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(post.createdAt), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-3 whitespace-pre-line">{post.content}</p>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-6">
                      <button
                        onClick={() => toggleTreeHoleLike(post.id)}
                        className="flex items-center space-x-1 transition-transform active:scale-95"
                      >
                        <Heart
                          className={`w-5 h-5 ${
                            post.isLiked
                              ? 'fill-red-500 text-red-500'
                              : 'text-gray-400 hover:text-red-500'
                          } transition-colors`}
                        />
                        <span className="text-sm text-gray-500">{post.likes}</span>
                      </button>
                      <button
                        onClick={() => handleOpenComments(post.id, 'treehole')}
                        className="flex items-center space-x-1 transition-transform active:scale-95"
                      >
                        <MessageCircle className="w-5 h-5 text-gray-400 hover:text-i-500 transition-colors" />
                        <span className="text-sm text-gray-500">{post.comments}</span>
                      </button>
                      <button
                        onClick={() => handleShare(post.id, 'treehole')}
                        className="flex items-center space-x-1 transition-transform active:scale-95"
                      >
                        <Share2 className="w-5 h-5 text-gray-400 hover:text-green-500 transition-colors" />
                      </button>
                    </div>
                    <button
                      onClick={() => navigate('/poster')}
                      className="flex items-center space-x-1 transition-transform active:scale-95"
                    >
                      <Award className="w-5 h-5 text-gray-400 hover:text-yellow-500 transition-colors" />
                      <span className="text-sm text-gray-500">生成海报</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showComments && currentPostForComments && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex flex-col z-50"
            onClick={() => setShowComments(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="mt-auto bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white p-4 border-b border-gray-100 z-10">
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">
                    评论 ({getCommentList().length})
                  </h3>
                  <button
                    onClick={() => setShowComments(false)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 pb-32">
                {getCommentList().length > 0 ? (
                  <div className="space-y-4">
                    {getCommentList().map((comment) => (
                      <motion.div
                        key={comment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex space-x-3"
                      >
                        <img
                          src={comment.userAvatar}
                          alt={comment.userName}
                          className="w-10 h-10 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-800 text-sm">{comment.userName}</h4>
                            <span className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(comment.createdAt), {
                                addSuffix: true,
                                locale: zhCN,
                              })}
                            </span>
                          </div>
                          <p className="text-gray-700 text-sm mt-1">{comment.content}</p>
                          <div className="flex items-center space-x-4 mt-2">
                            <button
                              onClick={() => toggleCommentLike(currentPostForComments!.id, comment.id)}
                              className="flex items-center space-x-1"
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  comment.isLiked
                                    ? 'fill-red-500 text-red-500'
                                    : 'text-gray-400 hover:text-red-500'
                                } transition-colors`}
                              />
                              <span className="text-xs text-gray-500">{comment.likes}</span>
                            </button>
                            <button className="text-xs text-gray-500 hover:text-gray-700">
                              回复
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">暂无评论，快来抢沙发吧！</p>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 pb-8">
                <div className="flex items-center space-x-3">
                  <img
                    src={user.avatar}
                    alt="我"
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1 flex items-center bg-gray-100 rounded-full px-4 py-2">
                    <input
                      ref={commentInputRef}
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          handleSubmitComment();
                        }
                      }}
                      placeholder="说点什么..."
                      className="flex-1 bg-transparent outline-none text-sm"
                    />
                  </div>
                  <button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim()}
                    className={`p-2.5 rounded-full transition-colors ${
                      newComment.trim()
                        ? 'bg-i-500 text-white hover:bg-i-600'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShare && currentPostForShare && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-end z-50"
            onClick={() => setShowShare(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-3xl w-full p-6 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              
              <h3 className="text-lg font-semibold text-gray-800 text-center mb-6">分享给朋友</h3>
              
              <div className="grid grid-cols-4 gap-4 mb-6">
                <button className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mb-2">
                    <span className="text-white text-xl">微</span>
                  </div>
                  <span className="text-xs text-gray-600">微信好友</span>
                </button>
                <button className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center mb-2">
                    <span className="text-white text-xl">圈</span>
                  </div>
                  <span className="text-xs text-gray-600">朋友圈</span>
                </button>
                <button
                  onClick={handleShareToPoster}
                  className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-i-500 to-e-500 flex items-center justify-center mb-2">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs text-gray-600">生成海报</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                    copied ? 'bg-green-500' : 'bg-gray-500'
                  } transition-colors`}>
                    {copied ? (
                      <Check className="w-6 h-6 text-white" />
                    ) : (
                      <Copy className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <span className="text-xs text-gray-600">{copied ? '已复制' : '复制链接'}</span>
                </button>
              </div>

              <div className="flex items-center space-x-2 mb-4 p-3 bg-gray-50 rounded-xl">
                <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <p className="text-sm text-gray-600 truncate">
                  https://i-to-e.app/post/{currentPostForShare.id}
                </p>
              </div>

              <button
                onClick={() => setShowShare(false)}
                className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

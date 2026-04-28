import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Send,
  ChevronLeft,
  Plus,
  X,
  Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CommunityPost, Comment } from '../types';

const encouragingComments = [
  '你已经做得很好了 💛',
  '慢慢来，一切都会好起来的 🌸',
  '感谢你的分享，你不是一个人 💕',
  '你的感受是被理解的 ✨',
  '明天又是新的一天，加油！☀️',
  '温柔地对待自己，你值得被爱 💖',
  '每一步都很重要，你正在前进 🦋',
  '深呼吸，一切都会过去的 🌿'
];

const samplePosts: CommunityPost[] = [
  {
    id: 'sample-1',
    userId: 'user-sample-1',
    userName: '匿名用户',
    content: '今天终于鼓起勇气去看了心理医生，虽然过程有些艰难，但感觉稍微轻松了一些。想告诉正在挣扎的朋友们，寻求帮助是勇敢的，不是软弱的。💪',
    likes: 42,
    comments: [
      {
        id: 'c1',
        userId: 'u1',
        userName: '小太阳',
        content: '你真的很勇敢！为你感到骄傲 🌟',
        isEncouraging: true,
        createdAt: Date.now() - 3600000
      }
    ],
    createdAt: Date.now() - 86400000,
    isAnonymous: true
  },
  {
    id: 'sample-2',
    userId: 'user-sample-2',
    userName: '星空下的猫',
    content: '最近失眠很严重，每天都要到凌晨3、4点才能睡着。尝试了很多方法都没用，有人有什么好的建议吗？😔',
    likes: 28,
    comments: [
      {
        id: 'c2',
        userId: 'u2',
        userName: '温柔的风',
        content: '试试睡前听白噪音，我之前也失眠，雨声+晚风的组合帮助我很多 🌙',
        isEncouraging: true,
        createdAt: Date.now() - 7200000
      },
      {
        id: 'c3',
        userId: 'u3',
        userName: '冥想者',
        content: '4-7-8呼吸法也很有效：吸气4秒，屏息7秒，呼气8秒。坚持练习会有帮助的 💛',
        isEncouraging: true,
        createdAt: Date.now() - 5400000
      }
    ],
    createdAt: Date.now() - 172800000,
    isAnonymous: false
  },
  {
    id: 'sample-3',
    userId: 'user-sample-3',
    userName: '匿名用户',
    content: '今天画了一幅画，感觉心情平静了很多。绘画真的是一种很好的疗愈方式。分享给大家，希望你们也能找到属于自己的疗愈方式。🎨',
    likes: 56,
    comments: [
      {
        id: 'c4',
        userId: 'u4',
        userName: '爱画画的小鱼',
        content: '绘画真的很治愈！我也喜欢在心情不好的时候画画 🎨',
        isEncouraging: true,
        createdAt: Date.now() - 10800000
      }
    ],
    createdAt: Date.now() - 259200000,
    isAnonymous: true
  }
];

export default function CommunityPage() {
  const navigate = useNavigate();
  const { state, addCommunityPost, toggleLikePost, addComment } = useApp();
  const [showPostForm, setShowPostForm] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [selectedComment, setSelectedComment] = useState('');
  const [samplePostsState, setSamplePostsState] = useState<CommunityPost[]>(samplePosts);

  const allPosts = useMemo(() => {
    const userPosts = state.communityPosts.map(post => ({
      ...post,
      isUserPost: true
    }));

    const samplePostsWithState = samplePostsState.map(post => {
      const isLiked = state.likedPostIds.includes(post.id);
      const originalSamplePost = samplePosts.find(p => p.id === post.id);
      let adjustedLikes = originalSamplePost ? originalSamplePost.likes : post.likes;
      if (isLiked) {
        adjustedLikes += 1;
      }
      return {
        ...post,
        likes: adjustedLikes
      };
    });

    return [...userPosts, ...samplePostsWithState].sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }, [state.communityPosts, state.likedPostIds, samplePostsState]);

  const handleSubmitPost = () => {
    if (!newPostContent.trim()) return;

    addCommunityPost({
      userId: state.user?.id || 'user-1',
      userName: isAnonymous ? '匿名用户' : (state.user?.name || '用户'),
      content: newPostContent,
      isAnonymous
    });

    setNewPostContent('');
    setShowPostForm(false);
  };

  const handleLike = (postId: string) => {
    toggleLikePost(postId);
  };

  const handleAddComment = (postId: string) => {
    if (!selectedComment) return;

    const isSamplePost = samplePosts.some(p => p.id === postId);
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      userId: state.user?.id || 'user-1',
      userName: state.user?.name || '用户',
      content: selectedComment,
      isEncouraging: true,
      createdAt: Date.now()
    };

    if (isSamplePost) {
      setSamplePostsState(prev => 
        prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              comments: [...p.comments, newComment]
            };
          }
          return p;
        })
      );

      if (selectedPost?.id === postId) {
        setSelectedPost(prev => prev ? {
          ...prev,
          comments: [...prev.comments, newComment]
        } : null);
      }
    } else {
      addComment(postId, {
        userId: state.user?.id || 'user-1',
        userName: state.user?.name || '用户',
        content: selectedComment,
        isEncouraging: true
      });
    }

    setSelectedComment('');
  };

  const handleSelectPost = (post: CommunityPost) => {
    const isSamplePost = samplePosts.some(p => p.id === post.id);
    
    if (isSamplePost) {
      const currentSamplePost = samplePostsState.find(p => p.id === post.id);
      if (currentSamplePost) {
        setSelectedPost(currentSamplePost);
      } else {
        setSelectedPost(post);
      }
    } else {
      const currentUserPost = state.communityPosts.find(p => p.id === post.id);
      if (currentUserPost) {
        setSelectedPost(currentUserPost);
      } else {
        setSelectedPost(post);
      }
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="fade-in">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="page-title mb-0">疗愈社区 💕</h1>
          <p className="text-sm text-gray-500">匿名分享，温柔安慰，禁止负面评论</p>
        </div>
      </div>

      <button
        onClick={() => setShowPostForm(true)}
        className="w-full btn btn-primary mb-6 py-4 flex items-center justify-center gap-2"
      >
        <Plus size={20} />
        分享你的故事
      </button>

      <div className="card bg-amber-50 border-amber-200 mb-6">
        <div className="flex items-start gap-3">
          <Sparkles size={20} className="text-amber-500 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-800 mb-1">社区氛围</h4>
            <p className="text-sm text-amber-700">
              这里是一个安全温暖的空间。我们鼓励：
            </p>
            <ul className="text-sm text-amber-700 mt-2 space-y-1">
              <li>✅ 温柔的安慰与鼓励</li>
              <li>✅ 积极的建议与分享</li>
              <li>✅ 尊重与理解</li>
              <li>❌ 禁止负面评论与评判</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {allPosts.map(post => {
          const isLiked = state.likedPostIds.includes(post.id);
          return (
            <div key={post.id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                  {post.userName.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">
                    {post.userName}
                    {post.isAnonymous && (
                      <span className="ml-2 text-xs text-gray-400">匿名</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
                </div>
              </div>

              <p className="text-gray-700 mb-4 leading-relaxed">{post.content}</p>

              <div className="flex items-center gap-6 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-2 transition-colors ${
                    isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                  }`}
                >
                  <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
                  <span className="text-sm">{post.likes}</span>
                </button>
                <button
                  onClick={() => handleSelectPost(post)}
                  className="flex items-center gap-2 text-gray-500 hover:text-amber-500 transition-colors"
                >
                  <MessageCircle size={20} />
                  <span className="text-sm">{post.comments.length}</span>
                </button>
              </div>

              {post.comments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm">
                      <span className="font-medium text-gray-700">{post.comments[0].userName}：</span>
                      <span className="text-gray-600">{post.comments[0].content}</span>
                    </p>
                  </div>
                  {post.comments.length > 1 && (
                    <button
                      onClick={() => handleSelectPost(post)}
                      className="text-sm text-amber-500 mt-2 hover:underline"
                    >
                      查看全部 {post.comments.length} 条评论
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showPostForm && (
        <div className="modal-overlay" onClick={() => setShowPostForm(false)}>
          <div
            className="modal-content fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">分享你的故事 ✨</h3>
              <button
                onClick={() => setShowPostForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="在这里分享你的感受、故事或困惑..."
                className="input h-48 resize-none"
              />
              <p className="form-help">
                你的分享可能会帮助到同样在经历困难的人
              </p>
            </div>

            <div className="form-group">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-5 h-5 rounded accent-amber-500"
                />
                <span className="text-gray-700">匿名发布</span>
              </label>
              <p className="form-help ml-8">
                匿名发布后，其他用户将无法看到你的真实身份
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPostForm(false)}
                className="flex-1 btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleSubmitPost}
                disabled={!newPostContent.trim()}
                className={`flex-1 btn ${
                  newPostContent.trim() ? 'btn-primary' : 'btn-secondary opacity-50'
                }`}
              >
                发布
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPost && (
        <div className="modal-overlay" onClick={() => {
          setSelectedPost(null);
          setSelectedComment('');
        }}>
          <div
            className="modal-content fade-in max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">温柔安慰 💕</h3>
              <button
                onClick={() => {
                  setSelectedPost(null);
                  setSelectedComment('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-700">{selectedPost.content}</p>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 space-y-3">
              {selectedPost.comments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>还没有评论</p>
                  <p className="text-sm">成为第一个给予温柔安慰的人吧</p>
                </div>
              ) : (
                selectedPost.comments.map(comment => (
                  <div key={comment.id} className="bg-green-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-green-800">
                        {comment.userName}
                      </span>
                      <span className="text-xs text-green-600">💛 温柔安慰</span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">选择一句温柔的话：</p>
              <div className="flex flex-wrap gap-2">
                {encouragingComments.map((comment, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedComment(comment)}
                    className={`px-3 py-2 rounded-full text-sm transition-all ${
                      selectedComment === comment
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {comment}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={selectedComment}
                onChange={(e) => setSelectedComment(e.target.value)}
                placeholder="或输入你的温柔安慰..."
                className="flex-1 input"
              />
              <button
                onClick={() => handleAddComment(selectedPost.id)}
                disabled={!selectedComment.trim()}
                className={`btn ${
                  selectedComment.trim() ? 'btn-primary' : 'btn-secondary opacity-50'
                }`}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Image,
  Hash,
  Eye,
  EyeOff,
  X,
  Check,
  Send,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import Header from '@/components/Header';

const suggestedTags = [
  '社恐日常',
  '小成就',
  '经验分享',
  '加油打气',
  '社交技巧',
  '自我成长',
  '求助',
  '树洞',
];

export default function CreatePostPage() {
  const navigate = useNavigate();
  const { addCommunityPost, user } = useAppStore();
  
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    
    addCommunityPost(content.trim(), selectedTags, isAnonymous);
    navigate('/community');
  };

  const canSubmit = content.trim().length > 0;

  return (
    <div className="min-h-screen bg-white">
      <Header
        title="发布帖子"
        showBack
        rightContent={
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              canSubmit
                ? 'bg-i-500 text-white hover:bg-i-600'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Send className="w-4 h-4 mr-1.5" />
            发布
          </button>
        }
      />
      
      <div className="p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center mb-4"
        >
          <img
            src={isAnonymous ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous' : user.avatar}
            alt="头像"
            className="w-10 h-10 rounded-full mr-3"
          />
          <div>
            <div className="flex items-center">
              <h4 className="font-medium text-gray-800">
                {isAnonymous ? '匿名用户' : user.name}
              </h4>
              {isAnonymous && (
                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                  匿名
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">刚刚</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="分享你的故事、经验或困惑..."
            className="w-full h-48 text-gray-800 placeholder-gray-400 resize-none focus:outline-none text-base leading-relaxed"
            maxLength={500}
          />
          <div className="flex justify-between items-center">
            <button className="flex items-center text-gray-400 hover:text-i-500 transition-colors">
              <Image className="w-5 h-5 mr-1" />
              <span className="text-sm">添加图片</span>
            </button>
            <span className={`text-sm ${
              content.length > 450 ? 'text-red-500' : 'text-gray-400'
            }`}>
              {content.length}/500
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="flex items-center mb-3">
            <Hash className="w-5 h-5 text-gray-500 mr-2" />
            <h3 className="text-sm font-medium text-gray-700">选择标签</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-i-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={() => setIsAnonymous(!isAnonymous)}
            className="w-full flex items-center justify-between p-4 card"
          >
            <div className="flex items-center">
              {isAnonymous ? (
                <EyeOff className="w-5 h-5 text-i-500 mr-3" />
              ) : (
                <Eye className="w-5 h-5 text-gray-400 mr-3" />
              )}
              <div className="text-left">
                <p className="font-medium text-gray-800">匿名发布</p>
                <p className="text-xs text-gray-500">开启后将隐藏你的真实身份</p>
              </div>
            </div>
            <div className={`w-12 h-7 rounded-full transition-colors ${
              isAnonymous ? 'bg-i-500' : 'bg-gray-200'
            }`}>
              <motion.div
                animate={{ x: isAnonymous ? 24 : 4 }}
                className="w-5 h-5 bg-white rounded-full shadow-md mt-1"
              />
            </div>
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 p-4 bg-i-50 rounded-xl"
        >
          <h4 className="text-sm font-medium text-gray-700 mb-2">温馨提示</h4>
          <ul className="space-y-1 text-xs text-gray-600">
            <li>• 发布的内容将公开可见</li>
            <li>• 请遵守社区规范，友善交流</li>
            <li>• 支持原创，尊重他人隐私</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}

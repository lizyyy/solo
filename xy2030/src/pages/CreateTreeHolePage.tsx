import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Send,
  Shield,
  EyeOff,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import Header from '@/components/Header';

const emotionTags = [
  { id: 'anxiety', label: '焦虑', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'stress', label: '压力', color: 'text-red-600 bg-red-50 border-red-200' },
  { id: 'confusion', label: '困惑', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'relief', label: '释然', color: 'text-green-600 bg-green-50 border-green-200' },
  { id: 'excitement', label: '激动', color: 'text-pink-600 bg-pink-50 border-pink-200' },
  { id: 'other', label: '其他', color: 'text-gray-600 bg-gray-50 border-gray-200' },
];

export default function CreateTreeHolePage() {
  const navigate = useNavigate();
  const { addTreeHolePost } = useAppStore();
  
  const [content, setContent] = useState('');
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!content.trim()) return;
    
    addTreeHolePost(
      content.trim(),
      selectedEmotion as any
    );
    
    navigate('/diary');
  };

  const canSubmit = content.trim().length > 0;

  return (
    <div className="min-h-screen bg-white">
      <Header
        title="匿名树洞"
        showBack
        rightContent={
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              canSubmit
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Send className="w-4 h-4 mr-1.5" />
            发送
          </button>
        }
      />
      
      <div className="p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
            <div className="flex items-start">
              <Shield className="w-6 h-6 text-purple-500 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">完全匿名保护</h3>
                <p className="text-sm text-gray-600">
                  您发布的内容将完全匿名，不会关联到您的个人信息。
                  在这里可以放心地倾诉、吐槽、发泄情绪。
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-3">此刻的情绪</h3>
          <div className="grid grid-cols-3 gap-3">
            {emotionTags.map((emotion) => (
              <button
                key={emotion.id}
                onClick={() => setSelectedEmotion(selectedEmotion === emotion.id ? null : emotion.id)}
                className={`p-3 rounded-xl border-2 transition-all ${
                  selectedEmotion === emotion.id
                    ? emotion.color + ' border-solid shadow-md scale-105'
                    : 'border-dashed border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={`text-sm font-medium ${
                  selectedEmotion === emotion.id ? '' : 'text-gray-600'
                }`}>
                  {emotion.label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-3">说点什么</h3>
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="把树洞当作倾听者，说出你的烦恼、秘密、社死经历...
没有人知道你是谁，尽情倾诉吧。"
              className="w-full h-64 text-gray-800 placeholder-gray-400 resize-none focus:outline-none text-base leading-relaxed bg-gray-50 rounded-xl p-4"
              maxLength={2000}
            />
            <div className="absolute bottom-3 right-3">
              <span className={`text-sm ${
                content.length > 1800 ? 'text-red-500' : 'text-gray-400'
              }`}>
                {content.length}/2000
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-3">发送前提示</h3>
          <div className="space-y-3">
            <div className="flex items-start p-3 bg-gray-50 rounded-xl">
              <EyeOff className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">完全匿名</p>
                <p className="text-xs text-gray-500">发布后不会显示您的真实身份</p>
              </div>
            </div>
            <div className="flex items-start p-3 bg-gray-50 rounded-xl">
              <X className="w-5 h-5 text-gray-500 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">不可删除</p>
                <p className="text-xs text-gray-500">发布后无法删除，请谨慎发言</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-4 rounded-xl text-lg font-semibold transition-all ${
            canSubmit
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          <div className="flex items-center justify-center">
            <Send className="w-5 h-5 mr-2" />
            投入树洞
          </div>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 p-4 bg-gray-50 rounded-xl"
        >
          <p className="text-xs text-gray-500 text-center">
            💡 小提示：把烦恼写出来，心情会好很多。
            这里是你的秘密空间，尽情释放吧！
          </p>
        </motion.div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Smile,
  Frown,
  Meh,
  Heart,
  Plus,
  X,
  Send,
  Trophy,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import Header from '@/components/Header';

const moodOptions = [
  { id: 'great', emoji: '😊', label: '很棒', icon: Smile, color: 'text-green-600 bg-green-50 border-green-200' },
  { id: 'good', emoji: '🙂', label: '不错', icon: Smile, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'neutral', emoji: '😐', label: '一般', icon: Meh, color: 'text-gray-600 bg-gray-50 border-gray-200' },
  { id: 'bad', emoji: '😔', label: '不好', icon: Frown, color: 'text-red-600 bg-red-50 border-red-200' },
];

const suggestedAchievements = [
  '主动和别人打招呼',
  '完成了一次社交任务',
  '拒绝了不合理的请求',
  '在会议上发表了意见',
  '认识了新朋友',
  '成功结束了尬聊',
  '赞美了别人',
  '主动发起了对话',
];

const suggestedChallenges = [
  '今天有些紧张',
  '担心没话说',
  '社交能量耗尽',
  '害怕被拒绝',
  '过度在意别人的看法',
];

export default function CreateDiaryPage() {
  const navigate = useNavigate();
  const { addDiaryEntry, addSocialSteps, incrementStreak } = useAppStore();
  
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [selectedAchievements, setSelectedAchievements] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [socialSteps, setSocialSteps] = useState(0);

  const toggleAchievement = (achievement: string) => {
    setSelectedAchievements(prev =>
      prev.includes(achievement)
        ? prev.filter(a => a !== achievement)
        : [...prev, achievement]
    );
  };

  const toggleChallenge = (challenge: string) => {
    setSelectedChallenges(prev =>
      prev.includes(challenge)
        ? prev.filter(c => c !== challenge)
        : [...prev, challenge]
    );
  };

  const handleSubmit = () => {
    if (!selectedMood || !content.trim()) return;

    const totalSteps = socialSteps + selectedAchievements.length * 5;
    
    if (totalSteps > 0) {
      addSocialSteps(totalSteps);
    }
    incrementStreak();
    
    addDiaryEntry({
      date: new Date().toISOString().split('T')[0],
      mood: selectedMood as 'great' | 'good' | 'neutral' | 'bad',
      content: content.trim(),
      socialSteps: totalSteps,
      challenges: selectedChallenges,
      achievements: selectedAchievements,
    });
    
    navigate('/diary');
  };

  const canSubmit = selectedMood && content.trim().length > 0;

  return (
    <div className="min-h-screen bg-white">
      <Header
        title="今日打卡"
        showBack
        rightContent={
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              canSubmit
                ? 'bg-e-500 text-white hover:bg-e-600'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Trophy className="w-4 h-4 mr-1.5" />
            完成打卡
          </button>
        }
      />
      
      <div className="p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-3">今天心情怎么样？</h3>
          <div className="grid grid-cols-4 gap-3">
            {moodOptions.map((mood) => (
              <button
                key={mood.id}
                onClick={() => setSelectedMood(mood.id)}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                  selectedMood === mood.id
                    ? mood.color + ' border-solid shadow-md scale-105'
                    : 'border-dashed border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-3xl mb-2">{mood.emoji}</span>
                <span className={`text-sm font-medium ${
                  selectedMood === mood.id ? '' : 'text-gray-600'
                }`}>
                  {mood.label}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-3">记录今天的故事</h3>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="今天发生了什么？有什么感受或收获？"
            className="w-full h-40 text-gray-800 placeholder-gray-400 resize-none focus:outline-none text-base leading-relaxed bg-gray-50 rounded-xl p-4"
            maxLength={1000}
          />
          <div className="flex justify-end">
            <span className={`text-sm ${
              content.length > 800 ? 'text-red-500' : 'text-gray-400'
            }`}>
              {content.length}/1000
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">今日成就</h3>
            <span className="text-sm text-e-600">每项 +5 社交步数</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedAchievements.map((achievement) => (
              <button
                key={achievement}
                onClick={() => toggleAchievement(achievement)}
                className={`px-3 py-2 rounded-xl text-sm transition-all ${
                  selectedAchievements.includes(achievement)
                    ? 'bg-e-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {selectedAchievements.includes(achievement) ? (
                  <Heart className="w-4 h-4 inline mr-1 fill-white" />
                ) : (
                  <Plus className="w-4 h-4 inline mr-1" />
                )}
                {achievement}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-3">遇到的挑战</h3>
          <div className="flex flex-wrap gap-2">
            {suggestedChallenges.map((challenge) => (
              <button
                key={challenge}
                onClick={() => toggleChallenge(challenge)}
                className={`px-3 py-2 rounded-xl text-sm transition-all ${
                  selectedChallenges.includes(challenge)
                    ? 'bg-orange-100 text-orange-700 border-2 border-orange-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {selectedChallenges.includes(challenge) && (
                  <X className="w-3 h-3 inline mr-1" />
                )}
                {challenge}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-3">社交步数</h3>
          <div className="card card-green">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">基础步数</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSocialSteps(Math.max(0, socialSteps - 5))}
                  className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
                >
                  -
                </button>
                <span className="text-xl font-bold text-e-600 w-12 text-center">
                  {socialSteps}
                </span>
                <button
                  onClick={() => setSocialSteps(socialSteps + 5)}
                  className="w-8 h-8 rounded-full bg-e-500 flex items-center justify-center text-white hover:bg-e-600"
                >
                  +
                </button>
              </div>
            </div>
            {selectedAchievements.length > 0 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-e-200">
                <span className="text-gray-600">成就加成 ({selectedAchievements.length}项)</span>
                <span className="text-e-600 font-medium">+{selectedAchievements.length * 5}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-e-200">
              <span className="font-semibold text-gray-800">今日总计</span>
              <span className="text-2xl font-bold text-e-600">
                {socialSteps + selectedAchievements.length * 5} 步
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-4 bg-i-50 rounded-xl"
        >
          <h4 className="text-sm font-medium text-gray-700 mb-2">💡 小提示</h4>
          <p className="text-xs text-gray-600">
            记录每一天的成长，即使是很小的进步也值得庆祝！坚持打卡，看着自己慢慢变成e人！
          </p>
        </motion.div>
      </div>
    </div>
  );
}

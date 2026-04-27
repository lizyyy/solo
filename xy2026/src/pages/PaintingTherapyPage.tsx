import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Palette,
  Image,
  Edit3,
  Lock,
  Unlock,
  ChevronRight,
  MessageCircle,
  X,
  Send,
  Eye,
  Trash2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mockPaintings, emotionMap } from '../data/mockData';
import { Painting, AIConversation, EmotionType } from '../types';

type TabType = 'classic' | 'coloring' | 'canvas' | 'gallery';

// AI 预设回复
const aiResponses: Record<string, string[]> = {
  default: [
    '这幅画让我感受到了一种深深的宁静。色彩的运用非常柔和，仿佛在诉说着内心的平静。你觉得这幅画给你带来了什么感受呢？',
    '艺术真是奇妙的语言。这幅画的构图和色彩搭配都很有特点。你有没有注意到画中的某些细节特别触动你？',
    '每一幅画都是艺术家灵魂的窗户。从这幅画中，我能感受到一种独特的情感表达。你愿意和我分享你对这幅画的理解吗？'
  ],
  '星月夜': [
    '梵高的《星月夜》真是一幅充满情感力量的作品！那些旋转的星云和流动的线条，仿佛在表达内心深处的动荡与渴望。你觉得这幅画最打动你的是什么？',
    '《星月夜》展现了梵高独特的艺术视角。那些扭曲的柏树和漩涡状的星空，既神秘又充满力量。这幅画让你联想到了什么？'
  ],
  '睡莲': [
    '莫奈的《睡莲》系列真是印象派的巅峰之作！那些模糊的轮廓和柔和的色彩，捕捉了光线变化的瞬间。站在这样的画前，你感受到了怎样的宁静？',
    '莫奈用色彩和光影创造了一个梦幻的世界。睡莲在水中的倒影，仿佛是现实与梦境的交织。这幅画给你带来了什么样的心境？'
  ],
  '向日葵': [
    '梵高的向日葵充满了生命力！那些金黄色的花瓣仿佛在追逐阳光，展现出顽强的生命力。这种强烈的色彩让你感受到了什么？',
    '向日葵代表着希望和生命力。梵高用如此强烈的黄色调，表达了对生活的热爱。这幅画有没有让你想起生活中那些充满希望的时刻？'
  ]
};

export default function PaintingTherapyPage() {
  const navigate = useNavigate();
  const { state, addArtwork, deleteArtwork, toggleArtworkPrivacy } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('classic');
  const [selectedPainting, setSelectedPainting] = useState<Painting | null>(null);
  const [aiConversations, setAiConversations] = useState<Record<string, AIConversation[]>>({});
  const [aiInput, setAiInput] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [privatePassword, setPrivatePassword] = useState('');
  const [showPrivateArtworks, setShowPrivateArtworks] = useState(false);

  // 获取当前绘画的 AI 对话
  const getCurrentConversation = () => {
    if (!selectedPainting) return [];
    return aiConversations[selectedPainting.id] || [];
  };

  // 发送消息给 AI
  const handleSendMessage = () => {
    if (!selectedPainting || !aiInput.trim()) return;

    const userMessage: AIConversation = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: aiInput,
      timestamp: Date.now()
    };

    // 更新对话
    const currentConv = aiConversations[selectedPainting.id] || [];
    const updatedConv = [...currentConv, userMessage];

    // 模拟 AI 回复
    setTimeout(() => {
      const paintingName = selectedPainting.title;
      const responses = aiResponses[paintingName] || aiResponses.default;
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      const aiMessage: AIConversation = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: randomResponse,
        timestamp: Date.now()
      };

      setAiConversations(prev => ({
        ...prev,
        [selectedPainting.id]: [...updatedConv, aiMessage]
      }));
    }, 1000);

    setAiConversations(prev => ({
      ...prev,
      [selectedPainting.id]: updatedConv
    }));

    setAiInput('');
  };

  // 密码验证
  const handlePasswordSubmit = () => {
    // 使用模拟密码 123456
    if (privatePassword === '123456') {
      setShowPrivateArtworks(true);
      setShowPasswordModal(false);
      setPrivatePassword('');
    } else {
      alert('密码错误，请重试');
    }
  };

  // 获取所有艺术品（包括私密的如果已解锁）
  const getAllArtworks = () => {
    if (showPrivateArtworks) {
      return state.userArtworks;
    }
    return state.userArtworks.filter(a => !a.isPrivate);
  };

  // 简易色彩情绪解读
  const analyzeColors = (colors: string[]): { emotion: EmotionType; description: string; suggestions: string[] } => {
    // 简单的色彩分析逻辑
    const colorEmotions: Record<string, { emotion: EmotionType; weight: number }> = {
      '#FFD700': { emotion: 'fatigue', weight: 2 }, // 金色 - 活力
      '#FFA500': { emotion: 'irritability', weight: 1 }, // 橙色 - 温暖
      '#FF6B6B': { emotion: 'irritability', weight: 2 }, // 红色 - 烦躁
      '#4ECDC4': { emotion: 'anxiety', weight: 2 }, // 青色 - 平静
      '#45B7D1': { emotion: 'insomnia', weight: 2 }, // 蓝色 - 宁静
      '#96CEB4': { emotion: 'depression', weight: 2 }, // 绿色 - 希望
      '#DDA0DD': { emotion: 'depression', weight: 1 }, // 紫色 - 神秘
      '#FFEAA7': { emotion: 'fatigue', weight: 1 }, // 黄色 - 活力
    };

    let scores: Record<EmotionType, number> = {
      anxiety: 0,
      insomnia: 0,
      depression: 0,
      fatigue: 0,
      irritability: 0
    };

    colors.forEach(color => {
      const analysis = colorEmotions[color];
      if (analysis) {
        scores[analysis.emotion] += analysis.weight;
      }
    });

    // 找出最高得分的情绪
    let dominantEmotion: EmotionType = 'anxiety';
    let maxScore = 0;

    (Object.entries(scores) as [EmotionType, number][]).forEach(([emotion, score]) => {
      if (score > maxScore) {
        maxScore = score;
        dominantEmotion = emotion;
      }
    });

    // 如果没有明显倾向，默认焦虑
    if (maxScore === 0) {
      dominantEmotion = 'anxiety';
    }

    const descriptions: Record<EmotionType, string> = {
      anxiety: '你的用色偏向冷静的色调，可能反映出内心需要更多的平静与安宁。蓝色和青色通常与平静、放松相关联。',
      insomnia: '你的色彩选择偏向宁静的蓝色调，这可能暗示着你渴望内心的平静与放松。蓝色有助于缓解紧张情绪。',
      depression: '你选择的颜色中包含了一些代表希望的绿色和温暖色调。这可能反映出你内心深处渴望温暖与关怀。',
      fatigue: '你的用色充满了活力和温暖的色调，如金色和橙色。这可能反映出你内心渴望更多的能量和活力。',
      irritability: '你的色彩选择包含了一些温暖的红色和橙色调。这可能暗示着你内心有一些需要释放的情绪能量。'
    };

    const suggestions: Record<EmotionType, string[]> = {
      anxiety: [
        '尝试在画作中加入更多柔和的蓝色和绿色',
        '可以听听舒缓的音乐，配合绘画来放松',
        '尝试深呼吸，让画笔跟随呼吸的节奏'
      ],
      insomnia: [
        '继续使用宁静的蓝色调，这有助于放松',
        '可以尝试在睡前进行简单的绘画活动',
        '柔和的紫色调也能带来平静感'
      ],
      depression: [
        '尝试加入更多温暖的色调，如黄色和橙色',
        '可以画一些代表希望的元素，如阳光、花朵',
        '分享你的画作，与他人交流感受'
      ],
      fatigue: [
        '温暖的色调很适合表达活力',
        '可以尝试画一些动态的场景',
        '配合轻快的音乐进行创作'
      ],
      irritability: [
        '尝试在画作中加入更多冷静的蓝色调',
        '绘画是释放情绪的好方式',
        '可以尝试冥想后再进行创作'
      ]
    };

    return {
      emotion: dominantEmotion,
      description: descriptions[dominantEmotion],
      suggestions: suggestions[dominantEmotion]
    };
  };

  return (
    <div className="fade-in">
      <h1 className="page-title">绘画疗愈 🎨</h1>

      {/* 选项卡 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: 'classic' as TabType, label: '名画欣赏', icon: <Image size={18} /> },
          { key: 'coloring' as TabType, label: '涂色本', icon: <Palette size={18} /> },
          { key: 'canvas' as TabType, label: '随心画板', icon: <Edit3 size={18} /> },
          { key: 'gallery' as TabType, label: '我的作品', icon: <Eye size={18} /> }
        ].map(tab => (
          <button
            key={tab.key}
            className={`flex items-center gap-2 py-3 px-4 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 名画欣赏 Tab */}
      {activeTab === 'classic' && (
        <div>
          <h3 className="section-title">与大师对话</h3>
          <p className="text-gray-500 text-sm mb-6">
            选择一幅名画，与 AI 交流你对这幅画的感受和理解
          </p>

          <div className="grid-2">
            {mockPaintings.filter(p => p.category === 'classic').map(painting => (
              <div
                key={painting.id}
                className="card cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setSelectedPainting(painting)}
              >
                <div 
                  className="w-full h-40 rounded-lg mb-3 overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #F5F5F4 0%, #E7E5E4 100%)'
                  }}
                >
                  <img
                    src={painting.imageUrl}
                    alt={painting.title}
                    className="w-full h-full object-contain"
                  />
                </div>
                <h4 className="font-semibold">{painting.title}</h4>
                <p className="text-sm text-gray-500">{painting.artist} · {painting.era}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-green-600">
                  <MessageCircle size={14} />
                  <span>点击与 AI 对话</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 涂色本 Tab */}
      {activeTab === 'coloring' && (
        <div>
          <h3 className="section-title">治愈涂色本</h3>
          <p className="text-gray-500 text-sm mb-6">
            选择一个图案，用色彩填充，让心灵在涂色中获得平静
          </p>

          <div className="grid-2">
            {mockPaintings.filter(p => p.category === 'coloring').map(painting => (
              <div
                key={painting.id}
                className="card cursor-pointer hover:shadow-lg transition-all"
                onClick={() => navigate('/drawing-canvas')}
              >
                <div 
                  className="w-full h-40 rounded-lg mb-3 overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #FAFAF9 0%, #F5F5F4 100%)'
                  }}
                >
                  <img
                    src={painting.imageUrl}
                    alt={painting.title}
                    className="w-full h-full object-contain grayscale"
                  />
                </div>
                <h4 className="font-semibold">{painting.title}</h4>
                <p className="text-sm text-gray-500">{painting.description}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-green-600">
                  <Palette size={14} />
                  <span>点击开始涂色</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 随心画板 Tab */}
      {activeTab === 'canvas' && (
        <div>
          <h3 className="section-title">空白随心画板</h3>
          <p className="text-gray-500 text-sm mb-6">
            在空白画布上自由创作，用色彩表达内心的情绪
          </p>

          <div
            className="card cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate('/drawing-canvas')}
          >
            <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center mb-4">
              <div className="text-center">
                <Edit3 size={48} className="text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">点击开始创作</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-3">
              {['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#F39C12', '#E74C3C'].map(color => (
                <div
                  key={color}
                  className="w-full h-8 rounded"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>🎨 多种颜色可选</span>
              <span>💾 自动保存</span>
              <span>🔒 私密保护</span>
            </div>
          </div>

          {/* 色彩情绪解读说明 */}
          <div className="card mt-6 bg-green-50 border-green-200">
            <h4 className="font-semibold text-green-800 mb-2">💡 简易色彩情绪解读</h4>
            <p className="text-sm text-green-700 mb-3">
              不同的颜色代表不同的情绪倾向。创作完成后，系统会根据你使用的颜色进行温和的情绪分析（非诊断性质）。
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#45B7D1' }} />
                <span className="text-green-700">蓝色 - 平静、放松</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#96CEB4' }} />
                <span className="text-green-700">绿色 - 希望、成长</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FFEAA7' }} />
                <span className="text-green-700">黄色 - 活力、快乐</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FF6B6B' }} />
                <span className="text-green-700">红色 - 热情、能量</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 我的作品 Tab */}
      {activeTab === 'gallery' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title mb-0">我的作品集</h3>
            <button
              onClick={() => {
                if (showPrivateArtworks) {
                  setShowPrivateArtworks(false);
                } else {
                  setShowPasswordModal(true);
                }
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                showPrivateArtworks
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {showPrivateArtworks ? <Unlock size={16} /> : <Lock size={16} />}
              {showPrivateArtworks ? '私密作品已解锁' : '查看私密作品'}
            </button>
          </div>

          <p className="text-gray-500 text-sm mb-6">
            {showPrivateArtworks
              ? '🔓 已解锁，可以查看所有作品（包括私密作品）'
              : '🔒 仅显示公开作品，私密作品需要密码解锁'}
          </p>

          {getAllArtworks().length === 0 ? (
            <div className="empty-state">
              <Palette size={64} className="text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">还没有作品</h3>
              <p className="text-gray-500 text-center mb-4">
                去随心画板创作你的第一幅作品吧
              </p>
              <button
                onClick={() => navigate('/drawing-canvas')}
                className="btn btn-primary"
              >
                开始创作
              </button>
            </div>
          ) : (
            <div className="grid-2">
              {[...getAllArtworks()].reverse().map(artwork => (
                <div key={artwork.id} className="card relative">
                  {artwork.isPrivate && (
                    <div className="absolute top-3 right-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center gap-1 z-10">
                      <Lock size={12} />
                      私密
                    </div>
                  )}
                  <div 
                    className="w-full h-32 rounded-lg mb-3 overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, #FAFAF9 0%, #F5F5F4 100%)'
                    }}
                  >
                    <img
                      src={artwork.imageData}
                      alt={artwork.title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h4 className="font-semibold text-sm">{artwork.title}</h4>
                  <p className="text-xs text-gray-500">
                    {new Date(artwork.createdAt).toLocaleDateString()}
                  </p>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => toggleArtworkPrivacy(artwork.id)}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs transition-all ${
                        artwork.isPrivate
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {artwork.isPrivate ? <Lock size={14} /> : <Unlock size={14} />}
                      {artwork.isPrivate ? '设为公开' : '设为私密'}
                    </button>
                    <button
                      onClick={() => deleteArtwork(artwork.id)}
                      className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* 色彩情绪分析 */}
                  {artwork.emotionAnalysis && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{emotionMap[artwork.emotionAnalysis.dominantEmotion].icon}</span>
                        <span className="text-sm font-medium text-gray-700">
                          色彩情绪倾向：{emotionMap[artwork.emotionAnalysis.dominantEmotion].name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {artwork.emotionAnalysis.description}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 名画详情 & AI 对话模态框 */}
      {selectedPainting && (
        <div className="modal-overlay" onClick={() => setSelectedPainting(null)}>
          <div
            className="modal-content fade-in max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedPainting.title}</h3>
                <p className="text-sm text-gray-500">{selectedPainting.artist} · {selectedPainting.era}</p>
              </div>
              <button
                onClick={() => setSelectedPainting(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div 
              className="w-full rounded-lg mb-4 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #F5F5F4 0%, #E7E5E4 100%)',
                height: '240px'
              }}
            >
              <img
                src={selectedPainting.imageUrl}
                alt={selectedPainting.title}
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-sm text-gray-600 mb-4">{selectedPainting.description}</p>

            {/* AI 对话区域 */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-3">
              {getCurrentConversation().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>开始与 AI 对话</p>
                  <p className="text-sm">分享你对这幅画的感受和理解</p>
                </div>
              ) : (
                getCurrentConversation().map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-xl ${
                        msg.role === 'user'
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 输入区域 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="分享你的感受..."
                className="flex-1 input"
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                disabled={!aiInput.trim()}
                className={`btn ${
                  aiInput.trim() ? 'btn-primary' : 'btn-secondary opacity-50'
                }`}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 密码模态框 */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div
            className="modal-content fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">🔒 输入密码</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-gray-500 text-sm mb-4">
              请输入私密作品集密码（测试密码：123456）
            </p>

            <div className="form-group">
              <input
                type="password"
                value={privatePassword}
                onChange={(e) => setPrivatePassword(e.target.value)}
                placeholder="请输入密码"
                className="input"
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={!privatePassword}
                className={`flex-1 btn ${
                  privatePassword ? 'btn-primary' : 'btn-secondary opacity-50'
                }`}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

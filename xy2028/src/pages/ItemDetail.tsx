import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const ItemDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { getItemById, toggleFavorite, addMessage, likeMessage, hasLikedMessage } = useApp();
  
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [authorName, setAuthorName] = useState('');

  const item = getItemById(id || '');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && item && activeStep < item.productionSteps.length - 1) {
      timer = setTimeout(() => {
        setActiveStep(prev => prev + 1);
      }, 2000);
    } else if (activeStep === item?.productionSteps.length - 1) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, activeStep, item]);

  if (!item) {
    return (
      <div className="text-center py-12">
        <span className="text-6xl block mb-4">🔍</span>
        <h2 className="text-xl font-bold text-gray-800 mb-2">物品不存在</h2>
        <Link to="/" className="text-primary hover:underline">
          返回首页
        </Link>
      </div>
    );
  }

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      addMessage(item.id, newMessage, authorName || '匿名用户');
      setNewMessage('');
      setAuthorName('');
      setShowMessageInput(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const getDifficultyLabel = (difficulty: string) => {
    const labels: Record<string, string> = {
      easy: '简单',
      medium: '中等',
      hard: '困难',
    };
    return labels[difficulty] || '未知';
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: 'bg-green-100 text-green-700',
      medium: 'bg-amber-100 text-amber-700',
      hard: 'bg-red-100 text-red-700',
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
        <div className="aspect-video bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative">
          <span className="text-9xl animate-float">{item.emoji}</span>
          <button
            onClick={() => toggleFavorite(item.id)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
          >
            <span className="text-xl">{item.favorite ? '❤️' : '🤍'}</span>
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">{item.name}</h1>
            <Link
              to={`/craft/${item.id}`}
              className="px-4 py-2 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-medium hover:shadow-lg hover:shadow-primary/30 transition-all btn-press"
            >
              🛠️ 开始制作
            </Link>
          </div>
          <p className="text-gray-600 mb-4">{item.description}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {item.tags.map((tag, idx) => (
              <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span>⚙️</span>
              <span className={`px-2 py-0.5 rounded ${getDifficultyColor(item.difficulty)}`}>
                难度：{getDifficultyLabel(item.difficulty)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <span>⏱️</span>
              <span>制作时间：约 {item.craftingTime} 分钟</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl p-6 border border-primary/10">
        <div className="flex items-start gap-4">
          <span className="text-3xl">💭</span>
          <div>
            <h3 className="font-bold text-gray-800 mb-2">造物的意义</h3>
            <p className="text-gray-600 text-sm italic mb-3">"{item.meaningMessage}"</p>
            <h4 className="font-medium text-gray-700 mb-1">治愈短句</h4>
            <p className="text-gray-600 text-sm">"{item.healingMessage}"</p>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">🏭</span>
          物件诞生流水线
        </h2>
        
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1">
              {item.productionSteps.map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => {
                    setActiveStep(idx);
                    setIsPlaying(false);
                  }}
                  className={`flex-1 h-2 rounded-full transition-all ${
                    idx <= activeStep 
                      ? 'bg-gradient-to-r from-primary to-accent' 
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => {
                if (!isPlaying && activeStep === item.productionSteps.length - 1) {
                  setActiveStep(0);
                }
                setIsPlaying(!isPlaying);
              }}
              className="ml-4 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
            >
              {isPlaying ? '⏸️ 暂停' : activeStep === item.productionSteps.length - 1 ? '🔄 重新播放' : '▶️ 播放'}
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-2xl">
                {item.productionSteps[activeStep].icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                    步骤 {activeStep + 1}/{item.productionSteps.length}
                  </span>
                  <span className="text-gray-400 text-xs">
                    预计 {item.productionSteps[activeStep].duration} 天
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-800">
                  {item.productionSteps[activeStep].name}
                </h3>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-medium text-gray-700 mb-2">
                {item.productionSteps[activeStep].description}
              </h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                {item.productionSteps[activeStep].details}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-6 gap-2">
            {item.productionSteps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => {
                  setActiveStep(idx);
                  setIsPlaying(false);
                }}
                className={`p-2 rounded-lg text-center transition-all ${
                  idx === activeStep
                    ? 'bg-primary/10 text-primary ring-2 ring-primary/30'
                    : idx < activeStep
                    ? 'bg-green-50 text-green-600'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg block">{step.icon}</span>
                <span className="text-xs hidden md:block">{step.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">📦</span>
          所需原料
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {item.rawMaterials.map((material) => (
            <div
              key={material.id}
              className="bg-white rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`w-12 h-12 mx-auto mb-2 rounded-xl ${material.color} flex items-center justify-center text-2xl`}>
                {material.icon}
              </div>
              <h4 className="font-medium text-gray-800 text-sm">{material.name}</h4>
              <p className="text-gray-500 text-xs">单位：{material.unit}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">💬</span>
            造物树洞
          </h2>
          <button
            onClick={() => setShowMessageInput(!showMessageInput)}
            className="px-4 py-2 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-colors btn-press"
          >
            ✏️ 写寄语
          </button>
        </div>

        {showMessageInput && (
          <div className="bg-white rounded-2xl p-4 shadow-sm animate-slide-up">
            <div className="space-y-3">
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="你的名字（可选，默认匿名）"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="写下你想对这件造物说的话..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowMessageInput(false)}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className={`px-6 py-2 rounded-xl font-medium transition-colors ${
                    newMessage.trim()
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  发送
                </button>
              </div>
            </div>
          </div>
        )}

        {item.messages.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-2xl">
            <span className="text-4xl block mb-2">📝</span>
            <p className="text-gray-500">还没有人留言，来做第一个吧！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {item.messages.map((message) => (
              <div key={message.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center text-sm">
                      {message.author.charAt(0)}
                    </div>
                    <div>
                      <span className="font-medium text-gray-800 text-sm">{message.author}</span>
                      <span className="text-gray-400 text-xs ml-2">{formatTime(message.timestamp)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => likeMessage(item.id, message.id)}
                    disabled={hasLikedMessage(message.id)}
                    className={`flex items-center gap-1 transition-colors text-sm ${
                      hasLikedMessage(message.id)
                        ? 'text-red-500 cursor-default'
                        : 'text-gray-400 hover:text-red-500'
                    }`}
                  >
                    <span>{hasLikedMessage(message.id) ? '❤️' : '🤍'}</span>
                    <span>{message.likes}</span>
                  </button>
                </div>
                <p className="text-gray-600 text-sm pl-10">{message.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ItemDetail;
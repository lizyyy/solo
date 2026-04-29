import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Sparkles, Brain, Heart, MessageSquare } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { ChatMessage } from '@/types';
import Header from '@/components/Header';

const aiPersonality = {
  name: '小e',
  avatar: '🦋',
  description: '你的专属e人陪练助手',
};

const aiResponses = [
  '别紧张，我来帮你！社交其实就是互相了解的过程，慢慢来~',
  '你已经做得很好了！记住，每个人都有自己的节奏，不用强迫自己像别人一样。',
  '我有个小技巧：下次想开口之前，先深呼吸三次，然后说"你好"。',
  '其实很多人都和你一样，只是他们装得比较像而已哈哈哈',
  '要不要试试角色扮演？把我当成你想聊天的对象，练习一下？',
  '你知道吗？i人其实有很多优势的：善于倾听、观察力强、做事专注...',
  '进步是需要时间的，不要急着否定自己。每一小步都是胜利！',
  '如果感到累了就休息一下，i人需要独处时间来恢复能量，这很正常。',
  '我觉得你最大的问题就是想得太多，做得太少。不如从"早上好"开始？',
  '社交不是考试，不需要追求完美。说错话也没关系，大多数人转头就忘了。',
];

const quickQuestions = [
  '今天又社恐了怎么办？',
  '怎么开始和别人聊天？',
  '我是不是永远都是i人？',
  '感到紧张怎么缓解？',
];

export default function AICoachPage() {
  const { incrementCompletedPractices } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: '你好呀！我是你的专属e人陪练助手小e 🦋\n\n有什么想聊的吗？不管是社交困惑、情绪问题，还是只是想找人吐槽，我都在这里陪着你~',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: randomResponse,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  };

  const handleQuickQuestion = (question: string) => {
    setInputText(question);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-i-50 to-white flex flex-col">
      <Header title="虚拟e人陪练" showBack />
      
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-i-400 to-e-400 flex items-center justify-center text-2xl mr-3">
            {aiPersonality.avatar}
          </div>
          <div>
            <div className="flex items-center">
              <h3 className="font-semibold text-gray-800 mr-2">{aiPersonality.name}</h3>
              <Sparkles className="w-4 h-4 text-yellow-500" />
            </div>
            <p className="text-xs text-gray-500">{aiPersonality.description}</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 pb-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-i-400 to-e-400 flex items-center justify-center text-sm mr-2 flex-shrink-0">
                  {aiPersonality.avatar}
                </div>
              )}
              
              <div className="flex flex-col max-w-[80%]">
                <div
                  className={`text-bubble whitespace-pre-line ${
                    message.role === 'user' ? 'text-bubble-user' : 'text-bubble-ai'
                  }`}
                >
                  {message.content}
                </div>
                <span className="text-xs text-gray-400 mt-1">
                  {formatTime(message.timestamp)}
                </span>
              </div>
              
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-i-500 flex items-center justify-center text-white text-sm ml-2 flex-shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
            </motion.div>
          ))}
          
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-i-400 to-e-400 flex items-center justify-center text-sm mr-2 flex-shrink-0">
                {aiPersonality.avatar}
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {messages.length === 1 && (
        <div className="bg-white border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500 mb-2">试试这些问题：</p>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleQuickQuestion(question)}
                className="px-3 py-1.5 bg-i-50 text-i-600 rounded-full text-sm hover:bg-i-100 transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="和小e聊聊..."
              className="w-full px-4 py-2.5 bg-gray-100 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-i-300 text-gray-800"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '100px' }}
            />
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isTyping}
            className={`p-2.5 rounded-full transition-colors ${
              inputText.trim() && !isTyping
                ? 'bg-gradient-to-br from-i-500 to-e-500 text-white hover:from-i-600 hover:to-e-600'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center justify-center mt-3 space-x-6">
          <button className="flex flex-col items-center text-xs text-gray-400">
            <Brain className="w-5 h-5 mb-1" />
            心理疏导
          </button>
          <button className="flex flex-col items-center text-xs text-gray-400">
            <MessageSquare className="w-5 h-5 mb-1" />
            场景模拟
          </button>
          <button className="flex flex-col items-center text-xs text-gray-400">
            <Heart className="w-5 h-5 mb-1" />
            情绪陪伴
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Smile, ArrowLeft, ThumbsUp, HelpCircle, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { chatScenarios } from '@/data/mockData';
import { ChatMessage } from '@/types';
import Header from '@/components/Header';

const aiResponses = [
  '哈哈，确实挺忙的。你最近怎么样？',
  '哦，真的吗？那听起来挺有意思的！',
  '我最近也在看类似的东西，你觉得怎么样？',
  '那你一般周末喜欢做什么呢？',
  '哇，听起来很棒！有机会带我一起去看看？',
  '原来是这样，我之前还不太了解呢。',
  '你说得有道理，我之前没这么想过。',
  '那你是怎么开始喜欢上这个的？',
  '真的假的？快给我详细说说！',
  '我也有过类似的经历，真的不容易啊...',
];

const quickReplies = [
  '我也觉得挺忙的',
  '最近在忙工作/学习',
  '你呢？最近怎么样？',
  '周末一般宅在家里',
  '喜欢看电影/听音乐',
  '最近在学新东西',
];

const emojis = [
  { category: '常用', emojis: ['😀', '😂', '🤣', '😊', '🥰', '😍', '🤔', '😅', '🙂', '😉', '😎', '🥳', '😢', '😭', '😤', '🤔', '😶', '🤐', '😴', '🤗'] },
  { category: '手势', emojis: ['👍', '👎', '👋', '🤝', '🙏', '💪', '👏', '🙌', '👐', '🤲', '💅', '👆', '👇', '👈', '👉', '✌️', '🤞', '🫶', '💋', '💔'] },
  { category: '其他', emojis: ['❤️', '🔥', '⭐', '🎉', '🎁', '🌹', '💐', '🍺', '☕', '🎵', '🎮', '📱', '💻', '🚗', '✈️', '🌈', '☀️', '🌙', '⭐', '🌟'] },
];

const emojiCategories = ['常用', '手势', '其他'];

export default function ChatSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scenarioId = searchParams.get('scenario');
  
  const { addChatMessage, chatMessages, currentChatScenario, startChat, endChat, incrementCompletedPractices } = useAppStore();
  
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scenario = chatScenarios.find(s => s.id === scenarioId);

  useEffect(() => {
    if (scenario && !currentChatScenario) {
      const initialMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'ai',
        content: scenario.initialMessage,
        timestamp: new Date().toISOString(),
      };
      startChat(scenario.id, initialMessage);
    }
  }, [scenario, currentChatScenario, startChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping, showEmojiPicker]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };
    
    addChatMessage(userMessage);
    setInputText('');
    setShowQuickReplies(false);
    setShowEmojiPicker(false);
    
    setIsTyping(true);
    
    setTimeout(() => {
      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: randomResponse,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(aiMessage);
      setIsTyping(false);
      setShowQuickReplies(true);
    }, 1500 + Math.random() * 1000);
  };

  const handleQuickReply = (text: string) => {
    setInputText(text);
  };

  const handleEmojiClick = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  const handleEndChat = () => {
    incrementCompletedPractices();
    endChat();
    navigate('/chat');
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const activeEmojis = emojis[activeEmojiCategory]?.emojis || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        title={scenario?.title || '聊天练习'}
        showBack
        onBack={handleEndChat}
        rightContent={
          <button
            onClick={handleEndChat}
            className="text-sm text-i-500 font-medium"
          >
            结束练习
          </button>
        }
      />
      
      {scenario && (
        <div className="bg-white border-b border-gray-100 px-4 py-2">
          <p className="text-xs text-gray-500 text-center">
            场景：{scenario.description}
          </p>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 pb-4">
        <div className="space-y-4">
          {chatMessages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-i-400 to-e-400 flex items-center justify-center text-white text-sm mr-2 flex-shrink-0">
                  {scenario?.icon?.slice(0, 1) || '🤖'}
                </div>
              )}
              
              <div className="flex flex-col max-w-[75%]">
                <div
                  className={`text-bubble ${
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
                  我
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-i-400 to-e-400 flex items-center justify-center text-white text-sm mr-2 flex-shrink-0">
                {scenario?.icon?.slice(0, 1) || '🤖'}
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
      
      {showQuickReplies && !isTyping && chatMessages.length > 0 && (
        <div className="bg-white border-t border-gray-100 px-4 py-2">
          <div className="flex overflow-x-auto no-scrollbar space-x-2">
            {quickReplies.map((reply, index) => (
              <button
                key={index}
                onClick={() => handleQuickReply(reply)}
                className="flex-shrink-0 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-t border-gray-200 overflow-hidden"
          >
            <div className="flex items-center justify-between px-2 py-2 border-b border-gray-100">
              <div className="flex space-x-1">
                {emojiCategories.map((category, index) => (
                  <button
                    key={category}
                    onClick={() => setActiveEmojiCategory(index)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      activeEmojiCategory === index
                        ? 'bg-i-100 text-i-600'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            
            <div className="p-2 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-10 gap-1">
                {activeEmojis.map((emoji, index) => (
                  <button
                    key={index}
                    onClick={() => handleEmojiClick(emoji)}
                    className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-gray-100 rounded-lg transition-colors active:bg-gray-200"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-end space-x-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2 rounded-full transition-colors ${
              showEmojiPicker
                ? 'bg-i-100 text-i-600'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Smile className="w-6 h-6" />
          </button>
          
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <Paperclip className="w-6 h-6" />
          </button>
          
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
              placeholder="输入消息..."
              className="w-full px-4 py-2 bg-gray-100 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-i-300 text-gray-800"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '100px' }}
            />
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isTyping}
            className={`p-2 rounded-full transition-colors ${
              inputText.trim() && !isTyping
                ? 'bg-i-500 text-white hover:bg-i-600'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center space-x-4">
            <button className="flex items-center text-xs text-gray-400 hover:text-gray-600">
              <HelpCircle className="w-4 h-4 mr-1" />
              需要帮助
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <button className="flex items-center text-xs text-gray-400 hover:text-gray-600">
              <ThumbsUp className="w-4 h-4 mr-1" />
              好评
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

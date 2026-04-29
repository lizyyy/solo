import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  MessageCircle,
  Volume2,
  ChevronRight,
  ChevronDown,
  X,
  Copy,
  Check,
  AlertTriangle,
  Heart,
  HelpCircle,
} from 'lucide-react';
import { responseTemplates } from '@/data/mockData';
import { ResponseTemplate } from '@/types';
import Header from '@/components/Header';

const fakeCalls = [
  { id: 'mom', name: '妈妈', avatar: '👩', number: '138****0000' },
  { id: 'friend', name: '好友小明', avatar: '👨', number: '139****1234' },
  { id: 'work', name: '同事小李', avatar: '👔', number: '150****5678' },
  { id: 'delivery', name: '外卖小哥', avatar: '🛵', number: '173****9999' },
];

export default function EmergencyPage() {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<ResponseTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  
  const [showFakeCall, setShowFakeCall] = useState(false);
  const [selectedCaller, setSelectedCaller] = useState(fakeCalls[0]);
  const [isCalling, setIsCalling] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const handleCopyScript = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleStartCall = (caller: typeof fakeCalls[0]) => {
    setSelectedCaller(caller);
    setIsCalling(true);
    setShowFakeCall(true);
    
    setTimeout(() => {
      setIsConnected(true);
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      
      return () => clearInterval(interval);
    }, 3000);
  };

  const handleEndCall = () => {
    setIsCalling(false);
    setIsConnected(false);
    setCallDuration(0);
    setShowFakeCall(false);
  };

  const formatCallTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen pb-20">
      <Header title="万能应答库" />
      
      <div className="p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-gradient-to-r from-red-500 to-orange-500 text-white mb-6 cursor-pointer"
          onClick={() => setShowFakeCall(true)}
        >
          <div className="flex items-center">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mr-4">
              <Phone className="w-7 h-7 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">悄悄话模式</h3>
              <p className="text-sm text-white/80">
                模拟来电，趁机逃离尴尬社交场合
              </p>
            </div>
            <ChevronRight className="w-5 h-5" />
          </div>
        </motion.div>

        <h3 className="text-lg font-semibold text-gray-800 mb-3">场景化话术模板</h3>
        
        <div className="space-y-3">
          {responseTemplates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card"
            >
              <button
                onClick={() => setExpandedScript(expandedScript === template.id ? null : template.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-i-100 rounded-xl flex items-center justify-center mr-3">
                      {template.category === 'end_conversation' && <MessageCircle className="w-5 h-5 text-i-500" />}
                      {template.category === 'accept_praise' && <Heart className="w-5 h-5 text-i-500" />}
                      {template.category === 'awkward_silence' && <AlertTriangle className="w-5 h-5 text-i-500" />}
                      {template.category === 'decline_invitation' && <X className="w-5 h-5 text-i-500" />}
                      {template.category === 'ask_question' && <HelpCircle className="w-5 h-5 text-i-500" />}
                      {template.category === 'express_thanks' && <Heart className="w-5 h-5 text-i-500" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">{template.title}</h4>
                      <p className="text-sm text-gray-500">{template.scenario}</p>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: expandedScript === template.id ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {expandedScript === template.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      <div className="space-y-2">
                        <div className="card card-purple">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">🌿 随意版</span>
                            <button
                              onClick={() => handleCopyScript(template.scripts.casual, `${template.id}-casual`)}
                              className="p-1 rounded hover:bg-i-100 transition-colors"
                            >
                              {copiedId === `${template.id}-casual` ? (
                                <Check className="w-4 h-4 text-e-500" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          </div>
                          <p className="text-sm text-gray-700">{template.scripts.casual}</p>
                        </div>

                        <div className="card card-green">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">🎩 礼貌版</span>
                            <button
                              onClick={() => handleCopyScript(template.scripts.polite, `${template.id}-polite`)}
                              className="p-1 rounded hover:bg-e-100 transition-colors"
                            >
                              {copiedId === `${template.id}-polite` ? (
                                <Check className="w-4 h-4 text-e-500" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          </div>
                          <p className="text-sm text-gray-700">{template.scripts.polite}</p>
                        </div>

                        <div className="card bg-gradient-to-br from-accent-50 to-orange-50 border border-accent-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">😄 幽默版</span>
                            <button
                              onClick={() => handleCopyScript(template.scripts.humorous, `${template.id}-humorous`)}
                              className="p-1 rounded hover:bg-accent-100 transition-colors"
                            >
                              {copiedId === `${template.id}-humorous` ? (
                                <Check className="w-4 h-4 text-e-500" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          </div>
                          <p className="text-sm text-gray-700">{template.scripts.humorous}</p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">💡 小提示</h5>
                        <ul className="space-y-1">
                          {template.tips.map((tip, tipIndex) => (
                            <li key={tipIndex} className="flex items-start text-sm text-gray-600">
                              <span className="text-e-500 mr-2">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showFakeCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => !isCalling && setShowFakeCall(false)}
          >
            {!isCalling ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-sm overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-r from-i-500 to-e-500 p-6 text-center text-white">
                  <Phone className="w-12 h-12 mx-auto mb-3" />
                  <h3 className="text-xl font-bold mb-1">选择来电人</h3>
                  <p className="text-sm text-white/80">模拟来电，帮你逃离尴尬</p>
                </div>
                
                <div className="p-4 space-y-2">
                  {fakeCalls.map((caller) => (
                    <button
                      key={caller.id}
                      onClick={() => handleStartCall(caller)}
                      className="w-full flex items-center p-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-3xl mr-4">{caller.avatar}</span>
                      <div className="text-left">
                        <p className="font-medium text-gray-800">{caller.name}</p>
                        <p className="text-sm text-gray-500">{caller.number}</p>
                      </div>
                      <Volume2 className="w-5 h-5 text-gray-400 ml-auto" />
                    </button>
                  ))}
                </div>
                
                <div className="p-4 border-t border-gray-100">
                  <button
                    onClick={() => setShowFakeCall(false)}
                    className="w-full py-3 text-gray-500 font-medium"
                  >
                    取消
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-gradient-to-b from-gray-800 to-black w-full max-w-sm h-full max-h-[600px] rounded-3xl overflow-hidden flex flex-col relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-12 bg-transparent" />
                
                <div className="flex-1 flex flex-col items-center justify-center text-white">
                  <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-6xl mb-4">
                    {selectedCaller.avatar}
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-1">{selectedCaller.name}</h3>
                  <p className="text-gray-400 mb-2">{selectedCaller.number}</p>
                  <p className="text-gray-400">
                    {!isConnected ? '正在呼叫...' : formatCallTime(callDuration)}
                  </p>
                </div>
                
                {isConnected && (
                  <div className="flex items-center justify-center space-x-2 mb-4">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-2 h-4 bg-green-500 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                      className="w-2 h-5 bg-green-400 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                      className="w-2 h-3 bg-green-500 rounded-full"
                    />
                  </div>
                )}
                
                <div className="p-8 pb-12">
                  <div className="flex items-center justify-around">
                    <button className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
                      <Volume2 className="w-7 h-7 text-white" />
                    </button>
                    
                    <button
                      onClick={handleEndCall}
                      className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-lg"
                    >
                      <Phone className="w-10 h-10 text-white transform rotate-135" />
                    </button>
                    
                    <button className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
                      <X className="w-7 h-7 text-white" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

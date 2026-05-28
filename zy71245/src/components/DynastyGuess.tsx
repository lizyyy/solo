import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Lightbulb } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

const dynasties = [
  { id: 'tang', name: '唐代', period: '618-907' },
  { id: 'song', name: '宋代', period: '960-1279' },
  { id: 'yuan', name: '元代', period: '1271-1368' },
  { id: 'ming', name: '明代', period: '1368-1644' },
  { id: 'qing', name: '清代', period: '1644-1912' },
  { id: 'modern', name: '近现代', period: '1912-' },
  { id: 'modern-fake', name: '现代仿品', period: '20世纪后' },
];

interface DynastyGuessProps {
  onNext: () => void;
  onBack: () => void;
}

export default function DynastyGuess({ onNext, onBack }: DynastyGuessProps) {
  const { currentSession, setDynastyGuess } = useGameStore();
  const [selectedDynasty, setSelectedDynasty] = useState(currentSession?.dynastyGuess || '');
  const [reasoning, setReasoning] = useState(currentSession?.reasoningNotes || '');

  const handleConfirm = () => {
    if (selectedDynasty) {
      setDynastyGuess(selectedDynasty, reasoning);
      onNext();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto p-8"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-lapis-100 rounded-full mb-4">
          <Calendar className="w-8 h-8 text-lapis-300" />
        </div>
        <h2 className="text-3xl font-kai text-ink-300 mb-2">年代推断</h2>
        <p className="text-ink-200 font-song">
          根据您发现的线索，推断此画的真实创作年代
        </p>
      </div>

      <div className="bg-paper-50 rounded-lg p-6 border border-paper-300 mb-6">
        <h3 className="font-kai text-lg text-ink-300 mb-4">选择年代</h3>
        <div className="grid grid-cols-3 gap-3">
          {dynasties.map((dynasty) => (
            <button
              key={dynasty.id}
              onClick={() => setSelectedDynasty(dynasty.id)}
              className={`p-4 rounded-lg border-2 transition-all font-kai ${
                selectedDynasty === dynasty.id
                  ? 'border-lapis-300 bg-lapis-50 text-lapis-300'
                  : 'border-paper-300 bg-paper-50 text-ink-200 hover:border-lapis-200'
              }`}
            >
              <div className="text-lg">{dynasty.name}</div>
              <div className="text-xs opacity-70">{dynasty.period}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-paper-50 rounded-lg p-6 border border-paper-300 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h3 className="font-kai text-lg text-ink-300">推理依据</h3>
        </div>
        <p className="text-sm text-ink-200 font-song mb-4">
          请简述您做出此年代判断的依据，这将影响您的逻辑得分：
        </p>
        <textarea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="例如：印章风格与清代不符，纸张检测显示为现代..."
          className="w-full p-4 rounded-lg border border-paper-300 bg-paper-100 text-ink-200 font-song resize-none h-32 focus:outline-none focus:border-lapis-300"
        />
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-paper-200 text-ink-200 rounded-lg font-kai hover:bg-paper-300 transition-colors"
        >
          返回线索分析
        </button>
        <button
          onClick={handleConfirm}
          disabled={!selectedDynasty}
          className={`px-6 py-3 rounded-lg font-kai transition-colors ${
            selectedDynasty
              ? 'bg-lapis-300 text-white hover:bg-lapis-200'
              : 'bg-paper-300 text-paper-100 cursor-not-allowed'
          }`}
        >
          下一步：风险评级
        </button>
      </div>
    </motion.div>
  );
}

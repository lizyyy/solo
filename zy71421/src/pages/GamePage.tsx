import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, CheckCircle } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { getLevelById } from '../data/levels';
import { calculateMeasureBeats, calculateScore } from '../utils/validation';
import { saveCompletedLevel } from '../utils/storage';
import { DraggableNote } from '../components/DraggableNote';
import { MeasureTrack } from '../components/MeasureTrack';
import { FeedbackMessage } from '../components/FeedbackMessage';
import { ScorePanel } from '../components/ScorePanel';
import { NoteIcon } from '../components/NoteIcon';
import { NoteCard } from '../types';

export const GamePage: React.FC = () => {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  
  const {
    currentLevel,
    setLevel,
    placeNote,
    resetGame,
    clearFeedback,
    getAvailableNotes,
    feedbackMessage,
    actionHistory,
  } = useGameStore();

  const [activeNote, setActiveNote] = React.useState<NoteCard | null>(null);

  useEffect(() => {
    if (levelId) {
      const level = getLevelById(levelId);
      if (level) {
        setLevel(level);
      } else {
        navigate('/');
      }
    }
  }, [levelId, navigate, setLevel]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'note') {
      setActiveNote(active.data.current.note);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveNote(null);
    const { active, over } = event;

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === 'note' && overData?.type === 'slot') {
      placeNote(active.id as string, over.id as string);
    }
  };

  const scoreData = useMemo(() => {
    if (!currentLevel) return { score: 0, accuracy: 0, stars: 0 };
    return calculateScore(currentLevel.measures, actionHistory);
  }, [currentLevel, actionHistory]);

  const completedMeasures = useMemo(() => {
    if (!currentLevel) return 0;
    return currentLevel.measures.filter(m => {
      const beats = calculateMeasureBeats(m.slots);
      return beats === m.targetBeats;
    }).length;
  }, [currentLevel]);

  const isGameComplete = useMemo(() => {
    if (!currentLevel) return false;
    return currentLevel.measures.every(m => {
      const beats = calculateMeasureBeats(m.slots);
      return beats === m.targetBeats;
    });
  }, [currentLevel]);

  const handleFinish = () => {
    if (!currentLevel) return;
    
    saveCompletedLevel({
      levelId: currentLevel.id,
      score: scoreData.score,
      accuracy: scoreData.accuracy,
      completedAt: Date.now(),
      stars: scoreData.stars,
    });

    navigate(`/result/${currentLevel.id}`);
  };

  const availableNotes = getAvailableNotes();

  if (!currentLevel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-factory-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen p-4 md:p-6">
        {feedbackMessage && (
          <FeedbackMessage
            type={feedbackMessage.type}
            message={feedbackMessage.message}
            onClose={clearFeedback}
          />
        )}

        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md text-gear-700 hover:bg-gear-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              返回
            </motion.button>

            <h1 className="font-display text-2xl text-factory-700 hidden md:block">
              {currentLevel.name}
            </h1>

            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={resetGame}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md text-gear-700 hover:bg-gear-50 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                重置
              </motion.button>

              {isGameComplete && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleFinish}
                  className="factory-button flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  完成
                </motion.button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <div className="factory-card p-4 mb-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-factory-700">
                    节拍轨 - {currentLevel.timeSignature.numerator}/{currentLevel.timeSignature.denominator}拍
                  </h2>
                  <span className="text-sm text-gear-500">
                    目标：填满每个小节，达到正确的拍数
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {currentLevel.measures.map((measure, index) => (
                  <MeasureTrack
                    key={measure.id}
                    measure={measure}
                    index={index}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <ScorePanel
                score={scoreData.score}
                accuracy={scoreData.accuracy}
                completedMeasures={completedMeasures}
                totalMeasures={currentLevel.measures.length}
              />

              <div className="factory-card p-4">
                <h3 className="font-display text-lg text-factory-700 mb-4">
                  音符卡池
                </h3>
                <div className="flex flex-wrap gap-3 justify-center">
                  {availableNotes.length > 0 ? (
                    availableNotes.map((note) => (
                      <DraggableNote key={note.id} note={note} />
                    ))
                  ) : (
                    <div className="text-gear-400 text-sm py-4">
                      所有音符已放置
                    </div>
                  )}
                </div>
              </div>

              <div className="factory-card p-4">
                <h4 className="font-medium text-gear-700 mb-2 text-sm">操作提示</h4>
                <ul className="text-xs text-gear-500 space-y-1">
                  <li>• 拖拽音符到工位槽中放置</li>
                  <li>• 点击已放置的音符可移除</li>
                  <li>• 确保小节拍数不超过目标值</li>
                  <li>• 橙色圆点标记的是附点音符</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeNote && (
            <div className="note-card shadow-2xl border-factory-500 scale-110">
              <NoteIcon type={activeNote.type} size={36} />
              <span className={`text-xs mt-1 font-medium ${
                activeNote.hasDot ? 'text-factory-600' : 'text-gear-600'
              }`}>
                {activeNote.name}
              </span>
              <span className="text-xs text-gear-400">
                {activeNote.duration}拍
              </span>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

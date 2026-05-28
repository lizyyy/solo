import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, Play, Pause, SkipForward, SkipBack, RotateCcw, Clock, Search } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export default function Replay() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { loadSessions, loadReplaySession, currentLevel, currentSession } = useGameStore();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (sessionId) {
      loadReplaySession(sessionId);
    }
  }, [sessionId, loadReplaySession]);

  const sortedChoices = useMemo(() => {
    if (!currentSession) return [];
    return [...currentSession.playerChoices].sort((a, b) => a.timestamp - b.timestamp);
  }, [currentSession]);

  const currentChoice = sortedChoices[currentStepIndex];
  const currentClue = currentChoice ? currentLevel?.clues.find(c => c.id === currentChoice.clueId) : null;
  const currentNote = currentChoice ? currentSession?.playerNotes.find(n => n.clueId === currentChoice.clueId) : null;

  useEffect(() => {
    if (isPlaying && sortedChoices.length > 0) {
      const timer = setInterval(() => {
        setCurrentStepIndex(prev => {
          if (prev >= sortedChoices.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000 / playbackSpeed);
      return () => clearInterval(timer);
    }
  }, [isPlaying, playbackSpeed, sortedChoices.length, sortedChoices]);

  if (!currentLevel || !currentSession) {
    return (
      <div className="min-h-screen bg-paper-100 flex items-center justify-center">
        <div className="text-ink-200 font-kai">加载回放数据中...</div>
      </div>
    );
  }

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  
  const handlePrev = () => {
    setCurrentStepIndex(prev => Math.max(0, prev - 1));
    setIsPlaying(false);
  };
  
  const handleNext = () => {
    setCurrentStepIndex(prev => Math.min(sortedChoices.length - 1, prev + 1));
    setIsPlaying(false);
  };
  
  const handleRestart = () => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN');
  };

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      paper: '纸张',
      seal: '印章',
      calligraphy: '题跋',
      restoration: '修复',
      report: '报告'
    };
    return names[category] || category;
  };

  return (
    <div className="min-h-screen bg-paper-100 bg-paper-texture">
      <div className="h-16 bg-gradient-to-r from-paper-200 via-paper-100 to-paper-200 border-b-2 border-paper-300 flex items-center px-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-ink-200 hover:text-ink-300 transition-colors"
        >
          <Home className="w-5 h-5" />
          <span className="font-kai">返回首页</span>
        </button>

        <div className="flex-1 flex justify-center">
          <h1 className="font-kai text-xl text-ink-300">
            回放：{currentLevel.title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-200 font-song">
            回放模式
          </span>
        </div>
      </div>

      <div className="h-14 bg-paper-50 border-b border-paper-200 flex items-center justify-center gap-6">
        <button
          onClick={handleRestart}
          className="p-2 text-ink-200 hover:text-ink-300 transition-colors"
          title="重新开始"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={handlePrev}
          disabled={currentStepIndex === 0}
          className="p-2 text-ink-200 hover:text-ink-300 transition-colors disabled:opacity-40"
          title="上一步"
        >
          <SkipBack className="w-5 h-5" />
        </button>
        <button
          onClick={handlePlayPause}
          className="p-3 bg-seal-300 text-white rounded-full hover:bg-seal-200 transition-colors"
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </button>
        <button
          onClick={handleNext}
          disabled={currentStepIndex >= sortedChoices.length - 1}
          className="p-2 text-ink-200 hover:text-ink-300 transition-colors disabled:opacity-40"
          title="下一步"
        >
          <SkipForward className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm text-ink-200 font-song">速度：</span>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="px-2 py-1 bg-paper-100 border border-paper-300 rounded text-sm font-song"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
          </select>
        </div>
        <div className="text-sm text-ink-200 font-song ml-4">
          {currentStepIndex + 1} / {sortedChoices.length}
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="bg-paper-50 rounded-lg p-4 border border-paper-300 text-center">
              <div className="text-3xl font-bold text-seal-300 font-kai">
                {currentSession.score?.totalScore || 0}
              </div>
              <div className="text-sm text-ink-200 font-song">总分</div>
            </div>
            <div className="bg-paper-50 rounded-lg p-4 border border-paper-300 text-center">
              <div className="text-3xl font-bold text-lapis-300 font-kai">
                {currentSession.score?.grade || 'D'}
              </div>
              <div className="text-sm text-ink-200 font-song">评级</div>
            </div>
            <div className="bg-paper-50 rounded-lg p-4 border border-paper-300 text-center">
              <div className="text-3xl font-bold text-bronze-300 font-kai">
                {sortedChoices.length}
              </div>
              <div className="text-sm text-ink-200 font-song">关键操作</div>
            </div>
          </div>

          <div className="bg-paper-50 rounded-lg border-2 border-paper-300 overflow-hidden">
            <div className="p-6 border-b border-paper-200 bg-gradient-to-r from-paper-100 to-paper-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-kai text-xl text-ink-300">操作时间线</h3>
                <div className="flex items-center gap-2 text-sm text-ink-200 font-song">
                  <Clock className="w-4 h-4" />
                  {formatTime(currentSession.startTime)} - {formatTime(currentSession.endTime || Date.now())}
                </div>
              </div>
              
              <div className="flex gap-1 overflow-x-auto pb-2">
                {sortedChoices.map((choice, index) => {
                  const clue = currentLevel.clues.find(c => c.id === choice.clueId);
                  const isActive = index === currentStepIndex;
                  const isPast = index < currentStepIndex;
                  
                  return (
                    <button
                      key={choice.id}
                      onClick={() => {
                        setCurrentStepIndex(index);
                        setIsPlaying(false);
                      }}
                      className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-seal-300 text-white scale-110 shadow-lg'
                          : isPast
                          ? 'bg-bronze-200 text-white'
                          : 'bg-paper-200 text-ink-200 hover:bg-paper-300'
                      }`}
                      title={clue?.title}
                    >
                      <span className="font-kai text-sm">{index + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6">
              {currentChoice && currentClue ? (
                <motion.div
                  key={currentChoice.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-kai mb-2 ${
                        currentClue.category === 'paper' ? 'bg-amber-100 text-amber-700' :
                        currentClue.category === 'seal' ? 'bg-red-100 text-red-700' :
                        currentClue.category === 'calligraphy' ? 'bg-blue-100 text-blue-700' :
                        currentClue.category === 'restoration' ? 'bg-green-100 text-green-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {getCategoryName(currentClue.category)}
                      </span>
                      <h4 className="font-kai text-lg text-ink-300">{currentClue.title}</h4>
                      <p className="text-sm text-ink-200 font-song mt-1">{currentClue.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-ink-200 font-song">操作时间</div>
                      <div className="font-kai text-ink-300">{formatTime(currentChoice.timestamp)}</div>
                    </div>
                  </div>

                  <div className="bg-paper-100 rounded-lg p-4 border border-paper-200">
                    <h5 className="font-kai text-ink-300 mb-2 flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      线索详情
                    </h5>
                    <p className="text-ink-200 font-song leading-relaxed">
                      {currentClue.originalValue}
                    </p>
                  </div>

                  <div className={`p-4 rounded-lg border-2 ${
                    currentChoice.markedAsAnomaly
                      ? 'bg-seal-50 border-seal-200'
                      : 'bg-bronze-50 border-bronze-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-kai ${
                        currentChoice.markedAsAnomaly ? 'text-seal-300' : 'text-bronze-300'
                      }`}>
                        {currentChoice.markedAsAnomaly ? '🔴' : '🟢'}
                      </span>
                      <div>
                        <div className="font-kai text-ink-300">
                          {currentChoice.markedAsAnomaly ? '标记为疑点' : '判定为正常'}
                        </div>
                        {currentChoice.riskRating && (
                          <div className="text-sm text-ink-200 font-song">
                            风险评级：{currentChoice.riskRating === 1 ? '低风险' : currentChoice.riskRating === 2 ? '中风险' : '高风险'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {currentClue.isAnomaly && (
                    <div className="p-4 bg-lapis-50 rounded-lg border border-lapis-200">
                      <div className="text-sm text-lapis-600 font-song">
                        <span className="font-kai">正确答案：</span>此线索为 {currentClue.isAnomaly ? '疑点' : '正常线索'}
                        {currentChoice.markedAsAnomaly === currentClue.isAnomaly ? (
                          <span className="text-bronze-600 ml-2">✓ 判断正确</span>
                        ) : (
                          <span className="text-seal-600 ml-2">✗ 判断失误</span>
                        )}
                      </div>
                    </div>
                  )}

                  {currentNote && (
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <h5 className="font-kai text-amber-700 mb-2">📝 玩家笔记</h5>
                      <p className="text-ink-200 font-song">{currentNote.content}</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="text-center py-12 text-ink-200 font-song">
                  点击时间线上的节点查看操作详情
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => navigate(`/game/${currentLevel.id}/conclusion`)}
              className="px-6 py-3 bg-lapis-300 text-white rounded-lg font-kai hover:bg-lapis-200 transition-colors"
            >
              查看完整结算
            </button>
            <button
              onClick={() => navigate(`/game/${currentLevel.id}`)}
              className="px-6 py-3 bg-seal-300 text-white rounded-lg font-kai hover:bg-seal-200 transition-colors"
            >
              重新鉴定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, FileText, Home, Trophy } from 'lucide-react';
import { getSession } from '../utils/storage';
import { GameSession, GameEvent } from '../game/types';
import { formatTime } from '../utils/export';
import { scoringEngine } from '../game/scoringEngine';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

const ReplayPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<GameSession | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<GameEvent | null>(null);

  useEffect(() => {
    if (sessionId) {
      const data = getSession(sessionId);
      setSession(data);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!isPlaying || !session) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        if (prev >= session.duration) {
          setIsPlaying(false);
          return session.duration;
        }
        return prev + playbackSpeed;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, session, playbackSpeed]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">未找到该记录</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-navy-700 rounded-lg hover:bg-navy-600"
          >
            返回主页
          </button>
        </div>
      </div>
    );
  }

  const rating = scoringEngine.getScoreRating(session.finalScore);

  const currentEvents = session.events.filter(e => e.timestamp <= currentTime);
  const visibleEvents = currentEvents.slice(-10);

  const radarData = [
    { subject: '安检准确率', A: session.scores.accuracy, fullMark: 100 },
    { subject: '通行效率', A: session.scores.efficiency, fullMark: 100 },
    { subject: 'VIP服务', A: session.scores.vipService, fullMark: 100 },
    { subject: '应急处置', A: session.scores.emergency, fullMark: 100 },
  ];

  const eventTypeData = [
    { name: '放行', count: session.events.filter(e => e.type === 'pass').length, color: '#2A9D8F' },
    { name: '拦截', count: session.events.filter(e => e.type === 'block').length, color: '#E63946' },
    { name: '警告', count: session.events.filter(e => e.type === 'warning').length, color: '#F4A261' },
    { name: '调度', count: session.events.filter(e => e.type === 'dispatch').length, color: '#3B82F6' },
  ];

  const getEventColor = (event: GameEvent) => {
    if (event.scoreChange < 0) return 'border-l-warning bg-warning/10';
    if (event.scoreChange > 0) return 'border-l-success bg-success/10';
    return 'border-l-navy-500 bg-navy-800/50';
  };

  return (
    <div className="min-h-screen bg-navy-900">
      <header className="h-14 px-4 flex items-center justify-between border-b border-navy-700 bg-navy-800/50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-navy-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg">📊 复盘回放</h1>
          <span className="text-xs bg-navy-700 px-2 py-1 rounded">
            {session.difficulty === 'easy' ? '简单' : session.difficulty === 'normal' ? '普通' : '困难'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/report/${sessionId}`)}
            className="px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            查看报告
          </button>
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-navy-700 rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-navy-800/50 rounded-2xl p-6 border border-navy-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">最终得分</p>
                <p className="text-5xl font-bold mt-1">{session.finalScore}</p>
              </div>
              <div className={`text-6xl font-black ${rating.color}`}>
                {rating.grade}
              </div>
            </div>
            <p className={`mt-2 ${rating.color}`}>{rating.message}</p>
          </div>

          <div className="bg-navy-800/50 rounded-2xl p-6 border border-navy-700">
            <p className="text-gray-400 text-sm mb-2">四项评分</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Radar name="得分" dataKey="A" stroke="#F4A261" fill="#F4A261" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-navy-800/50 rounded-2xl p-6 border border-navy-700">
            <p className="text-gray-400 text-sm mb-2">事件统计</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventTypeData} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} width={60} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#f8fafc' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {eventTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-navy-800/50 rounded-2xl p-6 border border-navy-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium flex items-center gap-2">
              <Trophy className="w-5 h-5 text-vip" />
              时间轴回放
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {formatTime(currentTime)} / {formatTime(session.duration)}
              </span>
            </div>
          </div>

          <div className="relative h-12 mb-4">
            <div className="absolute inset-0 bg-navy-700 rounded-lg overflow-hidden">
              {session.events.map((event) => (
                <div
                  key={event.id}
                  className="absolute top-0 bottom-0 w-0.5 cursor-pointer hover:opacity-100 transition-opacity"
                  style={{
                    left: `${(event.timestamp / session.duration) * 100}%`,
                    backgroundColor: event.scoreChange < 0 ? '#E63946' : event.scoreChange > 0 ? '#2A9D8F' : '#64748b',
                    opacity: event.timestamp <= currentTime ? 1 : 0.3
                  }}
                  onClick={() => {
                    setCurrentTime(event.timestamp);
                    setSelectedEvent(event);
                  }}
                  title={`${formatTime(event.timestamp)} - ${event.description}`}
                />
              ))}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white z-10 rounded"
                style={{ left: `${(currentTime / session.duration) * 100}%` }}
              />
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={session.duration}
            value={currentTime}
            onChange={(e) => setCurrentTime(Number(e.target.value))}
            className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer mb-4"
          />

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentTime(0)}
              className="p-2 hover:bg-navy-700 rounded-lg transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-3 bg-vip hover:bg-vip/80 rounded-full transition-colors"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button
              onClick={() => setCurrentTime(session.duration)}
              className="p-2 hover:bg-navy-700 rounded-lg transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm text-gray-400">速度:</span>
              {[0.5, 1, 2].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    playbackSpeed === speed ? 'bg-vip text-white' : 'bg-navy-700 hover:bg-navy-600'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-navy-800/50 rounded-2xl border border-navy-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-700">
              <h3 className="font-medium">实时事件流</h3>
            </div>
            <div className="h-64 overflow-y-auto scrollbar-thin p-4 space-y-2">
              {visibleEvents.length === 0 ? (
                <p className="text-center text-gray-500 py-8">拖动时间轴查看事件</p>
              ) : (
                visibleEvents.map(event => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all ${getEventColor(event)} 
                      ${selectedEvent?.id === event.id ? 'ring-2 ring-vip' : ''}`}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-sm">{event.description}</p>
                      {event.scoreChange !== 0 && (
                        <span className={`text-sm font-bold mono-font ${
                          event.scoreChange > 0 ? 'text-success' : 'text-warning'
                        }`}>
                          {event.scoreChange > 0 ? '+' : ''}{event.scoreChange}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatTime(event.timestamp)} • {event.channel === 'vip' ? 'VIP' : '普通'}通道
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-navy-800/50 rounded-2xl border border-navy-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-700">
              <h3 className="font-medium">事件详情</h3>
            </div>
            <div className="p-4">
              {selectedEvent ? (
                <div>
                  <div className="mb-4">
                    <p className="text-lg font-medium">{selectedEvent.description}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {formatTime(selectedEvent.timestamp)} 发生
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-navy-700/50 rounded-lg p-3">
                      <p className="text-gray-400">事件类型</p>
                      <p className="font-medium mt-1">
                        {selectedEvent.type === 'pass' ? '放行' :
                         selectedEvent.type === 'block' ? '拦截' :
                         selectedEvent.type === 'warning' ? '警告' :
                         selectedEvent.type === 'scan' ? '扫描' : '调度'}
                      </p>
                    </div>
                    <div className="bg-navy-700/50 rounded-lg p-3">
                      <p className="text-gray-400">分值变化</p>
                      <p className={`font-medium mt-1 ${
                        selectedEvent.scoreChange > 0 ? 'text-success' :
                        selectedEvent.scoreChange < 0 ? 'text-warning' : ''
                      }`}>
                        {selectedEvent.scoreChange > 0 ? '+' : ''}{selectedEvent.scoreChange}
                      </p>
                    </div>
                    <div className="bg-navy-700/50 rounded-lg p-3">
                      <p className="text-gray-400">通道</p>
                      <p className="font-medium mt-1">
                        {selectedEvent.channel === 'vip' ? 'VIP通道' : '普通通道'}
                      </p>
                    </div>
                    <div className="bg-navy-700/50 rounded-lg p-3">
                      <p className="text-gray-400">需要核对</p>
                      <p className={`font-medium mt-1 ${selectedEvent.needReview ? 'text-vip' : ''}`}>
                        {selectedEvent.needReview ? '是' : '否'}
                      </p>
                    </div>
                  </div>
                  {selectedEvent.reviewNote && (
                    <div className="mt-4 bg-navy-700/50 rounded-lg p-3">
                      <p className="text-gray-400 text-sm">核对备注</p>
                      <p className="mt-1">{selectedEvent.reviewNote}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-12">点击左侧事件查看详情</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReplayPage;

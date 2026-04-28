import { useState, useEffect, useCallback } from 'react';
import { 
  Heart, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Shuffle,
  ChevronRight,
  Music2,
  Headphones,
  Sparkles,
  Waves,
  Trees,
  Wind,
  Droplets,
  Sliders,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mockMusics, mockPlaylists, mockWhiteNoises, emotionMap } from '../data/mockData';
import { Music, EmotionType, WhiteNoise } from '../types';
import { startNoise, stopNoise, stopAllNoises } from '../utils/audioUtils';

type TabType = 'emotion' | 'white-noise' | 'favorites';

export default function MusicTherapyPage() {
  const { state, toggleMusicFavorite, togglePlaylistFavorite, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('emotion');
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionType | null>(null);
  const [currentMusic, setCurrentMusic] = useState<Music | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedWhiteNoises, setSelectedWhiteNoises] = useState<string[]>([]);
  const [showEmotionMatch, setShowEmotionMatch] = useState(false);
  const [showPlaylistDetail, setShowPlaylistDetail] = useState<string | null>(null);
  const [noiseVolumes, setNoiseVolumes] = useState<Record<string, number>>({});

  const getMusicByEmotion = (emotionType: EmotionType) => {
    return mockMusics.filter(m => m.emotionType === emotionType);
  };

  const favoriteMusics = mockMusics.filter(m => state.favoriteMusicIds.includes(m.id));
  const favoritePlaylists = mockPlaylists.filter(p => state.favoritePlaylistIds.includes(p.id));

  const togglePlay = useCallback((music: Music) => {
    if (currentMusic?.id === music.id) {
      setIsPlaying(!isPlaying);
      dispatch({ type: 'TOGGLE_PLAYING' });
    } else {
      setCurrentMusic(music);
      setIsPlaying(true);
      dispatch({ type: 'SET_CURRENT_MUSIC', payload: music });
      dispatch({ type: 'TOGGLE_PLAYING' });
    }
  }, [currentMusic, isPlaying, dispatch]);

  const toggleWhiteNoise = useCallback((noise: WhiteNoise) => {
    const isSelected = selectedWhiteNoises.includes(noise.id);
    
    if (isSelected) {
      stopNoise(noise.id);
      setSelectedWhiteNoises(prev => prev.filter(id => id !== noise.id));
    } else {
      const volume = noiseVolumes[noise.id] ?? 0.3;
      startNoise(noise.id, noise.category, volume);
      setSelectedWhiteNoises(prev => [...prev, noise.id]);
    }
  }, [selectedWhiteNoises, noiseVolumes]);

  const updateNoiseVolume = useCallback((noiseId: string, volume: number) => {
    setNoiseVolumes(prev => ({ ...prev, [noiseId]: volume }));
  }, []);

  const [matchStep, setMatchStep] = useState(0);
  const [matchAnswers, setMatchAnswers] = useState<number[]>([]);
  
  const matchQuestions = [
    {
      question: '你现在感觉如何？',
      options: ['很平静', '有点紧张', '非常烦躁', '感到疲惫']
    },
    {
      question: '你的睡眠质量如何？',
      options: ['很好', '一般', '难以入睡', '经常失眠']
    },
    {
      question: '你希望音乐带给你什么？',
      options: ['放松心情', '提高活力', '帮助睡眠', '缓解焦虑']
    }
  ];

  const handleMatchAnswer = (answerIndex: number) => {
    const newAnswers = [...matchAnswers, answerIndex];
    setMatchAnswers(newAnswers);
    
    if (matchStep < matchQuestions.length - 1) {
      setMatchStep(matchStep + 1);
    } else {
      let recommendedEmotion: EmotionType = 'anxiety';
      const totalScore = newAnswers.reduce((a, b) => a + b, 0);
      
      if (totalScore <= 2) {
        recommendedEmotion = 'fatigue';
      } else if (totalScore <= 4) {
        recommendedEmotion = 'anxiety';
      } else if (totalScore <= 6) {
        recommendedEmotion = 'insomnia';
      } else {
        recommendedEmotion = 'irritability';
      }
      
      setSelectedEmotion(recommendedEmotion);
      setShowEmotionMatch(false);
      setMatchStep(0);
      setMatchAnswers([]);
    }
  };

  useEffect(() => {
    return () => {
      stopAllNoises();
    };
  }, []);

  const getNoiseIcon = (category: string) => {
    switch (category) {
      case 'rain': return <Droplets size={32} />;
      case 'forest': return <Trees size={32} />;
      case 'wind': return <Wind size={32} />;
      case 'stream': return <Waves size={32} />;
      default: return <Volume2 size={32} />;
    }
  };

  const getNoiseGradient = (category: string) => {
    switch (category) {
      case 'rain': return 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)';
      case 'forest': return 'linear-gradient(135deg, #10B981 0%, #34D399 100%)';
      case 'wind': return 'linear-gradient(135deg, #06B6D4 0%, #22D3EE 100%)';
      case 'stream': return 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)';
      default: return 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)';
    }
  };

  const selectedPlaylist = showPlaylistDetail 
    ? mockPlaylists.find(p => p.id === showPlaylistDetail) 
    : null;
  
  const playlistMusics = selectedPlaylist 
    ? mockMusics.filter(m => selectedPlaylist.musicIds.includes(m.id))
    : [];

  return (
    <div className="fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">音乐疗愈</h1>
        <p className="text-gray-500 text-sm">让声音治愈你的心灵</p>
      </div>
      
      <div 
        className="relative overflow-hidden rounded-2xl mb-6 cursor-pointer hover:shadow-xl transition-all duration-300"
        onClick={() => setShowEmotionMatch(true)}
        style={{
          background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #8B5CF6 100%)'
        }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-4 -translate-x-4" />
        <div className="p-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Shuffle size={28} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                情绪一键匹配
                <Sparkles size={16} className="text-yellow-200" />
              </h3>
              <p className="text-white/80 text-sm mt-1">回答几个问题，AI为你推荐最适合的音乐</p>
            </div>
            <ChevronRight size={24} className="text-white/70" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
        {[
          { key: 'emotion' as TabType, label: '情绪歌单', icon: <Music2 size={16} /> },
          { key: 'white-noise' as TabType, label: '白噪音', icon: <Waves size={16} /> },
          { key: 'favorites' as TabType, label: '收藏', icon: <Heart size={16} /> }
        ].map(tab => (
          <button
            key={tab.key}
            className={`flex-1 py-2.5 px-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-1.5 ${
              activeTab === tab.key
                ? 'bg-white text-amber-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'emotion' && !showPlaylistDetail && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">选择你的情绪</h3>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {(Object.entries(emotionMap) as [EmotionType, typeof emotionMap[EmotionType]][]).map(([key, value]) => (
              <button
                key={key}
                className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-300 ${
                  selectedEmotion === key
                    ? 'bg-amber-50 ring-2 ring-amber-400 shadow-sm'
                    : 'bg-white hover:bg-gray-50 border border-gray-100'
                }`}
                onClick={() => setSelectedEmotion(selectedEmotion === key ? null : key)}
              >
                <span className="text-2xl mb-1.5">{value.icon}</span>
                <span className={`text-xs font-medium ${
                  selectedEmotion === key ? 'text-amber-600' : 'text-gray-600'
                }`}>{value.name}</span>
              </button>
            ))}
          </div>

          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            {selectedEmotion ? `${emotionMap[selectedEmotion].name}歌单` : '推荐歌单'}
          </h3>
          <div className="space-y-4 mb-6">
            {(selectedEmotion 
              ? mockPlaylists.filter(p => p.emotionType === selectedEmotion)
              : mockPlaylists
            ).map(playlist => (
              <div 
                key={playlist.id} 
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 cursor-pointer"
                onClick={() => setShowPlaylistDetail(playlist.id)}
              >
                <div className="flex gap-4 p-4">
                  <div className="relative flex-shrink-0">
                    <div 
                      className="w-24 h-24 rounded-xl overflow-hidden shadow-sm"
                      style={{
                        background: 'linear-gradient(135deg, #F5F5F4 0%, #E7E5E4 100%)'
                      }}
                    >
                      <img
                        src={playlist.coverImage}
                        alt={playlist.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl opacity-0 hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                        <Play size={20} className="text-amber-500 ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-gray-800 truncate">{playlist.name}</h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlaylistFavorite(playlist.id);
                        }}
                        className="p-1.5 flex-shrink-0"
                      >
                        <Heart
                          size={20}
                          className={state.favoritePlaylistIds.includes(playlist.id) ? 'text-red-500 fill-red-500' : 'text-gray-300'}
                        />
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{playlist.description}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex items-center gap-1">
                        <Music2 size={12} className="text-gray-400" />
                        <span className="text-xs text-gray-400">{playlist.musicIds.length} 首歌</span>
                      </div>
                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                      <span className="tag-primary text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                        {emotionMap[playlist.emotionType].name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold text-gray-800 mb-3">音乐列表</h3>
          <div className="space-y-2">
            {(selectedEmotion
              ? getMusicByEmotion(selectedEmotion)
              : mockMusics
            ).map(music => (
              <div 
                key={music.id} 
                className={`bg-white rounded-xl p-3 flex items-center gap-3 transition-all duration-200 ${
                  currentMusic?.id === music.id 
                    ? 'ring-2 ring-amber-400 bg-amber-50/50' 
                    : 'hover:bg-gray-50 border border-gray-100'
                }`}
              >
                <div className="relative">
                  <div 
                    className={`w-12 h-12 rounded-lg overflow-hidden ${
                      currentMusic?.id === music.id && isPlaying ? 'animate-pulse' : ''
                    }`}
                    style={{
                      background: 'linear-gradient(135deg, #FAFAF9 0%, #F5F5F4 100%)'
                    }}
                  >
                    <img
                      src={music.coverImage}
                      alt={music.title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {currentMusic?.id === music.id && isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                      <div className="flex gap-0.5">
                        <div className="w-1 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-sm truncate ${
                    currentMusic?.id === music.id ? 'text-amber-600' : 'text-gray-800'
                  }`}>{music.title}</h4>
                  <p className="text-xs text-gray-400 truncate">{music.artist}</p>
                </div>
                <button
                  onClick={() => togglePlay(music)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    currentMusic?.id === music.id && isPlaying
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-600'
                  }`}
                >
                  {currentMusic?.id === music.id && isPlaying ? (
                    <Pause size={18} />
                  ) : (
                    <Play size={18} className="ml-0.5" />
                  )}
                </button>
                <button
                  onClick={() => toggleMusicFavorite(music.id)}
                  className="p-2"
                >
                  <Heart
                    size={16}
                    className={state.favoriteMusicIds.includes(music.id) ? 'text-red-500 fill-red-500' : 'text-gray-300'}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'emotion' && showPlaylistDetail && selectedPlaylist && (
        <div>
          <button 
            onClick={() => setShowPlaylistDetail(null)}
            className="flex items-center gap-1 text-gray-500 mb-4 hover:text-gray-700"
          >
            <ChevronRight size={16} className="rotate-180" />
            <span className="text-sm">返回</span>
          </button>

          <div className="relative overflow-hidden rounded-2xl mb-6" style={{
            background: `linear-gradient(135deg, ${emotionMap[selectedPlaylist.emotionType].color} 0%, ${emotionMap[selectedPlaylist.emotionType].color}99 100%)`
          }}>
            <div className="p-6">
              <div className="flex gap-4">
                <div 
                  className="w-32 h-32 rounded-2xl overflow-hidden shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 100%)'
                  }}
                >
                  <img
                    src={selectedPlaylist.coverImage}
                    alt={selectedPlaylist.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-xs text-white/70 mb-1 block">歌单</span>
                    <h2 className="text-xl font-bold text-white mb-2">{selectedPlaylist.name}</h2>
                    <p className="text-sm text-white/80">{selectedPlaylist.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => togglePlaylistFavorite(selectedPlaylist.id)}
                      className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-white text-sm flex items-center gap-1.5"
                    >
                      <Heart 
                        size={16} 
                        className={state.favoritePlaylistIds.includes(selectedPlaylist.id) ? 'fill-white' : ''}
                      />
                      收藏
                    </button>
                    <button
                      onClick={() => {
                        const firstMusic = playlistMusics[0];
                        if (firstMusic) togglePlay(firstMusic);
                      }}
                      className="flex-1 bg-white text-amber-600 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
                    >
                      <Play size={16} />
                      全部播放
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-800 mb-3">歌单内容</h3>
          <div className="space-y-2">
            {playlistMusics.map((music, index) => (
              <div 
                key={music.id} 
                className={`bg-white rounded-xl p-3 flex items-center gap-3 transition-all ${
                  currentMusic?.id === music.id 
                    ? 'ring-2 ring-amber-400 bg-amber-50/50' 
                    : 'hover:bg-gray-50 border border-gray-100'
                }`}
              >
                <span className={`w-6 text-center text-sm ${
                  currentMusic?.id === music.id ? 'text-amber-600 font-medium' : 'text-gray-400'
                }`}>
                  {index + 1}
                </span>
                <div 
                  className="w-12 h-12 rounded-lg overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #FAFAF9 0%, #F5F5F4 100%)'
                  }}
                >
                  <img
                    src={music.coverImage}
                    alt={music.title}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-sm truncate ${
                    currentMusic?.id === music.id ? 'text-amber-600' : 'text-gray-800'
                  }`}>{music.title}</h4>
                  <p className="text-xs text-gray-400 truncate">{music.artist}</p>
                </div>
                <button
                  onClick={() => togglePlay(music)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    currentMusic?.id === music.id && isPlaying
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-amber-100'
                  }`}
                >
                  {currentMusic?.id === music.id && isPlaying ? (
                    <Pause size={18} />
                  ) : (
                    <Play size={18} className="ml-0.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'white-noise' && (
        <div>
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-4 mb-6 border border-cyan-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
                <Headphones size={20} className="text-cyan-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">白噪音混合</h3>
                <p className="text-sm text-gray-600">
                  可以同时选择多种白噪音，创造最适合你的放松环境
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            {mockWhiteNoises.map(noise => {
              const isActive = selectedWhiteNoises.includes(noise.id);
              const volume = noiseVolumes[noise.id] ?? 0.3;
              
              return (
                <div
                  key={noise.id}
                  className={`relative overflow-hidden rounded-2xl transition-all duration-300 cursor-pointer ${
                    isActive ? 'shadow-lg scale-[1.02]' : 'shadow-sm hover:shadow-md'
                  }`}
                  onClick={() => toggleWhiteNoise(noise)}
                >
                  <div 
                    className="p-5"
                    style={{
                      background: isActive 
                        ? getNoiseGradient(noise.category)
                        : 'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)'
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isActive ? 'bg-white/20' : 'bg-white'
                      }`}>
                        <div className={isActive ? 'text-white' : 'text-gray-500'}>
                          {getNoiseIcon(noise.category)}
                        </div>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isActive ? 'bg-white/30' : 'bg-gray-100'
                      }`}>
                        {isActive ? (
                          <div className="flex gap-0.5">
                            <div className={`w-1 h-4 rounded-full animate-bounce ${isActive ? 'bg-white' : 'bg-gray-400'}`} style={{ animationDelay: '0ms' }} />
                            <div className={`w-1 h-4 rounded-full animate-bounce ${isActive ? 'bg-white' : 'bg-gray-400'}`} style={{ animationDelay: '150ms' }} />
                            <div className={`w-1 h-4 rounded-full animate-bounce ${isActive ? 'bg-white' : 'bg-gray-400'}`} style={{ animationDelay: '300ms' }} />
                          </div>
                        ) : (
                          <Play size={14} className={isActive ? 'text-white' : 'text-gray-400'} />
                        )}
                      </div>
                    </div>
                    <h4 className={`font-semibold ${isActive ? 'text-white' : 'text-gray-800'}`}>
                      {noise.name}
                    </h4>
                    <p className={`text-sm mt-1 ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                      {isActive ? '播放中' : '点击播放'}
                    </p>
                    
                    {isActive && (
                      <div 
                        className="mt-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <Volume2 size={14} className="text-white/60" />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={(e) => updateNoiseVolume(noise.id, parseFloat(e.target.value))}
                            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) ${volume * 100}%, rgba(255,255,255,0.3) ${volume * 100}%, rgba(255,255,255,0.3) 100%)`
                            }}
                          />
                          <span className="text-xs text-white/60 w-8 text-right">
                            {Math.round(volume * 100)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Sliders size={18} className="text-cyan-500" />
              白噪音搭配建议
            </h4>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-xl">
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-blue-600">🌧️ 雨声 + 🌬️ 晚风</span>
                  <span className="text-gray-500 ml-2">— 创造雨天夜晚的氛围，特别适合失眠人群</span>
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-green-600">🌲 森林 + 🌊 溪流</span>
                  <span className="text-gray-500 ml-2">— 大自然的声音，帮助放松身心，减轻压力</span>
                </p>
              </div>
              <div className="p-3 bg-cyan-50 rounded-xl">
                <p className="text-sm text-gray-700">
                  <span className="font-medium text-cyan-600">🌬️ 晚风 + 🌊 溪流</span>
                  <span className="text-gray-500 ml-2">— 舒缓神经，适合冥想和专注</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'favorites' && (
        <div>
          {favoriteMusics.length === 0 && favoritePlaylists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Heart size={40} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">还没有收藏</h3>
              <p className="text-gray-400 text-center text-sm max-w-xs">
                点击音乐或歌单旁的爱心图标，将它们加入收藏
              </p>
            </div>
          ) : (
            <>
              {favoritePlaylists.length > 0 && (
                <>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">收藏的歌单</h3>
                  <div className="space-y-3 mb-6">
                    {favoritePlaylists.map(playlist => (
                      <div 
                        key={playlist.id} 
                        className="bg-white rounded-2xl p-4 flex gap-4 border border-gray-100 hover:shadow-md transition-all"
                        onClick={() => setShowPlaylistDetail(playlist.id)}
                      >
                        <div 
                          className="w-16 h-16 rounded-xl overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, #F5F5F4 0%, #E7E5E4 100%)'
                          }}
                        >
                          <img
                            src={playlist.coverImage}
                            alt={playlist.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <h4 className="font-semibold text-gray-800">{playlist.name}</h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePlaylistFavorite(playlist.id);
                              }}
                              className="p-1"
                            >
                              <Heart size={18} className="text-red-500 fill-red-500" />
                            </button>
                          </div>
                          <p className="text-sm text-gray-500 mt-1 truncate">{playlist.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {favoriteMusics.length > 0 && (
                <>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">收藏的音乐</h3>
                  <div className="space-y-2">
                    {favoriteMusics.map(music => (
                      <div 
                        key={music.id} 
                        className={`bg-white rounded-xl p-3 flex items-center gap-3 border border-gray-100 ${
                          currentMusic?.id === music.id ? 'ring-2 ring-amber-400' : ''
                        }`}
                      >
                        <div 
                          className="w-12 h-12 rounded-lg overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, #FAFAF9 0%, #F5F5F4 100%)'
                          }}
                        >
                          <img
                            src={music.coverImage}
                            alt={music.title}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-medium text-sm ${
                            currentMusic?.id === music.id ? 'text-amber-600' : 'text-gray-800'
                          }`}>{music.title}</h4>
                          <p className="text-xs text-gray-400">{music.artist}</p>
                        </div>
                        <button
                          onClick={() => togglePlay(music)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            currentMusic?.id === music.id && isPlaying
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {currentMusic?.id === music.id && isPlaying ? (
                            <Pause size={18} />
                          ) : (
                            <Play size={18} className="ml-0.5" />
                          )}
                        </button>
                        <button
                          onClick={() => toggleMusicFavorite(music.id)}
                          className="p-2"
                        >
                          <Heart size={16} className="text-red-500 fill-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {currentMusic && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 w-full max-w-[440px] px-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3">
            <div className="flex items-center gap-3">
              <div 
                className={`relative w-12 h-12 rounded-xl overflow-hidden ${isPlaying ? 'animate-pulse' : ''}`}
                style={{
                  background: 'linear-gradient(135deg, #FAFAF9 0%, #F5F5F4 100%)'
                }}
              >
                <img
                  src={currentMusic.coverImage}
                  alt={currentMusic.title}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-gray-800 truncate">{currentMusic.title}</h4>
                <p className="text-xs text-gray-400 truncate">{currentMusic.artist}</p>
              </div>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <button
                onClick={() => {
                  setIsPlaying(!isPlaying);
                  dispatch({ type: 'TOGGLE_PLAYING' });
                }}
                className="w-11 h-11 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
            </div>
            
            <div className="mt-2">
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                  style={{ width: isPlaying ? '60%' : '0%' }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1:23</span>
                <span>{Math.floor(currentMusic.duration / 60)}:{(currentMusic.duration % 60).toString().padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmotionMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div 
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">情绪匹配</h3>
              <button 
                onClick={() => setShowEmotionMatch(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            
            <div className="flex gap-2 mb-8">
              {matchQuestions.map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                    i <= matchStep ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            <p className="text-gray-600 mb-6 text-center text-lg">
              {matchQuestions[matchStep].question}
            </p>

            <div className="space-y-3">
              {matchQuestions[matchStep].options.map((option, index) => (
                <button
                  key={index}
                  className="w-full p-4 text-left rounded-2xl border-2 border-gray-100 hover:border-amber-400 hover:bg-amber-50 transition-all duration-200"
                  onClick={() => handleMatchAnswer(index)}
                >
                  <span className="text-gray-700">{option}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

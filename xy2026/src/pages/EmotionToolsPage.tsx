import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ClipboardList,
  PenTool,
  MessageSquare,
  ChevronRight,
  Heart,
  Smile,
  Frown,
  Meh,
  Trash2,
  Edit3
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { emotionMap, mockTests } from '../data/mockData';
import { EmotionType, EmotionCheckin } from '../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type TabType = 'checkin' | 'chart' | 'test' | 'diary';

export default function EmotionToolsPage() {
  const navigate = useNavigate();
  const { state, addCheckin, addDiary, deleteDiary } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('checkin');
  
  // 情绪打卡状态
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionType | null>(null);
  const [emotionIntensity, setEmotionIntensity] = useState(5);
  const [emotionNote, setEmotionNote] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  
  // 日记状态
  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryContent, setDiaryContent] = useState('');
  const [diaryEmotion, setDiaryEmotion] = useState<EmotionType>('anxiety');
  const [showDiaryForm, setShowDiaryForm] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];
  const todayCheckin = state.checkins.find(c => c.date === today);

  // 提交情绪打卡
  const handleCheckinSubmit = () => {
    if (!selectedEmotion) return;
    
    addCheckin({
      date: today,
      emotionType: selectedEmotion,
      intensity: emotionIntensity,
      note: emotionNote
    });
    
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setSelectedEmotion(null);
      setEmotionIntensity(5);
      setEmotionNote('');
    }, 2000);
  };

  // 提交日记
  const handleDiarySubmit = () => {
    if (!diaryTitle || !diaryContent) return;
    
    addDiary({
      title: diaryTitle,
      content: diaryContent,
      emotionType: diaryEmotion,
      tags: [],
      isPrivate: false
    });
    
    setDiaryTitle('');
    setDiaryContent('');
    setShowDiaryForm(false);
  };

  // 获取近7天的情绪数据
  const getLast7DaysData = () => {
    const labels: string[] = [];
    const data: number[] = [];
    const emotionTypes: (EmotionType | null)[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      labels.push(`${date.getMonth() + 1}/${date.getDate()}`);
      
      const checkin = state.checkins.find(c => c.date === dateStr);
      if (checkin) {
        data.push(checkin.intensity);
        emotionTypes.push(checkin.emotionType);
      } else {
        data.push(0);
        emotionTypes.push(null);
      }
    }
    
    return { labels, data, emotionTypes };
  };

  const chartData = getLast7DaysData();

  // 图表配置
  const chartConfig = {
    labels: chartData.labels,
    datasets: [
      {
        label: '情绪强度',
        data: chartData.data,
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#F59E0B',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14
        },
        bodyFont: {
          size: 13
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 10,
        ticks: {
          stepSize: 2
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div className="fade-in">
      <h1 className="page-title">情绪心理工具 💭</h1>

      {/* 选项卡 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: 'checkin' as TabType, label: '情绪打卡', icon: <Calendar size={18} /> },
          { key: 'chart' as TabType, label: '情绪曲线', icon: <ClipboardList size={18} /> },
          { key: 'test' as TabType, label: '心理测试', icon: <PenTool size={18} /> },
          { key: 'diary' as TabType, label: '心情日记', icon: <MessageSquare size={18} /> }
        ].map(tab => (
          <button
            key={tab.key}
            className={`flex items-center gap-2 py-3 px-4 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 情绪打卡 Tab */}
      {activeTab === 'checkin' && (
        <div>
          {todayCheckin ? (
            <div className="card">
              <h3 className="section-title mb-4">今日已打卡 ✨</h3>
              <div className="text-center py-8">
                <div className="text-6xl mb-4">{emotionMap[todayCheckin.emotionType].icon}</div>
                <h4 className="text-xl font-semibold mb-2">
                  {emotionMap[todayCheckin.emotionType].name}
                </h4>
                <p className="text-gray-500 mb-4">
                  情绪强度：{todayCheckin.intensity}/10
                </p>
                {todayCheckin.note && (
                  <div className="bg-gray-50 rounded-lg p-4 mt-4">
                    <p className="text-gray-600 italic">"{todayCheckin.note}"</p>
                  </div>
                )}
              </div>
            </div>
          ) : showSuccess ? (
            <div className="card">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-semibold text-green-600">打卡成功！</h3>
                <p className="text-gray-500 mt-2">今天的情绪已记录</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 选择情绪 */}
              <div className="card">
                <h3 className="section-title mb-4">你现在感觉如何？</h3>
                <div className="grid grid-cols-5 gap-3">
                  {(Object.entries(emotionMap) as [EmotionType, typeof emotionMap[EmotionType]][]).map(([key, value]) => (
                    <button
                      key={key}
                      className={`flex flex-col items-center p-4 rounded-xl transition-all ${
                        selectedEmotion === key
                          ? 'bg-amber-100 ring-2 ring-amber-500 scale-105'
                          : 'bg-white hover:bg-gray-50 border border-gray-200'
                      }`}
                      onClick={() => setSelectedEmotion(key)}
                    >
                      <span className="text-3xl mb-2">{value.icon}</span>
                      <span className="text-sm font-medium">{value.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 情绪强度 */}
              {selectedEmotion && (
                <div className="card">
                  <h3 className="section-title mb-4">情绪强度</h3>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-500 mb-2">
                      <span>轻微</span>
                      <span className="font-semibold text-lg">{emotionIntensity}/10</span>
                      <span>强烈</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={emotionIntensity}
                      onChange={(e) => setEmotionIntensity(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* 备注 */}
              {selectedEmotion && (
                <div className="card">
                  <h3 className="section-title mb-4">想说点什么？（可选）</h3>
                  <textarea
                    value={emotionNote}
                    onChange={(e) => setEmotionNote(e.target.value)}
                    placeholder="记录此刻的心情..."
                    className="w-full h-32 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* 提交按钮 */}
              {selectedEmotion && (
                <button
                  onClick={handleCheckinSubmit}
                  className="w-full btn btn-primary py-4 text-lg"
                >
                  完成打卡 ✨
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 情绪曲线 Tab */}
      {activeTab === 'chart' && (
        <div>
          <div className="card">
            <h3 className="section-title mb-4">近7天情绪曲线</h3>
            <div className="h-64">
              <Line data={chartConfig} options={chartOptions} />
            </div>
          </div>

          {/* 情绪统计 */}
          <div className="card mt-6">
            <h3 className="section-title mb-4">情绪统计</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-amber-500">{state.checkins.length}</p>
                <p className="text-sm text-gray-500 mt-1">总打卡次数</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-500">
                  {state.checkins.length > 0 
                    ? (state.checkins.reduce((acc, c) => acc + c.intensity, 0) / state.checkins.length).toFixed(1)
                    : '0'
                  }
                </p>
                <p className="text-sm text-gray-500 mt-1">平均情绪强度</p>
              </div>
            </div>
          </div>

          {/* 打卡历史 */}
          {state.checkins.length > 0 && (
            <div className="card mt-6">
              <h3 className="section-title mb-4">打卡历史</h3>
              <div className="space-y-3">
                {[...state.checkins].reverse().slice(0, 10).map(checkin => (
                  <div key={checkin.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <span className="text-2xl">{emotionMap[checkin.emotionType].icon}</span>
                    <div className="flex-1">
                      <p className="font-medium">{emotionMap[checkin.emotionType].name}</p>
                      <p className="text-xs text-gray-500">{checkin.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-500">{checkin.intensity}/10</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 心理测试 Tab */}
      {activeTab === 'test' && (
        <div>
          <h3 className="section-title mb-4">心理自测量表</h3>
          <p className="text-gray-500 text-sm mb-6">
            这些量表仅供自我参考，不能替代专业诊断。如有需要，请寻求专业帮助。
          </p>
          
          <div className="space-y-4">
            {mockTests.map(test => (
              <div
                key={test.id}
                className="card cursor-pointer hover:shadow-lg transition-all"
                onClick={() => navigate(`/test/${test.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white"
                    style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
                  >
                    <ClipboardList size={28} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{test.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{test.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="tag tag-secondary">{test.questions.length} 题</span>
                      <span className="tag tag-secondary">约 3 分钟</span>
                    </div>
                  </div>
                  <ChevronRight size={24} className="text-gray-400" />
                </div>
              </div>
            ))}
          </div>

          {/* 测试历史 */}
          {state.testResults.length > 0 && (
            <div className="card mt-6">
              <h3 className="section-title mb-4">测试历史</h3>
              <div className="space-y-3">
                {state.testResults.map(result => (
                  <div key={result.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{mockTests.find(t => t.id === result.testId)?.title || '心理测试'}</h4>
                      <span className={`tag ${
                        result.level === 'mild' ? 'tag-primary' :
                        result.level === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {result.level === 'mild' ? '轻度' :
                         result.level === 'moderate' ? '中度' : '较重'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      总分：{result.totalScore} · {new Date(result.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 心情日记 Tab */}
      {activeTab === 'diary' && (
        <div>
          {/* 写日记按钮 */}
          <button
            onClick={() => setShowDiaryForm(true)}
            className="w-full btn btn-primary mb-6 py-4"
          >
            ✏️ 写日记
          </button>

          {/* 日记列表 */}
          {state.diaries.length === 0 ? (
            <div className="empty-state">
              <MessageSquare size={64} className="text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">还没有日记</h3>
              <p className="text-gray-500 text-center">
                写下你的心情，记录生活中的点点滴滴
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...state.diaries].reverse().map(diary => (
                <div key={diary.id} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{emotionMap[diary.emotionType].icon}</span>
                      <div>
                        <h4 className="font-semibold text-gray-800">{diary.title}</h4>
                        <p className="text-xs text-gray-500">
                          {new Date(diary.createdAt).toLocaleDateString()} · {emotionMap[diary.emotionType].name}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteDiary(diary.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-3">
                    {diary.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 写日记模态框 */}
      {showDiaryForm && (
        <div className="modal-overlay" onClick={() => setShowDiaryForm(false)}>
          <div 
            className="modal-content fade-in max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-6 text-center">写日记 ✏️</h3>
            
            {/* 标题 */}
            <div className="form-group">
              <label className="form-label">标题</label>
              <input
                type="text"
                value={diaryTitle}
                onChange={(e) => setDiaryTitle(e.target.value)}
                placeholder="给今天起个标题..."
                className="input"
              />
            </div>

            {/* 情绪选择 */}
            <div className="form-group">
              <label className="form-label">今天的心情</label>
              <div className="flex gap-2">
                {(Object.entries(emotionMap) as [EmotionType, typeof emotionMap[EmotionType]][]).map(([key, value]) => (
                  <button
                    key={key}
                    className={`flex-1 py-3 rounded-lg transition-all ${
                      diaryEmotion === key
                        ? 'bg-amber-100 ring-2 ring-amber-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => setDiaryEmotion(key)}
                  >
                    <span className="text-xl">{value.icon}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 内容 */}
            <div className="form-group">
              <label className="form-label">内容</label>
              <textarea
                value={diaryContent}
                onChange={(e) => setDiaryContent(e.target.value)}
                placeholder="写下你想说的话..."
                className="input h-48 resize-none"
              />
            </div>

            {/* 按钮 */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDiaryForm(false)}
                className="flex-1 btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleDiarySubmit}
                disabled={!diaryTitle || !diaryContent}
                className="flex-1 btn btn-primary"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

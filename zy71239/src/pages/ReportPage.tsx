import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Home, FileText, Edit2, Check } from 'lucide-react';
import { getSession, updateSessionReview } from '../utils/storage';
import { GameSession, GameEvent } from '../game/types';
import { formatTime, exportSessionReport } from '../utils/export';
import { scoringEngine } from '../game/scoringEngine';

const ReportPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<GameSession | null>(null);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [filter, setFilter] = useState<'all' | 'review' | 'passed' | 'blocked'>('all');

  useEffect(() => {
    if (sessionId) {
      refreshSession();
    }
  }, [sessionId]);

  const refreshSession = () => {
    if (sessionId) {
      const data = getSession(sessionId);
      setSession(data);
    }
  };

  const handleExport = () => {
    if (session) {
      exportSessionReport(session);
    }
  };

  const handleSaveReview = (eventId: string) => {
    if (sessionId && updateSessionReview(sessionId, eventId, editNote)) {
      refreshSession();
      setEditingEvent(null);
      setEditNote('');
    }
  };

  const startEdit = (event: GameEvent) => {
    setEditingEvent(event.id);
    setEditNote(event.reviewNote || '');
  };

  const filteredEvents = session?.events.filter(e => {
    switch (filter) {
      case 'review': return e.needReview;
      case 'passed': return e.type === 'pass';
      case 'blocked': return e.type === 'block';
      default: return true;
    }
  }) || [];

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

  const stats = [
    { label: '安检人数', value: session.totalAudience, color: 'text-white' },
    { label: '放行人数', value: session.events.filter(e => e.type === 'pass').length, color: 'text-success' },
    { label: '拦截人数', value: session.events.filter(e => e.type === 'block').length, color: 'text-warning' },
    { label: '违禁品发现', value: session.events.filter(e => e.type === 'block' && e.needReview).length, color: 'text-vip' },
    { label: '违禁品漏检', value: session.events.filter(e => e.type === 'pass' && e.needReview && e.scoreChange < 0).length, color: 'text-warning' },
    { label: '警告次数', value: session.events.filter(e => e.type === 'warning').length, color: 'text-vip' },
  ];

  return (
    <div className="min-h-screen bg-navy-900">
      <header className="h-14 px-4 flex items-center justify-between border-b border-navy-700 bg-navy-800/50 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/replay/${sessionId}`)}
            className="p-2 hover:bg-navy-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-vip" />
            处置报告
          </h1>
          <span className="text-xs bg-navy-700 px-2 py-1 rounded">
            {new Date(session.endTime).toLocaleString('zh-CN')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-success hover:bg-success/80 rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            导出CSV
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
        <div className="grid grid-cols-4 gap-6 mb-6">
          <div className="col-span-1 bg-navy-800/50 rounded-2xl p-6 border border-navy-700 text-center">
            <div className={`text-6xl font-black ${rating.color} mb-2`}>
              {rating.grade}
            </div>
            <div className="text-4xl font-bold">{session.finalScore}</div>
            <p className={`mt-2 ${rating.color}`}>{rating.message}</p>
          </div>
          <div className="col-span-3 bg-navy-800/50 rounded-2xl p-6 border border-navy-700">
            <h3 className="font-medium mb-4">四项评分明细</h3>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">安检准确率</span>
                  <span className="text-success font-bold">{session.scores.accuracy}分</span>
                </div>
                <div className="w-full bg-navy-700 rounded-full h-3">
                  <div className="h-3 rounded-full bg-success" style={{ width: `${session.scores.accuracy}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">通行效率</span>
                  <span className="text-blue-400 font-bold">{session.scores.efficiency}分</span>
                </div>
                <div className="w-full bg-navy-700 rounded-full h-3">
                  <div className="h-3 rounded-full bg-blue-400" style={{ width: `${session.scores.efficiency}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">VIP服务</span>
                  <span className="text-vip font-bold">{session.scores.vipService}分</span>
                </div>
                <div className="w-full bg-navy-700 rounded-full h-3">
                  <div className="h-3 rounded-full bg-vip" style={{ width: `${session.scores.vipService}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">应急处置</span>
                  <span className="text-purple-400 font-bold">{session.scores.emergency}分</span>
                </div>
                <div className="w-full bg-navy-700 rounded-full h-3">
                  <div className="h-3 rounded-full bg-purple-400" style={{ width: `${session.scores.emergency}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-navy-800/50 rounded-2xl p-6 border border-navy-700 mb-6">
          <h3 className="font-medium mb-4">统计汇总</h3>
          <div className="grid grid-cols-6 gap-4">
            {stats.map(stat => (
              <div key={stat.label} className="text-center">
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-navy-800/50 rounded-2xl border border-navy-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-navy-700 flex items-center justify-between">
            <h3 className="font-medium">事件明细 ({filteredEvents.length}条)</h3>
            <div className="flex items-center gap-2">
              {(['all', 'review', 'passed', 'blocked'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    filter === f ? 'bg-vip text-white' : 'bg-navy-700 hover:bg-navy-600'
                  }`}
                >
                  {f === 'all' ? '全部' : f === 'review' ? '待核对' : f === 'passed' ? '已放行' : '已拦截'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">序号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">时间</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">观众</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">通道</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">事件</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">物品</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">分值</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">描述</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">建议核对</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-48">人工核对</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {filteredEvents.map((event, index) => (
                  <tr 
                    key={event.id} 
                    className={`hover:bg-navy-700/30 transition-colors ${
                      event.needReview && !event.reviewed ? 'bg-vip/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">{index + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm mono-font">{formatTime(event.timestamp)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{event.audienceName || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        event.channel === 'vip' ? 'bg-vip/20 text-vip' : 'bg-navy-600'
                      }`}>
                        {event.channel === 'vip' ? 'VIP' : '普通'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        event.type === 'pass' ? 'bg-success/20 text-success' :
                        event.type === 'block' ? 'bg-warning/20 text-warning' :
                        event.type === 'warning' ? 'bg-vip/20 text-vip' : 'bg-navy-600'
                      }`}>
                        {event.type === 'pass' ? '放行' :
                         event.type === 'block' ? '拦截' :
                         event.type === 'warning' ? '警告' :
                         event.type === 'scan' ? '扫描' : '调度'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">{event.itemName || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`font-bold mono-font ${
                        event.scoreChange > 0 ? 'text-success' :
                        event.scoreChange < 0 ? 'text-warning' : 'text-gray-500'
                      }`}>
                        {event.scoreChange === 0 ? '-' : 
                         event.scoreChange > 0 ? `+${event.scoreChange}` : event.scoreChange}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate" title={event.description}>
                      {event.description}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {event.needReview ? (
                        <span className="text-vip font-bold">是</span>
                      ) : (
                        <span className="text-gray-500">否</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingEvent === event.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="flex-1 px-2 py-1 bg-navy-700 border border-navy-600 rounded text-sm w-24"
                            placeholder="输入核对意见..."
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveReview(event.id)}
                            className="p-1 bg-success hover:bg-success/80 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="flex-1 text-sm truncate">
                            {event.reviewNote || <span className="text-gray-600">待填写</span>}
                          </span>
                          {event.needReview && (
                            <button
                              onClick={() => startEdit(event)}
                              className="p-1 hover:bg-navy-600 rounded"
                            >
                              <Edit2 className="w-3 h-3 text-gray-400" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 p-6 border-2 border-dashed border-navy-600 rounded-2xl">
          <h3 className="font-medium mb-4 text-gray-400">讲师签字区</h3>
          <div className="h-20 flex items-end">
            <div className="border-b border-gray-500 w-48 pb-1 text-gray-500 text-sm">
              签字：_______________
            </div>
            <div className="border-b border-gray-500 w-48 pb-1 text-gray-500 text-sm ml-8">
              日期：_______________
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReportPage;

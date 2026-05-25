import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History as HistoryIcon, Download, Trash2, Play, X, Trophy, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { useHistoryStore } from '../store/historyStore';
import type { HistoryRecord } from '../types/game';
import { StarRating } from '../components/StarRating';
import { ReplayPlayer } from '../components/ReplayPlayer';
import { exportToText } from '../utils/export/reportExporter';

const gradeColors: Record<string, string> = {
  S: 'text-yellow-500 bg-yellow-50',
  A: 'text-green-500 bg-green-50',
  B: 'text-blue-500 bg-blue-50',
  C: 'text-orange-500 bg-orange-50',
  F: 'text-red-500 bg-red-50',
};

export const HistoryPage = () => {
  const navigate = useNavigate();
  const { records, loadRecords, deleteRecord, clearAll, exportReport } = useHistoryStore();
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [reportContent, setReportContent] = useState('');
  
  useEffect(() => {
    loadRecords();
  }, [loadRecords]);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };
  
  const getStars = (grade: string) => {
    switch (grade) {
      case 'S': return 5;
      case 'A': return 4;
      case 'B': return 3;
      case 'C': return 2;
      default: return 0;
    }
  };
  
  const handleViewReport = (record: HistoryRecord) => {
    const content = exportToText(record);
    setReportContent(content);
    setSelectedRecord(record);
    setShowReport(true);
  };
  
  const handlePlayRecord = (record: HistoryRecord) => {
    if (!record.operationStack || record.operationStack.length === 0) {
      alert('该记录没有回放数据，请完成新的游戏后再试');
      return;
    }
    setSelectedRecord(record);
    setShowReplay(true);
  };
  
  const handleCloseReplay = () => {
    setShowReplay(false);
    setSelectedRecord(null);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft size={20} />
                <span>返回菜单</span>
              </button>
              
              <div className="h-6 w-px bg-gray-300" />
              
              <div className="flex items-center gap-2">
                <HistoryIcon size={24} className="text-purple-500" />
                <h1 className="text-xl font-bold text-gray-800">历史记录</h1>
              </div>
            </div>
            
            {records.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('确定要清空所有历史记录吗？')) {
                    clearAll();
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
                清空记录
              </button>
            )}
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        {records.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <HistoryIcon size={40} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">暂无历史记录</h3>
            <p className="text-gray-500 mb-6">完成一局游戏后，记录将显示在这里</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              开始游戏
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {records.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${gradeColors[record.grade]}`}>
                        <span className="text-2xl font-bold">{record.grade}</span>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{record.levelName}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {formatDate(record.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {formatTime(record.timeUsed)}
                          </span>
                        </div>
                        <div className="mt-2">
                          <StarRating rating={getStars(record.grade)} size={16} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-800">{record.score}</div>
                      <div className="text-sm text-gray-500">得分</div>
                    </div>
                  </div>
                  
                  {record.settlementResult.fatalViolation && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertTriangle size={16} />
                        <span className="font-medium text-sm">失败原因：</span>
                        <span className="text-sm">{record.settlementResult.fatalViolation.description}</span>
                      </div>
                    </div>
                  )}
                  
                  {record.violations.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">违规记录 ({record.violations.length})</div>
                      <div className="flex flex-wrap gap-2">
                        {record.violations.slice(0, 3).map((v, i) => (
                          <span
                            key={i}
                            className={`text-xs px-2 py-1 rounded ${v.isFatal ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}
                          >
                            {v.description}
                          </span>
                        ))}
                        {record.violations.length > 3 && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                            +{record.violations.length - 3} 更多
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>空间利用率: {(record.settlementResult.spaceUtilization * 100).toFixed(1)}%</span>
                      <span>总重量: {record.settlementResult.totalWeight.toFixed(1)}kg</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePlayRecord(record)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        title="回放"
                      >
                        <Play size={16} />
                        回放
                      </button>
                      <button
                        onClick={() => handleViewReport(record)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Trophy size={16} />
                        查看报告
                      </button>
                      <button
                        onClick={() => exportReport(record.id, 'json')}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Download size={16} />
                        JSON
                      </button>
                      <button
                        onClick={() => exportReport(record.id, 'text')}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Download size={16} />
                        TXT
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('确定要删除这条记录吗？')) {
                            deleteRecord(record.id);
                          }
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {showReport && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">培训报告</h3>
              <button
                onClick={() => setShowReport(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                {reportContent}
              </pre>
            </div>
            
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => exportReport(selectedRecord.id, 'text')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Download size={18} />
                下载报告
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showReplay && selectedRecord && (
        <ReplayPlayer
          record={selectedRecord}
          onClose={handleCloseReplay}
        />
      )}
    </div>
  );
};

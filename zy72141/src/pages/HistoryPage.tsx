import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  History, Calendar, User, Clock, ChevronRight, 
  FileText, Music, AlertTriangle, CheckCircle2,
  Trash2, Eye, Download
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { formatWeekDisplay, formatDateTimeShort } from '@/utils/dateUtils';
import { formatDuration } from '@/utils/stringUtils';
import { WeeklyRecord } from '@/types';

export default function HistoryPage() {
  const navigate = useNavigate();
  const { records, files, tracks, conflicts, annotations, notes, setCurrentRecord, resetState } = useAppStore();
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getRecordStats = (record: WeeklyRecord) => {
    const recordFiles = files.filter(f => f.recordId === record.id);
    const recordTracks = tracks.filter(t => t.recordId === record.id);
    const recordConflicts = conflicts.filter(c => c.recordId === record.id);
    const recordAnnotations = annotations.filter(a => a.recordId === record.id);
    const recordNotes = notes.filter(n => n.recordId === record.id);
    
    const totalDuration = recordTracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const matchedCount = recordTracks.filter(t => t.fileId).length;
    const unresolvedConflicts = recordConflicts.filter(c => c.resolution === 'unresolved').length;
    
    return {
      fileCount: recordFiles.length,
      trackCount: recordTracks.length,
      totalDuration,
      matchedCount,
      conflictCount: recordConflicts.length,
      unresolvedConflicts,
      annotationCount: recordAnnotations.length,
      noteCount: recordNotes.length,
      supplementCount: recordNotes.filter(n => n.isSupplement).length,
    };
  };

  const handleViewRecord = (record: WeeklyRecord) => {
    setCurrentRecord(record.id);
    navigate('/report');
  };

  const handleLoadRecord = (record: WeeklyRecord) => {
    setCurrentRecord(record.id);
    setSelectedWeek(record.id);
  };

  const handleResetAll = () => {
    resetState();
    setShowDeleteConfirm(false);
  };

  const sortedRecords = [...records].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const selectedRecord = selectedWeek 
    ? records.find(r => r.id === selectedWeek)
    : null;

  const selectedStats = selectedRecord ? getRecordStats(selectedRecord) : null;

  return (
    <div>
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-studio-amber" />
            <h2 className="font-serif text-lg font-bold text-studio-text">
              历史记录
            </h2>
            <span className="text-sm text-studio-textMuted">
              共 {records.length} 条
            </span>
          </div>
          
          {records.length > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-studio-danger hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              清空所有数据
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
              <History className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-serif text-lg font-bold text-studio-text mb-2">
              还没有历史记录
            </h3>
            <p className="text-sm text-studio-textMuted mb-4">
              去导入页开始第一周的记录吧
            </p>
            <button
              onClick={() => navigate('/')}
              className="btn-primary"
            >
              开始使用
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedRecords.map((record, index) => {
              const stats = getRecordStats(record);
              const isSelected = selectedWeek === record.id;
              
              return (
                <div
                  key={record.id}
                  onClick={() => handleLoadRecord(record)}
                  className={`
                    card cursor-pointer transition-all duration-300 hover:-translate-y-1
                    animate-fade-in-up stagger-${Math.min(index % 6 + 1, 6)}
                    ${isSelected ? 'ring-2 ring-studio-amber shadow-lg' : ''}
                  `}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-serif font-bold text-studio-text">
                        {record.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-studio-textMuted mt-1">
                        <Calendar className="w-3 h-3" />
                        {formatWeekDisplay(record.weekKey)}
                      </div>
                    </div>
                    <span className={`
                      px-2 py-0.5 rounded-full text-xs font-medium
                      ${record.status === 'finalized' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                      }
                    `}>
                      {record.status === 'finalized' ? '已定稿' : '编辑中'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-lg font-bold font-mono text-studio-text">
                        {stats.trackCount}
                      </p>
                      <p className="text-[10px] text-studio-textMuted">曲目</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-lg font-bold font-mono text-studio-text">
                        {formatDuration(stats.totalDuration)}
                      </p>
                      <p className="text-[10px] text-studio-textMuted">总时长</p>
                    </div>
                    <div className={`
                      p-2 rounded
                      ${stats.unresolvedConflicts > 0 ? 'bg-red-50' : 'bg-green-50'}
                    `}>
                      <p className={`
                        text-lg font-bold font-mono
                        ${stats.unresolvedConflicts > 0 ? 'text-red-600' : 'text-green-600'}
                      `}>
                        {stats.unresolvedConflicts}
                      </p>
                      <p className="text-[10px] text-studio-textMuted">待处理</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-studio-textMuted pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {record.operator}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTimeShort(record.updatedAt)}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewRecord(record);
                      }}
                      className="btn-primary flex-1 text-xs flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      查看周报
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedRecord && selectedStats && (
        <div className="card animate-slide-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg font-bold text-studio-text">
              {selectedRecord.title} - 详细信息
            </h3>
            <button
              onClick={() => handleViewRecord(selectedRecord)}
              className="btn-primary text-sm flex items-center gap-1"
            >
              <FileText className="w-4 h-4" />
              查看周报
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-studio-textMuted text-xs mb-1">
                <Music className="w-3 h-3" />
                曲目
              </div>
              <p className="text-xl font-bold text-studio-text">
                {selectedStats.trackCount} 首
              </p>
              <p className="text-xs text-studio-textMuted">
                已关联 {selectedStats.matchedCount}
              </p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-studio-textMuted text-xs mb-1">
                <Clock className="w-3 h-3" />
                总时长
              </div>
              <p className="text-xl font-bold text-studio-text font-mono">
                {formatDuration(selectedStats.totalDuration)}
              </p>
              <p className="text-xs text-studio-textMuted">
                {selectedStats.fileCount} 个文件
              </p>
            </div>
            
            <div className={`p-3 rounded-lg ${selectedStats.unresolvedConflicts > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
              <div className={`flex items-center gap-2 text-xs mb-1 ${selectedStats.unresolvedConflicts > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                <AlertTriangle className="w-3 h-3" />
                冲突
              </div>
              <p className={`text-xl font-bold ${selectedStats.unresolvedConflicts > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {selectedStats.conflictCount}
              </p>
              <p className="text-xs text-studio-textMuted">
                待处理 {selectedStats.unresolvedConflicts}
              </p>
            </div>
            
            <div className="p-3 bg-studio-amber/5 rounded-lg border border-studio-amber/20">
              <div className="flex items-center gap-2 text-studio-amber text-xs mb-1">
                <CheckCircle2 className="w-3 h-3" />
                批注&备注
              </div>
              <p className="text-xl font-bold text-studio-amber">
                {selectedStats.annotationCount + selectedStats.noteCount}
              </p>
              <p className="text-xs text-studio-textMuted">
                含补录 {selectedStats.supplementCount} 条
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-studio-text mb-2">操作记录</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-studio-textMuted">创建时间</span>
                  <span>{formatDateTimeShort(selectedRecord.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-studio-textMuted">最后更新</span>
                  <span>{formatDateTimeShort(selectedRecord.updatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-studio-textMuted">操作人</span>
                  <span>{selectedRecord.operator}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-studio-text mb-2">数据完整性</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-studio-textMuted">曲目表</span>
                  <span className={selectedStats.trackCount > 0 ? 'text-green-600' : 'text-red-500'}>
                    {selectedStats.trackCount > 0 ? '✓ 已导入' : '✗ 缺失'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-studio-textMuted">音频文件</span>
                  <span className={selectedStats.matchedCount > 0 ? 'text-green-600' : 'text-orange-500'}>
                    {selectedStats.matchedCount > 0 ? '✓ 已关联' : '△ 待关联'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-studio-textMuted">待处理项</span>
                  <span className={selectedStats.unresolvedConflicts === 0 ? 'text-green-600' : 'text-red-500'}>
                    {selectedStats.unresolvedConflicts === 0 ? '✓ 全部处理' : `✗ ${selectedStats.unresolvedConflicts} 项待处理`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-700">
              💡 所有人工标注的版本和处理备注都保存在本地，下次打开还在。
              换同事接手时，让他来看这个页面就能看懂之前是怎么判的。
            </p>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => navigate('/')}
              className="btn-ghost"
            >
              去导入新材料
            </button>
            <button
              onClick={() => handleViewRecord(selectedRecord)}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              查看并导出周报
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in-up">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 animate-slide-in">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-serif font-bold text-studio-text text-lg">
                确认清空所有数据？
              </h3>
            </div>
            <div className="p-4">
              <p className="text-studio-text mb-4">
                这会删除所有周记录、文件、批注和备注。
              </p>
              <div className="p-3 bg-red-50 rounded-lg border border-red-100 text-sm text-red-600">
                <p className="font-medium mb-1">⚠️ 此操作不可撤销</p>
                <p>删除前会自动备份一份到浏览器本地存储，以备你反悔。</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-ghost"
              >
                取消
              </button>
              <button
                onClick={handleResetAll}
                className="btn-danger"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

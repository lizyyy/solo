import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Clock, User, FileText, Tag } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { StatusBadge } from '../components/StatusBadge';
import { SourceBadge } from '../components/SourceBadge';
import { statusLabels, type RecordStatus } from '../../shared/types';

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRecord, versionHistories, loading, saveStatus, fetchRecord, updateRecordNote, updateRecordStatus, clearSaveStatus } = useRecordStore();
  
  const [note, setNote] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<RecordStatus | ''>('');

  useEffect(() => {
    if (id) {
      fetchRecord(id);
    }
    return () => clearSaveStatus();
  }, [id, fetchRecord, clearSaveStatus]);

  useEffect(() => {
    if (currentRecord) {
      setNote(currentRecord.currentNote);
      setSelectedStatus(currentRecord.status);
    }
  }, [currentRecord]);

  const handleSaveNote = () => {
    if (id && currentRecord) {
      updateRecordNote(id, note);
    }
  };

  const handleStatusChange = (status: RecordStatus) => {
    if (id) {
      setSelectedStatus(status);
      updateRecordStatus(id, status);
    }
  };

  const getFlagTags = () => {
    if (!currentRecord) return [];
    const tags: { label: string; color: string }[] = [];
    if (currentRecord.isOldMaster) tags.push({ label: '旧版母带', color: 'bg-gray-100 text-gray-600' });
    if (currentRecord.isDuplicate) tags.push({ label: '重复曲目', color: 'bg-red-100 text-red-600' });
    if (!currentRecord.hasAuthorization) tags.push({ label: '缺授权', color: 'bg-yellow-100 text-yellow-700' });
    if (currentRecord.isRenamed) tags.push({ label: `人工改名(原:${currentRecord.originalTrackName})`, color: 'bg-purple-100 text-purple-600' });
    return tags;
  };

  const versionHistory = id ? (versionHistories[id] || []) : [];

  if (loading && !currentRecord) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <div className="animate-pulse-soft text-slate-500">加载中...</div>
      </div>
    );
  }

  if (!currentRecord) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">记录不存在</p>
          <button onClick={() => navigate('/')} className="btn-primary">返回列表</button>
        </div>
      </div>
    );
  }

  const tags = getFlagTags();

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-slate-800 text-white py-6 mb-8 no-print">
        <div className="container max-w-5xl px-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            返回列表
          </button>
          <h1 className="font-display text-2xl font-semibold">{currentRecord.trackName}</h1>
          <p className="text-slate-300 text-sm mt-1">{currentRecord.artistName}</p>
        </div>
      </header>

      <main className="container max-w-5xl px-4 pb-12">
        <div className="grid gap-6">
          <div className="card animate-fade-in-up">
            <h2 className="font-display text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText size={18} />
              基本信息
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-slate-500 mb-1">曲目名称</label>
                <p className="font-medium text-slate-800">{currentRecord.trackName}</p>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">艺人/学生</label>
                <p className="font-medium text-slate-800">{currentRecord.artistName}</p>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">状态</label>
                <div className="flex items-center gap-2">
                  <StatusBadge status={currentRecord.status} />
                  <select
                    value={selectedStatus}
                    onChange={(e) => handleStatusChange(e.target.value as RecordStatus)}
                    className="text-xs px-2 py-1 border border-warm-200 rounded bg-white"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">来源</label>
                <SourceBadge source={currentRecord.source} />
              </div>
              {tags.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-sm text-slate-500 mb-2 flex items-center gap-1">
                    <Tag size={14} />
                    特殊标记
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, i) => (
                      <span
                        key={i}
                        className={`inline-flex px-2 py-1 rounded text-sm ${tag.color}`}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card animate-fade-in-up delay-80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={18} />
                处理备注
              </h2>
              <div className="flex items-center gap-3">
                {saveStatus === 'saving' && (
                  <span className="text-xs text-amber-600 animate-pulse-soft">保存中...</span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-xs text-green-600">已保存</span>
                )}
                <button onClick={handleSaveNote} className="btn-primary flex items-center gap-2 text-sm">
                  <Save size={14} />
                  保存备注
                </button>
              </div>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-field h-32 resize-none"
              placeholder="输入处理备注..."
            />
          </div>

          <div className="card animate-fade-in-up delay-160">
            <h2 className="font-display text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <User size={18} />
              处理记录
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-slate-500 mb-1">原始来源</label>
                <p className="text-sm text-slate-700">{currentRecord.originalSource}</p>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">原始处理时间</label>
                <p className="text-sm text-slate-700">{currentRecord.originalHandleTime}</p>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">最后处理人</label>
                <p className="text-sm text-slate-700">{currentRecord.latestHandler}</p>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">最后处理时间</label>
                <p className="text-sm text-slate-700">{currentRecord.latestHandleTime}</p>
              </div>
            </div>
          </div>

          <div className="card animate-fade-in-up delay-240">
            <h2 className="font-display text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Clock size={18} />
              版本历史
            </h2>
            {versionHistory.length === 0 ? (
              <p className="text-slate-500 text-sm">暂无修改记录</p>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-warm-200"></div>
                <div className="space-y-4">
                  {versionHistory.map((version, index) => (
                    <div key={version.id} className="relative pl-10">
                      <div className="absolute left-2 top-1.5 w-4 h-4 rounded-full bg-amber-500 border-4 border-white shadow"></div>
                      <div className="bg-warm-50 rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700">{version.fieldName}</span>
                          <span className="text-xs text-slate-400">{version.modifiedAt.replace('T', ' ').slice(0, 19)}</span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="text-red-500 line-through">{version.oldValue || '(空)'}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 bg-green-50 px-1 rounded">{version.newValue || '(空)'}</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">修改人：{version.modifiedBy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

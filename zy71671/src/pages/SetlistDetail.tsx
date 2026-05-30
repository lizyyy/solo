import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  Clock,
  Music,
  GitBranch,
  AlertCircle,
  CheckCircle2,
  Loader2,
  HelpCircle,
  Calendar,
  MapPin,
  Gauge,
} from 'lucide-react';
import { useSetlistStore } from '../store/useSetlistStore';
import { formatDuration, formatDate } from '../lib/utils';
import TraceModal from '../components/TraceModal';
import type { Song, Key } from '../../shared/types';

export default function SetlistDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentSetlist, loading, error, fetchSetlist, updateSong, addSong } = useSetlistStore();
  const [showAddSong, setShowAddSong] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [traceModal, setTraceModal] = useState<{
    field: string;
    label: string;
    songId?: string;
  } | null>(null);

  const [songForm, setSongForm] = useState<{
    name: string;
    originalKey: Key;
    currentKey: Key;
    duration: number;
    order: number;
    vocalRange: { min: string; max: string };
    instrumentTunings: { guitar?: string; bass?: string; keys?: string };
    vocalNotes: string;
    updatedBy: string;
    updateReason: string;
  }>({
    name: '',
    originalKey: 'C',
    currentKey: 'C',
    duration: 240,
    order: 1,
    vocalRange: { min: 'C4', max: 'C5' },
    instrumentTunings: { guitar: 'Standard', bass: 'Standard' },
    vocalNotes: '',
    updatedBy: '',
    updateReason: '',
  });

  useEffect(() => {
    if (id) {
      fetchSetlist(id);
    }
  }, [id, fetchSetlist]);

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await addSong(id, songForm);
      setShowAddSong(false);
      resetSongForm();
    } catch (err) {
      console.error('添加歌曲失败', err);
    }
  };

  const handleEditSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editingSong) return;
    try {
      const { name, ...rest } = songForm;
      await updateSong(id, editingSong.id, rest);
      setEditingSong(null);
      resetSongForm();
    } catch (err) {
      console.error('更新歌曲失败', err);
    }
  };

  const resetSongForm = () => {
    setSongForm({
      name: '',
      originalKey: 'C',
      currentKey: 'C',
      duration: 240,
      order: (currentSetlist?.songs.length || 0) + 1,
      vocalRange: { min: 'C4', max: 'C5' },
      instrumentTunings: { guitar: 'Standard', bass: 'Standard' },
      vocalNotes: '',
      updatedBy: '',
      updateReason: '',
    });
  };

  const openEdit = (song: Song) => {
    setEditingSong(song);
    setSongForm({
      name: song.name,
      originalKey: song.originalKey,
      currentKey: song.currentKey,
      duration: song.duration,
      order: song.order,
      vocalRange: song.vocalRange || { min: 'C4', max: 'C5' },
      instrumentTunings: song.instrumentTunings || { guitar: 'Standard', bass: 'Standard' },
      vocalNotes: song.vocalNotes || '',
      updatedBy: '',
      updateReason: '',
    });
  };

  const openTrace = (field: string, label: string, songId?: string) => {
    setTraceModal({ field, label, songId });
  };

  if (loading && !currentSetlist) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">加载失败</h3>
          <p className="text-red-700">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  if (!currentSetlist) return null;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回歌单列表
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">演出日期</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatDate(currentSetlist.date)}
          </div>
          <div className="text-sm text-gray-500 mt-1">{currentSetlist.venue}</div>
        </div>

        <div
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:border-indigo-300 transition-colors"
          onClick={() => openTrace('totalDuration', '总演出时长')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">总时长</span>
            </div>
            <HelpCircle className="w-4 h-4 text-gray-300" />
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatDuration(currentSetlist.totalDuration)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            限制 {formatDuration(currentSetlist.maxDuration)}
          </div>
          {currentSetlist.totalDuration > currentSetlist.maxDuration && (
            <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              超时 {formatDuration(currentSetlist.totalDuration - currentSetlist.maxDuration)}
            </div>
          )}
        </div>

        <div
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:border-indigo-300 transition-colors"
          onClick={() => openTrace('songCount', '歌曲数量')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Music className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">歌曲数量</span>
            </div>
            <HelpCircle className="w-4 h-4 text-gray-300" />
          </div>
          <div className="text-xl font-bold text-gray-900">
            {currentSetlist.songCount} 首
          </div>
          <div className="text-sm text-gray-500 mt-1">
            <GitBranch className="w-3 h-3 inline mr-1" />
            版本 v{currentSetlist.version}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">歌曲列表</h2>
          <button
            onClick={() => {
              resetSongForm();
              setShowAddSong(true);
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-sm font-medium rounded-lg hover:bg-indigo-100"
          >
            <Plus className="w-4 h-4" />
            添加歌曲
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {currentSetlist.songs.map((song) => (
            <div
              key={song.id}
              className="p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                      {song.order}
                    </span>
                    <h3 className="font-medium text-gray-900">{song.name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div
                      className="flex items-center gap-1 cursor-help text-indigo-600 hover:text-indigo-800"
                      onClick={() => openTrace('currentKey', '当前调号', song.id)}
                    >
                      <Gauge className="w-4 h-4" />
                      原调: <span className="font-medium">{song.originalKey}</span>
                      → 现调: <span className="font-semibold">{song.currentKey}</span>
                    </div>
                    <div
                      className="flex items-center gap-1 cursor-help text-gray-600"
                      onClick={() => openTrace('duration', '歌曲时长', song.id)}
                    >
                      <Clock className="w-4 h-4" />
                      {formatDuration(song.duration)}
                    </div>
                    {song.instrumentTunings?.guitar && (
                      <div className="text-gray-600">
                        吉他: {song.instrumentTunings.guitar}
                      </div>
                    )}
                    {song.vocalNotes && (
                      <div className="text-amber-600">备注: {song.vocalNotes}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => openEdit(song)}
                    className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {currentSetlist.songs.length === 0 && (
            <div className="p-12 text-center">
              <Music className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">暂无歌曲，点击上方按钮添加</p>
            </div>
          )}
        </div>
      </div>

      {(showAddSong || editingSong) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingSong ? '编辑歌曲' : '添加歌曲'}
            </h3>
            <form
              onSubmit={editingSong ? handleEditSong : handleAddSong}
              className="space-y-4"
            >
              {!editingSong && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    歌曲名称 *
                  </label>
                  <input
                    type="text"
                    required
                    value={songForm.name}
                    onChange={(e) => setSongForm({ ...songForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="例如：光辉岁月"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    原调 *
                  </label>
                  <input
                    type="text"
                    required
                    value={songForm.originalKey}
                    onChange={(e) =>
                      setSongForm({
                        ...songForm,
                        originalKey: e.target.value as typeof songForm.originalKey,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="C, C#, Db, D, ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    现调 *
                  </label>
                  <input
                    type="text"
                    required
                    value={songForm.currentKey}
                    onChange={(e) =>
                      setSongForm({
                        ...songForm,
                        currentKey: e.target.value as typeof songForm.currentKey,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="C, C#, Db, D, ..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    时长（秒）*
                  </label>
                  <input
                    type="number"
                    required
                    min="30"
                    value={songForm.duration}
                    onChange={(e) =>
                      setSongForm({ ...songForm, duration: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    出场顺序 *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={songForm.order}
                    onChange={(e) =>
                      setSongForm({ ...songForm, order: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    吉他调弦
                  </label>
                  <input
                    type="text"
                    value={songForm.instrumentTunings.guitar}
                    onChange={(e) =>
                      setSongForm({
                        ...songForm,
                        instrumentTunings: {
                          ...songForm.instrumentTunings,
                          guitar: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Standard, Drop D, ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    贝斯调弦
                  </label>
                  <input
                    type="text"
                    value={songForm.instrumentTunings.bass}
                    onChange={(e) =>
                      setSongForm({
                        ...songForm,
                        instrumentTunings: {
                          ...songForm.instrumentTunings,
                          bass: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Standard, Drop D, ..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  主唱备注
                </label>
                <textarea
                  value={songForm.vocalNotes}
                  onChange={(e) => setSongForm({ ...songForm, vocalNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={2}
                  placeholder="例如：副歌需要降调，主唱今天嗓子状态一般"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  操作人 *
                </label>
                <input
                  type="text"
                  required
                  value={songForm.updatedBy}
                  onChange={(e) => setSongForm({ ...songForm, updatedBy: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="您的名字"
                />
              </div>

              {editingSong && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    变更原因 *
                  </label>
                  <input
                    type="text"
                    required
                    value={songForm.updateReason}
                    onChange={(e) => setSongForm({ ...songForm, updateReason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="例如：主唱状态调整，降半调"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSong(false);
                    setEditingSong(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600"
                >
                  {editingSong ? '保存修改' : '添加歌曲'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {traceModal && id && (
        <TraceModal
          isOpen={true}
          onClose={() => setTraceModal(null)}
          setlistId={id}
          field={traceModal.field}
          fieldLabel={traceModal.label}
          songId={traceModal.songId}
        />
      )}
    </div>
  );
}

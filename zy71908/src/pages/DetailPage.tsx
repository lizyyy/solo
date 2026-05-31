import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useArchiveStore } from '../store/archiveStore';
import { SourceBadge, ChangeTypeBadge, StatusBadge, BackfillBadge } from '../components/Badges';
import { ErrorDisplay } from '../components/ErrorToast';
import { TranspositionValidator } from '../services/TranspositionValidator';
import { format } from 'date-fns';
import {
  ArrowLeft, Clock, User, FileText, GitBranch, AlertTriangle,
  CheckCircle, Music, Edit3, Plus, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { SourceType, ChangeType } from '../types';
import { KEY_NAMES, SOURCE_LABELS, CHANGE_TYPE_LABELS } from '../types';

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRecordById, updateRecordTransposition, error, clearError, currentUser } = useArchiveStore();
  const [showVersionCompare, setShowVersionCompare] = React.useState(false);
  const [selectedVersions, setSelectedVersions] = React.useState<[number, number]>([0, 1]);
  const [editingSource, setEditingSource] = React.useState<SourceType | null>(null);
  const [editKey, setEditKey] = React.useState(0);
  const [editChangeType, setEditChangeType] = React.useState<ChangeType>('revision');

  const record = id ? getRecordById(id) : undefined;

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-primary-50/30">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-warning-400 mx-auto mb-3" />
          <p className="text-neutral-600 font-medium">找不到该归档记录</p>
          <Link to="/" className="btn-primary mt-4 inline-block text-sm">
            返回主页
          </Link>
        </div>
      </div>
    );
  }

  const transpositionResult = TranspositionValidator.validate(record);

  const handleSaveTransposition = () => {
    if (!editingSource || !id) return;
    const result = updateRecordTransposition(id, editingSource, editKey, editChangeType);
    if (result.success) {
      setEditingSource(null);
    }
  };

  const v1 = record.versions[selectedVersions[0]];
  const v2 = record.versions[selectedVersions[1]];

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-primary-50/30">
      <header className="bg-white/80 backdrop-blur-md border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-600" />
              </button>
              <div>
                <h1 className="font-serif text-base font-bold text-neutral-900">{record.pieceName}</h1>
                <p className="text-xs text-neutral-500">{record.student.name} · {record.student.grade}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ChangeTypeBadge changeType={record.changeType} />
              <StatusBadge status={record.status} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && <ErrorDisplay error={error} onClose={clearError} />}

        <section className="bg-white rounded-xl border border-neutral-200 p-5">
          <h2 className="font-serif text-sm font-semibold text-neutral-800 flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-primary-600" />
            数据来源
          </h2>
          <div className="space-y-3">
            {record.sources.map(source => (
              <div key={source.id} className="flex items-start justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <SourceBadge sourceType={source.sourceType} />
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{source.sourceName}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(source.recordedAt), 'yyyy-MM-dd HH:mm')}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {source.recordedBy}
                      </span>
                      <BackfillBadge isBackfilled={source.isBackfilled} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {record.sources.length < 3 && (
              <div className="p-3 border-2 border-dashed border-neutral-200 rounded-lg text-center">
                <p className="text-xs text-neutral-400">
                  还缺少 {['metronome', 'song_list', 'sheet_music']
                    .filter(s => !record.sources.some(r => r.sourceType === s))
                    .map(s => SOURCE_LABELS[s as SourceType])
                    .join('、')} 的数据
                </p>
              </div>
            )}
          </div>
        </section>

        <section className={`bg-white rounded-xl border p-5 ${
          transpositionResult.isSynced ? 'border-neutral-200' : 'border-danger-200'
        }`}>
          <h2 className="font-serif text-sm font-semibold text-neutral-800 flex items-center gap-2 mb-4">
            <Music className="w-4 h-4 text-primary-600" />
            转调信息
            {transpositionResult.isSynced ? (
              <CheckCircle className="w-4 h-4 text-success-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-danger-500" />
            )}
          </h2>

          <div className="grid grid-cols-3 gap-4">
            {(['metronome', 'song_list', 'sheet_music'] as const).map(sourceType => {
              const key = record.transposition?.[`${sourceType}Key` as keyof typeof record.transposition] as number | undefined;
              const hasSource = record.sources.some(s => s.sourceType === sourceType);
              const isMismatch = transpositionResult.mismatchedSources.includes(sourceType);

              return (
                <div
                  key={sourceType}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    isMismatch
                      ? 'border-danger-300 bg-danger-50'
                      : key !== undefined
                        ? 'border-success-200 bg-success-50'
                        : 'border-neutral-200 bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-neutral-600">
                      {SOURCE_LABELS[sourceType]}
                    </span>
                    {editingSource === sourceType ? (
                      <div className="flex gap-1">
                        <button
                          onClick={handleSaveTransposition}
                          className="text-[10px] bg-primary-600 text-white px-2 py-0.5 rounded"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingSource(null)}
                          className="text-[10px] text-neutral-500 px-2 py-0.5"
                        >
                          取消
                        </button>
                      </div>
                    ) : hasSource ? (
                      <button
                        onClick={() => {
                          setEditingSource(sourceType);
                          setEditKey(key ?? 0);
                        }}
                        className="text-[10px] text-primary-500 hover:text-primary-600"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                  {editingSource === sourceType ? (
                    <select
                      value={editKey}
                      onChange={(e) => setEditKey(parseInt(e.target.value))}
                      className="w-full text-sm input-field py-1"
                    >
                      {KEY_NAMES.map((name, idx) => (
                        <option key={idx} value={idx}>{name}调</option>
                      ))}
                    </select>
                  ) : (
                    <div className={`text-lg font-bold ${
                      isMismatch ? 'text-danger-600' : key !== undefined ? 'text-success-600' : 'text-neutral-400'
                    }`}>
                      {key !== undefined ? `${KEY_NAMES[key]}调` : '无数据'}
                    </div>
                  )}
                  {isMismatch && key !== undefined && (
                    <p className="text-[10px] text-danger-500 mt-1">
                      与其他来源不一致
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {editingSource && (
            <div className="mt-3 p-3 bg-warning-50 border border-warning-200 rounded-lg">
              <label className="block text-xs font-medium text-warning-800 mb-2">
                此修改属于：
              </label>
              <div className="flex gap-3">
                <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-all
                  ${editChangeType === 'supplement'
                    ? 'bg-neutral-100 border-neutral-300 text-neutral-700'
                    : 'border-neutral-200 text-neutral-500'
                  }`}>
                  <input
                    type="radio"
                    name="changeType"
                    checked={editChangeType === 'supplement'}
                    onChange={() => setEditChangeType('supplement')}
                    className="sr-only"
                  />
                  <Plus className="w-3.5 h-3.5" />
                  补材料（仅补充缺失数据）
                </label>
                <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-all
                  ${editChangeType === 'revision'
                    ? 'bg-danger-100 border-danger-300 text-danger-700'
                    : 'border-neutral-200 text-neutral-500'
                  }`}>
                  <input
                    type="radio"
                    name="changeType"
                    checked={editChangeType === 'revision'}
                    onChange={() => setEditChangeType('revision')}
                    className="sr-only"
                  />
                  <Edit3 className="w-3.5 h-3.5" />
                  改结论（修改了已有结论）
                </label>
              </div>
            </div>
          )}

          {!transpositionResult.isSynced && (
            <div className="mt-4 p-3 bg-danger-50 border border-danger-100 rounded-lg">
              <p className="text-sm text-danger-700 whitespace-pre-line leading-relaxed">
                {transpositionResult.humanMessage}
              </p>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-neutral-200 p-5">
          <button
            onClick={() => setShowVersionCompare(!showVersionCompare)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="font-serif text-sm font-semibold text-neutral-800 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary-600" />
              版本历史（{record.versions.length} 个版本）
            </h2>
            {showVersionCompare ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>

          {showVersionCompare && (
            <div className="mt-4 animate-fade-in">
              <div className="space-y-2 mb-4">
                {record.versions.slice().reverse().map((version, idx) => (
                  <div
                    key={version.id}
                    className={`p-3 rounded-lg border ${
                      version.changeType === 'revision'
                        ? 'border-danger-200 bg-danger-50/30'
                        : 'border-neutral-200 bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-neutral-500">v{version.versionNumber}</span>
                        <ChangeTypeBadge changeType={version.changeType} />
                        <span className="text-sm text-neutral-800">{version.changeDescription}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(version.changedAt), 'MM-dd HH:mm')}
                        </span>
                        <span>{version.changedBy}</span>
                      </div>
                    </div>
                    {version.diffData.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {version.diffData.map((diff, dIdx) => (
                          <div key={dIdx} className="text-xs flex items-center gap-2">
                            <span className="text-neutral-500">{diff.field}：</span>
                            {diff.oldValue !== null && (
                              <span className="bg-danger-100 text-danger-700 px-1.5 py-0.5 rounded line-through">
                                {typeof diff.oldValue === 'number' ? KEY_NAMES[diff.oldValue] || diff.oldValue : String(diff.oldValue)}
                              </span>
                            )}
                            <span className="text-neutral-400">→</span>
                            {diff.newValue !== null && (
                              <span className="bg-success-100 text-success-700 px-1.5 py-0.5 rounded">
                                {typeof diff.newValue === 'number' ? KEY_NAMES[diff.newValue] || diff.newValue : String(diff.newValue)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {record.versions.length >= 2 && (
                <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                  <h3 className="text-xs font-medium text-neutral-600 mb-3">版本对比</h3>
                  <div className="flex gap-3 items-center mb-3">
                    <select
                      value={selectedVersions[0]}
                      onChange={(e) => setSelectedVersions([parseInt(e.target.value), selectedVersions[1]])}
                      className="input-field text-sm py-1 w-32"
                    >
                      {record.versions.map((v, i) => (
                        <option key={i} value={i}>v{v.versionNumber}</option>
                      ))}
                    </select>
                    <span className="text-neutral-400 text-xs">对比</span>
                    <select
                      value={selectedVersions[1]}
                      onChange={(e) => setSelectedVersions([selectedVersions[0], parseInt(e.target.value)])}
                      className="input-field text-sm py-1 w-32"
                    >
                      {record.versions.map((v, i) => (
                        <option key={i} value={i}>v{v.versionNumber}</option>
                      ))}
                    </select>
                  </div>
                  {v1 && v2 && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white rounded-lg border border-neutral-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-neutral-500">v{v1.versionNumber}</span>
                          <span className="text-xs text-neutral-400">{v1.changedBy}</span>
                        </div>
                        <p className="text-sm text-neutral-700">{v1.changeDescription}</p>
                        {v1.diffData.map((d, i) => (
                          <p key={i} className="text-xs text-neutral-500 mt-1">
                            {d.field}: {typeof d.newValue === 'number' ? KEY_NAMES[d.newValue] || d.newValue : String(d.newValue ?? '无')}
                          </p>
                        ))}
                      </div>
                      <div className="p-3 bg-white rounded-lg border border-neutral-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-neutral-500">v{v2.versionNumber}</span>
                          <span className="text-xs text-neutral-400">{v2.changedBy}</span>
                        </div>
                        <p className="text-sm text-neutral-700">{v2.changeDescription}</p>
                        {v2.diffData.map((d, i) => (
                          <p key={i} className="text-xs text-neutral-500 mt-1">
                            {d.field}: {typeof d.newValue === 'number' ? KEY_NAMES[d.newValue] || d.newValue : String(d.newValue ?? '无')}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {record.notes && (
          <section className="bg-white rounded-xl border border-neutral-200 p-5">
            <h2 className="font-serif text-sm font-semibold text-neutral-800 flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-primary-600" />
              备注
            </h2>
            <p className="text-sm text-neutral-600 whitespace-pre-line">{record.notes}</p>
          </section>
        )}

        <section className="p-3 bg-neutral-50 rounded-xl text-xs text-neutral-500 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>创建：{format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm')} by {record.createdBy}</span>
            <span>更新：{format(new Date(record.updatedAt), 'yyyy-MM-dd HH:mm')}</span>
          </div>
          <span>当前操作人：{currentUser}</span>
        </section>
      </main>
    </div>
  );
}

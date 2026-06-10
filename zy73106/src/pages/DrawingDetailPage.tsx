import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import MetricCard from '@/components/MetricCard';
import StatusBadge from '@/components/StatusBadge';
import NoteCard from '@/components/NoteCard';
import AddNoteForm from '@/components/AddNoteForm';
import MaterialRow from '@/components/MaterialRow';
import MetricEditor from '@/components/MetricEditor';
import { formatDateTime } from '@/utils/date';
import {
  ChevronRight, Home, FileText, Building2, GitCompare, GitBranch,
  AlertCircle, CheckCircle2, Package, MessageSquarePlus,
  Edit3, User, Calendar, Clock, History, ChevronDown,
} from 'lucide-react';
import type { DrawingMetrics, DrawingStatus, DrawingVersion } from '@/types';
import { STATUS_LABELS, NOTE_TAG_LABELS } from '@/types';
import { cn } from '@/lib/utils';
import { METRIC_FIELD_LABELS } from '@/types';

const statusOptions: DrawingStatus[] = ['normal', 'abnormal', 'reviewing', 'closed'];

const statusToneCls: Record<DrawingStatus, string> = {
  normal: 'bg-[#186A3B]/30 border-[#27AE60] text-[#2ECC71]',
  abnormal: 'bg-[#7B241C]/30 border-[#C0392B] text-[#E74C3C]',
  reviewing: 'bg-[#784212]/30 border-[#E67E22] text-[#F39C12]',
  closed: 'bg-steel-700/50 border-steel-500 text-steel-300',
};

export default function DrawingDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const drawings = useAppStore((s) => s.drawings);
  const versions = useAppStore((s) => s.versions);
  const notes = useAppStore((s) => s.notes);
  const materials = useAppStore((s) => s.materials);
  const addNote = useAppStore((s) => s.addNote);
  const deleteNote = useAppStore((s) => s.deleteNote);
  const updateMetric = useAppStore((s) => s.updateMetric);
  const setDrawingStatus = useAppStore((s) => s.setDrawingStatus);
  const markMaterialSupplied = useAppStore((s) => s.markMaterialSupplied);

  const drawing = drawings.find((d) => d.id === id);

  const [editorField, setEditorField] = useState<keyof DrawingMetrics | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [toast, setToast] = useState('');

  const dVersions = useMemo<DrawingVersion[]>(
    () =>
      versions
        .filter((v) => v.drawingId === id)
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    [versions, id],
  );
  const currentVersion = dVersions[0];

  const dNotes = useMemo(
    () =>
      notes
        .filter((n) => n.drawingId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notes, id],
  );

  const groupedNotes = useMemo(() => {
    const byV = new Map<string, typeof dNotes>();
    for (const n of dNotes) {
      if (!byV.has(n.versionId)) byV.set(n.versionId, []);
      byV.get(n.versionId)!.push(n);
    }
    const pairs: [string, typeof dNotes][] = [];
    for (const v of dVersions) {
      if (byV.has(v.id)) pairs.push([v.id, byV.get(v.id)!]);
    }
    return pairs;
  }, [dNotes, dVersions]);

  const dMaterials = materials.filter((m) => m.drawingId === id);
  const missingCount = dMaterials.filter((m) => m.isMissing).length;

  const rawNotes = dNotes.filter((n) => n.isRawBimClue);
  const nonRawByVersion = groupedNotes.map(([vid, list]) => [
    vid,
    list.filter((n) => !n.isRawBimClue),
  ]) as [string, typeof dNotes][];

  if (!drawing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="panel-bordered p-10 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-[#E74C3C] mx-auto" />
          <h2 className="font-mono text-steel-200 uppercase tracking-wider text-sm">
            图纸不存在
          </h2>
          <Link to="/drawings" className="btn-steel inline-block">
            返回图纸列表
          </Link>
        </div>
      </div>
    );
  }

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleMetricEdit = (field: keyof DrawingMetrics, newValue: number, reason: string) => {
    const log = updateMetric({ drawingId: id, field, newValue, reason });
    if (log) {
      showToast(`指标已更新：${METRIC_FIELD_LABELS[field]} ${log.oldValue} → ${log.newValue}`);
    }
    setEditorField(null);
  };

  const handleStatusChange = (st: DrawingStatus) => {
    const ok = setDrawingStatus(id, st);
    if (!ok && (st === 'reviewing' || st === 'closed')) {
      setStatusError('需先有处理记录或复核意见备注');
      setTimeout(() => setStatusError(''), 3500);
    } else {
      setStatusError('');
      showToast(`状态已流转：${STATUS_LABELS[st]}`);
    }
    setStatusOpen(false);
  };

  const handleAddNote = (payload: { content: string; tag: keyof typeof NOTE_TAG_LABELS }) => {
    const n = addNote({ drawingId: id, ...payload });
    if (n) showToast('备注已追加');
  };

  const handleDeleteNote = (nid: string) => {
    if (deleteNote(nid)) showToast('备注已删除');
  };

  const handleMarkSupplied = (mid: string) => {
    markMaterialSupplied(mid);
    showToast('材料已标记到位');
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        <nav className="flex items-center gap-2 text-xs font-mono text-steel-400 flex-wrap">
          <Link to="/" className="flex items-center gap-1 hover:text-steel-200">
            <Home className="w-3.5 h-3.5" />
            工作台
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/drawings" className="flex items-center gap-1 hover:text-steel-200">
            <FileText className="w-3.5 h-3.5" />
            图纸版本中心
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-steel-200 truncate max-w-[300px]">{drawing.name}</span>
        </nav>

        <section className="panel-bordered grid-paper p-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-4 space-y-4">
              <div className="flex items-start gap-3">
                <span className="stamp-badge border-[#C0392B] text-[#E74C3C]">
                  {drawing.projectNo}
                </span>
                <StatusBadge status={drawing.status} />
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-steel-100 leading-tight">
                {drawing.name}
              </h1>
              <div className="flex items-center gap-1 text-sm font-mono text-steel-400">
                <Building2 className="w-4 h-4" />
                {drawing.buildingName}
              </div>
              <div className="text-[11px] font-mono text-steel-500 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  创建：{formatDateTime(drawing.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <History className="w-3 h-3" />
                  更新：{formatDateTime(drawing.updatedAt)}
                </span>
              </div>
            </div>

            <div className="xl:col-span-4 grid grid-cols-2 gap-3">
              <MetricCard
                label="碰撞点数"
                value={drawing.metrics.collisionPoints}
                tone={drawing.metrics.collisionPoints > 0 ? 'red' : 'steel'}
                hint="点击编辑"
                onClick={() => setEditorField('collisionPoints')}
                icon={<Edit3 className="w-5 h-5" />}
              />
              <MetricCard
                label="不合格项"
                value={drawing.metrics.unqualifiedItems}
                tone={drawing.metrics.unqualifiedItems > 0 ? 'red' : 'steel'}
                hint="点击编辑"
                onClick={() => setEditorField('unqualifiedItems')}
                icon={<Edit3 className="w-5 h-5" />}
              />
              <MetricCard
                label="日照阴影"
                value={drawing.metrics.sunShadowRisk}
                tone={drawing.metrics.sunShadowRisk > 0 ? 'orange' : 'green'}
                hint="点击编辑"
                onClick={() => setEditorField('sunShadowRisk')}
                icon={<Edit3 className="w-5 h-5" />}
              />
              <MetricCard
                label="体量偏差%"
                value={drawing.metrics.volumeDeviation}
                tone={drawing.metrics.volumeDeviation > 2 ? 'orange' : 'green'}
                hint="点击编辑"
                onClick={() => setEditorField('volumeDeviation')}
                icon={<Edit3 className="w-5 h-5" />}
              />
            </div>

            <div className="xl:col-span-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-[#3498DB]" />
                    <span className="font-mono text-xs uppercase tracking-wider text-steel-300">
                      版本时间线
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate('/versions')}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider border-2 border-steel-600 text-steel-400 hover:bg-steel-700"
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      版本对比
                    </button>
                    <button
                      onClick={() => navigate('/trace')}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider border-2 border-[#E67E22] text-[#F39C12] bg-[#784212]/20 hover:bg-[#784212]/40"
                    >
                      <History className="w-3.5 h-3.5" />
                      变更溯源
                    </button>
                  </div>
                </div>
                <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                  {dVersions.map((v, i) => {
                    const latest = i === 0;
                    return (
                      <div key={v.id} className="flex items-start gap-3 relative">
                        {i < dVersions.length - 1 && (
                          <div className="absolute left-[7px] top-6 w-[2px] h-[calc(100%+4px)] bg-steel-600" />
                        )}
                        <div
                          className={cn(
                            'relative w-4 h-4 mt-1 rounded-full border-2 flex-shrink-0',
                            latest
                              ? 'bg-[#E74C3C] border-[#C0392B] shadow-[0_0_8px_rgba(231,76,60,0.7)]'
                              : 'bg-steel-700 border-steel-500',
                          )}
                        >
                          {latest && (
                            <span className="absolute -top-1 -right-16 text-[8px] font-mono uppercase px-1.5 py-0.5 bg-[#C0392B] text-white border border-[#E74C3C] whitespace-nowrap">
                              LATEST
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div
                            className={cn(
                              'text-xs font-mono font-bold flex items-center gap-2 flex-wrap',
                              latest ? 'text-steel-100' : 'text-steel-400',
                            )}
                          >
                            <span>{v.version}</span>
                            <span
                              className={cn(
                                'text-[10px]',
                                latest ? 'text-steel-300' : 'text-steel-500',
                              )}
                            >
                              {v.fileName}
                            </span>
                          </div>
                          <div
                            className={cn(
                              'text-[10px] font-mono flex items-center gap-2 mt-0.5',
                              latest ? 'text-steel-400' : 'text-steel-600',
                            )}
                          >
                            <span className="flex items-center gap-1">
                              <User className="w-2.5 h-2.5" />
                              {v.uploadedBy}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              {formatDateTime(v.uploadedAt)}
                            </span>
                          </div>
                          {v.changeLog && (
                            <div
                              className={cn(
                                'text-[10px] font-mono mt-1 italic border-l-2 pl-2 py-0.5',
                                latest
                                  ? 'border-steel-500 text-steel-400'
                                  : 'border-steel-700 text-steel-600',
                              )}
                            >
                              {v.changeLog}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-steel-400 mb-1.5">
                  状态流转
                </div>
                <div className="relative">
                  <button
                    onClick={() => setStatusOpen((o) => !o)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 border-2 font-mono text-xs uppercase tracking-wider',
                      statusToneCls[drawing.status],
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {drawing.status === 'closed' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      当前：{STATUS_LABELS[drawing.status]}
                    </span>
                    <ChevronDown className={cn('w-4 h-4 transition-transform', statusOpen && 'rotate-180')} />
                  </button>
                  {statusOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 panel-bordered overflow-hidden">
                      {statusOptions.map((st) => (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(st)}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 text-left border-b-2 border-steel-700 last:border-b-0 font-mono text-xs uppercase tracking-wider transition-colors hover:bg-steel-700/60',
                            statusToneCls[st],
                          )}
                        >
                          <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                          {STATUS_LABELS[st]}
                          {st === drawing.status && (
                            <CheckCircle2 className="w-3 h-3 ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {statusError && (
                  <div className="mt-2 flex items-start gap-2 p-2 border-2 border-[#C0392B] bg-[#7B241C]/30 text-[#E74C3C] text-[10px] font-mono animate-flash-orange">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {statusError}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-steel-200">
                <MessageSquarePlus className="w-4 h-4 text-[#3498DB]" />
                BIM备注 · 追加式记录（不覆盖历史）
              </h2>
              <span className="text-[10px] font-mono text-steel-500 px-2 py-0.5 border border-steel-600">
                共 {dNotes.length} 条
              </span>
            </div>

            <AddNoteForm onSubmit={handleAddNote} />

            {rawNotes.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-steel-500 mb-2 px-1">
                  BIM原始线索 · 置顶
                </div>
                {rawNotes.map((n) => (
                  <NoteCard key={n.id} note={n} />
                ))}
              </div>
            )}

            {nonRawByVersion.map(([vid, list]) => {
              if (list.length === 0) return null;
              const v = dVersions.find((x) => x.id === vid);
              const isOld = vid !== currentVersion?.id;
              return (
                <div key={vid}>
                  <div
                    className={cn(
                      'text-[10px] font-mono uppercase tracking-wider mb-2 px-1 flex items-center gap-2',
                      isOld ? 'text-steel-600' : 'text-steel-400',
                    )}
                  >
                    <span
                      className={cn(
                        'px-2 py-0.5 border',
                        isOld
                          ? 'border-steel-700 bg-steel-900/50'
                          : 'border-[#3498DB] bg-[#1A5276]/20 text-[#5DADE2]',
                      )}
                    >
                      {v?.version || vid}
                    </span>
                    {v && (
                      <span>
                        {v.fileName} · {formatDateTime(v.uploadedAt)}
                      </span>
                    )}
                  </div>
                  {list.map((n) => (
                    <NoteCard
                      key={n.id}
                      note={n}
                      onDelete={handleDeleteNote}
                      isOldVersion={isOld}
                    />
                  ))}
                </div>
              );
            })}

            {dNotes.length === 0 && (
              <div className="panel p-8 text-center text-xs font-mono text-steel-500">
                暂无备注记录
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-steel-200">
                <Package className="w-4 h-4 text-[#E67E22]" />
                材料批次记录
              </h2>
              {missingCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 border-2 border-[#C0392B] bg-[#7B241C]/30 text-[#E74C3C]">
                  <AlertCircle className="w-3 h-3" />
                  缺料 {missingCount} 项
                </span>
              )}
            </div>
            <div className="space-y-1">
              {dMaterials.length === 0 ? (
                <div className="panel p-8 text-center text-xs font-mono text-steel-500">
                  暂无材料批次
                </div>
              ) : (
                dMaterials.map((m) => (
                  <MaterialRow
                    key={m.id}
                    material={m}
                    onMarkSupplied={handleMarkSupplied}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-stamp-in">
          <div className="panel-bordered px-4 py-3 border-[#27AE60] bg-[#186A3B]/80 text-[#2ECC71] text-xs font-mono uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {toast}
          </div>
        </div>
      )}

      {editorField && (
        <MetricEditor
          field={editorField}
          currentValue={drawing.metrics[editorField]}
          onSave={handleMetricEdit}
          onClose={() => setEditorField(null)}
        />
      )}
    </div>
  );
}

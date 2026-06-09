import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  RotateCcw,
  FileText,
  Scale,
  User,
  Clock,
  Image as ImageIcon,
  X,
  ShieldAlert,
  FileDown,
} from 'lucide-react';
import { usePetStore } from '@/store/petStore';
import { AnomalyBadge, ProgressLabel, JudgeLabel } from '@/components/Badges';
import { formatDate, EVENT_TYPE_LABEL, EVENT_SOURCE_LABEL, derivePets } from '@/utils/tracking';
import type { PetEvent, PetProfile } from '@/types';
import { AddNoteModal, RejudgeModal, EventDiffPanel } from '@/components/Modals';

const EVENT_ICON: Record<PetEvent['type'], React.ElementType> = {
  import: Camera,
  confirm: CheckCircle2,
  revoke: RotateCcw,
  addendum: FileText,
  rejudge: Scale,
};

const EVENT_COLOR: Record<PetEvent['type'], string> = {
  import: 'bg-sky-100 text-sky-700 border-sky-300',
  confirm: 'bg-sage-100 text-sage-700 border-sage-300',
  revoke: 'bg-slate-200 text-slate-600 border-slate-300',
  addendum: 'bg-amber-50 text-amber-700 border-amber-300',
  rejudge: 'bg-clay-50 text-clay-600 border-clay-300',
};

export default function PetDetail() {
  const { id = '' } = useParams();
  const eventsAll = usePetStore((s) => s.events);
  const confirmPet = usePetStore((s) => s.confirmPet);
  const addNote = usePetStore((s) => s.addNote);
  const rejudgePet = usePetStore((s) => s.rejudgePet);

  const { pet, events } = useMemo(() => {
    const pets = derivePets(eventsAll);
    const pet = pets.find((p) => p.petId === id);
    const evts = eventsAll
      .filter((e) => e.petId === id)
      .sort((a, b) => b.timestamp - a.timestamp);
    return { pet, events: evts };
  }, [eventsAll, id]);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showRejudge, setShowRejudge] = useState(false);

  if (!pet) {
    return (
      <div className="min-h-screen bg-paper p-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-parchment-200 bg-white p-8 text-center shadow-card">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-clay-500" />
          <h2 className="font-song text-xl font-bold text-slate-700">未找到该宠物档案</h2>
          <p className="mt-1 text-sm text-slate-500">该编号可能已被删除或从未存在。</p>
          <Link to="/" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-sage-600 px-4 py-2 text-sm text-white hover:bg-sage-700">
            <ArrowLeft className="h-4 w-4" />
            返回主列表
          </Link>
        </div>
      </div>
    );
  }

  const allPhotos: { url: string; fromEvent: PetEvent }[] = [];
  const seen = new Set<string>();
  for (const e of [...events].reverse()) {
    for (const url of e.snapshotAfter.photoUrls) {
      if (!seen.has(url)) {
        seen.add(url);
        allPhotos.push({ url, fromEvent: e });
      }
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-20">
      <header className="sticky top-0 z-30 border-b border-parchment-200 bg-parchment-100/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sage-200 bg-white px-3 py-1.5 text-sm text-sage-700 hover:bg-sage-50"
            >
              <ArrowLeft className="h-4 w-4" />
              主列表
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-song text-2xl font-bold text-sage-800">{pet.name}</h1>
                <span className="font-mono text-xs text-slate-400">{pet.petId}</span>
                <ProgressLabel progress={pet.trainingProgress} />
                <JudgeLabel judge={pet.trainingJudge} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {pet.species} · {pet.breed}
                {pet.aliases.length > 0 && (
                  <>
                    <span className="mx-2 text-slate-300">·</span>
                    别名：{pet.aliases.join('、')}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddNote(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sage-300 bg-white px-3.5 py-2 text-sm font-medium text-sage-700 shadow-sm hover:bg-sage-50"
            >
              <FileText className="h-4 w-4" />
              补录备注
            </button>
            <button
              onClick={() => setShowRejudge(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-clay-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-clay-600"
            >
              <Scale className="h-4 w-4" />
              人工改判
            </button>
            {!pet.confirmed && !pet.revoked && (
              <button
                onClick={() => confirmPet(pet.petId, '详情页确认归档')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sage-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-sage-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                确认
              </button>
            )}
            <Link
              to="/export"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <FileDown className="h-4 w-4" />
              导出
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1280px] grid-cols-[1fr_340px] gap-5 px-6 py-6">
        <section className="space-y-5">
          {pet.anomalies.length > 0 && (
            <div className="rounded-2xl border border-clay-200 bg-clay-50/60 p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-clay-700">
                <ShieldAlert className="h-4 w-4" />
                异常痕迹
                <span className="ml-1 text-xs font-normal text-clay-600">
                  （筛选/导出均保留下列痕迹）
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {pet.anomalies.map((a, i) => (
                  <AnomalyBadge key={i} anomaly={a} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-parchment-200 bg-white p-5 shadow-card">
            <h2 className="mb-4 font-song text-lg font-bold text-sage-800">
              <span className="mr-2">📜</span>历史时间线
              <span className="ml-2 text-xs font-normal text-slate-400">
                共 {events.length} 条事件 · 新 → 旧
              </span>
            </h2>
            <ol className="relative space-y-5 before:absolute before:left-[22px] before:top-1 before:bottom-1 before:w-0.5 before:bg-parchment-300 before:content-['']">
              {events.map((e) => (
                <TimelineItem key={e.id} event={e} />
              ))}
            </ol>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-parchment-200 bg-white p-4 shadow-card">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-sage-700">
              <ImageIcon className="h-4 w-4" />
              疫苗本照片留影
              <span className="ml-auto text-[11px] text-slate-400">{allPhotos.length} 张</span>
            </div>
            {allPhotos.length === 0 ? (
              <p className="rounded-lg bg-parchment-50 p-4 text-center text-xs text-slate-400">
                暂无照片
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {allPhotos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoPreview(p.url)}
                    title={`来自：${EVENT_TYPE_LABEL[p.fromEvent.type]} · ${formatDate(p.fromEvent.timestamp)}`}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-parchment-200 bg-slate-100 transition hover:shadow-md"
                  >
                    <img
                      src={p.url}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/70 to-transparent p-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                      {formatDate(p.fromEvent.timestamp).slice(5)}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-400">
              💡 疫苗本的旧版本截图和后来补的照片都会留在时间线里，不会被覆盖。
            </p>
          </div>

          <InfoBlock
            title="疫苗状态"
            icon={<ShieldAlert className="h-4 w-4" />}
            value={pet.vaccineStatus || '—'}
          />
          <InfoBlock
            title="最新备注"
            icon={<FileText className="h-4 w-4" />}
            value={pet.latestNote || '（无）'}
          />
          <InfoBlock
            title="确认状态"
            icon={<CheckCircle2 className="h-4 w-4" />}
            value={
              pet.revoked
                ? '已撤回（有撤回事件，档案不删除）'
                : pet.confirmed
                ? '已确认归档'
                : '待确认（仍可确认或撤回）'
            }
          />
        </aside>
      </main>

      {photoPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6"
          onClick={() => setPhotoPreview(null)}
        >
          <div className="relative max-h-full max-w-4xl">
            <button
              onClick={() => setPhotoPreview(null)}
              className="absolute -top-10 right-0 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={photoPreview}
              alt=""
              className="max-h-[80vh] rounded-xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      <AddNoteModal
        open={showAddNote}
        onClose={() => setShowAddNote(false)}
        petName={pet.name}
        onSubmit={(note, updates) => {
          addNote(pet.petId, note, updates);
        }}
      />
      <RejudgeModal
        open={showRejudge}
        onClose={() => setShowRejudge(false)}
        petName={pet.name}
        currentJudge={pet.trainingJudge}
        onSubmit={(oldJ, newJ, reason) => rejudgePet(pet.petId, oldJ, newJ, reason)}
      />
    </div>
  );
}

function TimelineItem({ event }: { event: PetEvent }) {
  const Icon = EVENT_ICON[event.type];
  const rejudge = event.type === 'rejudge' ? (event as any) : null;
  return (
    <li className="relative pl-14">
      <span
        className={`absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border-2 bg-white shadow-sm ${
          EVENT_COLOR[event.type]
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="rounded-xl border border-parchment-200 bg-white/90 p-4 shadow-sm transition hover:shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-song text-base font-bold text-sage-800">
            {EVENT_TYPE_LABEL[event.type]}
          </h3>
          {event.source && (
            <span className="rounded-full bg-parchment-100 px-2 py-0.5 text-[11px] text-slate-500">
              来源：{EVENT_SOURCE_LABEL[event.source] || event.source}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
            <Clock className="h-3 w-3" />
            {formatDate(event.timestamp)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <User className="h-3 w-3" />
          {event.operator}
        </div>

        {event.note && (
          <div className="mt-2 rounded-lg bg-parchment-50 p-2.5 text-sm text-slate-700">
            {event.note}
          </div>
        )}

        {rejudge && (
          <div className="mt-3 rounded-xl border border-clay-200 bg-clay-50/60 p-3">
            <div className="mb-1.5 text-xs font-semibold text-clay-700">⚖ 人工改判详情</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
              <div className="rounded-lg bg-white p-2 text-slate-400 line-through">
                旧：<b className="text-slate-500 no-underline">{rejudge.oldJudge}</b>
              </div>
              <span className="text-clay-500">→</span>
              <div className="rounded-lg bg-sage-50 p-2">
                新：<b className="text-sage-700">{rejudge.newJudge}</b>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              <b>改判说明：</b>
              {rejudge.rejudgeReason}
            </div>
          </div>
        )}

        <EventDiffPanel event={event} />
      </div>
    </li>
  );
}

function InfoBlock({
  title,
  icon,
  value,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-parchment-200 bg-white p-4 shadow-card">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-sage-700">
        {icon}
        {title}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{value}</p>
    </div>
  );
}

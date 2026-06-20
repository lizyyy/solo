import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  RotateCcw,
  FileText,
  Scale,
  Eye,
  ShieldAlert,
  FileDown,
  Upload,
  Sparkles,
  Clock,
  PawPrint,
  Loader2,
} from 'lucide-react';
import { usePetStore } from '@/store/petStore';
import { FilterPanel, applyFilter, type FilterState } from '@/components/FilterPanel';
import { AnomalyBadge, ProgressLabel, JudgeLabel, anomalyTypeLabel } from '@/components/Badges';
import { formatDate, EVENT_TYPE_LABEL, EVENT_SOURCE_LABEL } from '@/utils/tracking';
import type { DerivedPet } from '@/types';
import { AddNoteModal, RejudgeModal, RevokeModal, ImportModal } from '@/components/Modals';

const DEFAULT_FILTER: FilterState = {
  keyword: '',
  anomalyTypes: [],
  progress: 'all',
  judge: 'all',
  onlyConfirmed: 'all',
};

export default function Home() {
  const {
    pets,
    loading,
    loadPets,
    resetToDemo,
    clearAll,
    confirmPet,
    revokePet,
    addNote,
    rejudgePet,
    importPet,
  } = usePetStore();

  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [addendumFor, setAddendumFor] = useState<DerivedPet | null>(null);
  const [rejudgeFor, setRejudgeFor] = useState<DerivedPet | null>(null);
  const [revokeFor, setRevokeFor] = useState<DerivedPet | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [lastDiffToast, setLastDiffToast] = useState<{ count: number; petName: string } | null>(null);

  useEffect(() => {
    loadPets();
  }, [loadPets]);

  const apiFilter = useMemo(() => {
    if (filter.anomalyTypes.length === 1) {
      return { anomaly: filter.anomalyTypes[0], q: filter.keyword || undefined };
    }
    return filter.keyword ? { q: filter.keyword } : undefined;
  }, [filter]);

  useEffect(() => {
    loadPets(apiFilter);
  }, [apiFilter, loadPets]);

  const filtered = useMemo(() => applyFilter(pets, filter), [pets, filter]);

  const anomalyTotal = pets.filter((p) => p.anomalies.length > 0).length;
  const pendingCount = pets.filter((p) => !p.confirmed && !p.revoked).length;
  const rejudgeCount = pets.filter((p) => p.anomalies.some((a) => a.type === 'manual_rejudge')).length;
  const aliasConflictCount = pets.filter((p) =>
    p.anomalies.some((a) => a.type === 'alias_duplicate' || a.type === 'self_alias_duplicate'),
  ).length;

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-parchment-200 bg-parchment-100/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-600 text-white shadow-card">
              <PawPrint className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-song text-2xl font-bold tracking-wide text-sage-800">
                宠物训练课回访追踪
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                <span className="font-mono">事件溯源 · 全量留痕</span>
                <span className="mx-2 text-slate-300">·</span>
                导入 / 确认 / 撤回 / 补录 / 改判 统一写入同一份本地事件日志
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowImport(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sage-300 bg-white px-3.5 py-2 text-sm font-medium text-sage-700 shadow-sm transition hover:bg-sage-50"
            >
              <Upload className="h-4 w-4" />
              导入记录
            </button>
            <button
              onClick={async () => {
                await resetToDemo();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-parchment-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-parchment-50"
            >
              <RotateCcw className="h-4 w-4" />
              重置演示
            </button>
            <Link
              to="/export"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sage-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sage-700"
            >
              <FileDown className="h-4 w-4" />
              导出中心
            </Link>
          </div>
        </div>
        <div className="mx-auto grid max-w-[1400px] grid-cols-4 gap-3 px-6 pb-4">
          {[
            { label: '宠物总数', val: pets.length, icon: PawPrint, color: 'text-sage-700 bg-sage-100' },
            { label: '待确认', val: pendingCount, icon: Clock, color: 'text-amber-700 bg-amber-50' },
            { label: '别名冲突', val: aliasConflictCount, icon: ShieldAlert, color: 'text-clay-600 bg-clay-50' },
            { label: '人工改判', val: rejudgeCount, icon: Scale, color: 'text-sage-700 bg-sage-100' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-parchment-200 bg-white/80 p-3 shadow-card">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-mono text-2xl font-bold text-slate-800">{s.val}</div>
                <div className="text-[11px] text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </header>

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border border-parchment-200 bg-white px-6 py-4 shadow-card">
            <Loader2 className="h-5 w-5 animate-spin text-sage-600" />
            <span className="text-sm text-slate-600">正在从后端加载数据…</span>
          </div>
        </div>
      )}

      {lastDiffToast && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-sage-300 bg-white/95 px-5 py-3 shadow-card backdrop-blur">
          <div className="flex items-start gap-2 text-sm">
            <Sparkles className="mt-0.5 h-4 w-4 text-sage-600" />
            <div>
              <span className="font-semibold text-sage-700">补录成功</span>
              <span className="text-slate-600"> · </span>
              <span className="text-slate-700">
                对 <b>{lastDiffToast.petName}</b> 的补录会让导出产生 <b className="text-sage-700">{lastDiffToast.count}</b> 处差异，已在历史时间线留痕。
              </span>
            </div>
            <button
              onClick={() => setLastDiffToast(null)}
              className="ml-2 rounded px-1 text-slate-400 hover:bg-slate-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-[1400px] grid-cols-[280px_1fr] gap-5 px-6 py-6">
        <FilterPanel filter={filter} setFilter={setFilter} resultCount={filtered.length} />

        <section className="flex flex-col gap-4">
          {(filter.anomalyTypes.length > 0 || filter.keyword || filter.onlyConfirmed !== 'all' || filter.progress !== 'all' || filter.judge !== 'all') && (
            <div className="flex items-center justify-between rounded-xl border border-clay-200 bg-clay-50/70 px-4 py-2.5 text-sm text-clay-700 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                <span>
                  正在应用筛选条件，仅展示匹配的
                  <b className="mx-1">{filtered.length}</b>
                  条。
                  {filter.anomalyTypes.length > 0 && (
                    <span>
                      异常类型：
                      {filter.anomalyTypes.map((t) => anomalyTypeLabel(t)).join('、')}
                    </span>
                  )}
                  <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-xs text-clay-500">
                    ⚠ 导出时仍会保留完整异常列，便于后续复核
                  </span>
                </span>
              </div>
              <button
                onClick={() => setFilter(DEFAULT_FILTER)}
                className="rounded-md border border-clay-300 bg-white px-2.5 py-1 text-xs text-clay-700 hover:bg-clay-100"
              >
                清除筛选
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-parchment-200 bg-white shadow-card">
            <div className="grid grid-cols-[4px_1.1fr_1.1fr_90px_130px_130px_88px_1fr_280px] items-center gap-3 border-b border-parchment-200 bg-parchment-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <div />
              <div>宠物 / 别名</div>
              <div>品种</div>
              <div>疫苗</div>
              <div>训练进度</div>
              <div>评定</div>
              <div>状态</div>
              <div>最新备注</div>
              <div className="text-right">操作</div>
            </div>
            <ul className="divide-y divide-parchment-100">
              {filtered.map((pet) => (
                <PetRow
                  key={pet.petId}
                  pet={pet}
                  onAddNote={() => setAddendumFor(pet)}
                  onRejudge={() => setRejudgeFor(pet)}
                  onRevoke={() => setRevokeFor(pet)}
                  onConfirm={async () => {
                    await confirmPet(pet.petId, '手动确认归档');
                  }}
                  totalAnomalies={anomalyTotal}
                />
              ))}
              {filtered.length === 0 && (
                <li className="px-6 py-12 text-center text-sm text-slate-400">
                  没有匹配的记录。试试清除筛选条件，或点击右上角「导入记录」。
                </li>
              )}
            </ul>
          </div>

          <footer className="pb-10 pt-2 text-center text-[11px] text-slate-400">
            所有操作均以事件形式追加写入后端 SQLite 数据库，可随时点击「重置演示」恢复演示数据查看完整效果。
          </footer>
        </section>
      </main>

      {addendumFor && (
        <AddNoteModal
          open
          onClose={() => setAddendumFor(null)}
          petName={addendumFor.name}
          onSubmit={async (note, updates) => {
            const result = await addNote(addendumFor.petId, note, updates);
            if (result?.exportImpact?.changedFields) {
              setLastDiffToast({
                count: result.exportImpact.changedFields.length,
                petName: addendumFor.name,
              });
              setTimeout(() => setLastDiffToast(null), 6000);
            }
          }}
        />
      )}
      {rejudgeFor && (
        <RejudgeModal
          open
          onClose={() => setRejudgeFor(null)}
          petName={rejudgeFor.name}
          currentJudge={rejudgeFor.trainingJudge}
          onSubmit={async (oldJ, newJ, reason) => {
            await rejudgePet(rejudgeFor.petId, oldJ, newJ, reason);
          }}
        />
      )}
      {revokeFor && (
        <RevokeModal
          open
          onClose={() => setRevokeFor(null)}
          petName={revokeFor.name}
          onSubmit={async (reason) => {
            await revokePet(revokeFor.petId, reason);
          }}
        />
      )}
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onSubmit={async (profile, photos, note) => {
          await importPet(profile, 'vaccine_photo', photos, note);
        }}
      />
    </div>
  );
}

function PetRow({
  pet,
  onAddNote,
  onRejudge,
  onRevoke,
  onConfirm,
}: {
  pet: DerivedPet;
  onAddNote: () => void;
  onRejudge: () => void;
  onRevoke: () => void;
  onConfirm: () => void;
  totalAnomalies: number;
}) {
  const hasAnomaly = pet.anomalies.length > 0;
  return (
    <li
      className={`group relative grid grid-cols-[4px_1.1fr_1.1fr_90px_130px_130px_88px_1fr_280px] items-start gap-3 px-4 py-3 transition ${
        hasAnomaly ? 'bg-clay-50/30 hover:bg-clay-50/60' : 'hover:bg-sage-50/40'
      }`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1 ${
          pet.revoked
            ? 'bg-slate-300'
            : hasAnomaly
            ? 'bg-gradient-to-b from-clay-400 to-clay-300'
            : 'bg-sage-200'
        }`}
      />

      <div className="ml-3 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-song text-lg font-bold ${pet.revoked ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {pet.name}
          </span>
          <span className="font-mono text-[11px] text-slate-400">{pet.petId}</span>
          {pet.aliases.length > 0 && (
            <span className="text-xs text-slate-500">
              又名：
              <span className="text-slate-700">{pet.aliases.join('、')}</span>
            </span>
          )}
        </div>
        {pet.anomalies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pet.anomalies.map((a, i) => (
              <AnomalyBadge key={i} anomaly={a} />
            ))}
          </div>
        )}
        <div className="text-[11px] text-slate-400">
          {EVENT_TYPE_LABEL['import']} · {formatDate(pet.lastModifiedAt)} · {pet.eventCount} 条事件
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-medium text-slate-700">
          {pet.species} · {pet.breed}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Camera className="h-3 w-3" />
          {pet.photoUrls.length} 张留影
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div
          className={`h-2 w-2 rounded-full ${
            pet.vaccineStatus.includes('狂犬') || pet.vaccineStatus.includes('4') || pet.vaccineStatus.includes('5')
              ? 'bg-sage-500'
              : pet.vaccineStatus
              ? 'bg-amber-400'
              : 'bg-slate-300'
          }`}
        />
        <span className="mt-1 text-[10px] text-slate-500">
          {pet.vaccineStatus ? (pet.vaccineStatus.includes('狂犬') ? '齐全' : '部分') : '无'}
        </span>
      </div>

      <div><ProgressLabel progress={pet.trainingProgress} /></div>
      <div><JudgeLabel judge={pet.trainingJudge} /></div>

      <div className="space-y-0.5 text-[11px]">
        {pet.revoked ? (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
            <RotateCcw className="h-3 w-3" /> 已撤回
          </span>
        ) : pet.confirmed ? (
          <span className="inline-flex items-center gap-1 rounded bg-sage-50 px-1.5 py-0.5 text-sage-700">
            <CheckCircle2 className="h-3 w-3" /> 已确认
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
            <Clock className="h-3 w-3" /> 待确认
          </span>
        )}
      </div>

      <div className="line-clamp-2 text-xs leading-relaxed text-slate-600">
        {pet.latestNote || <span className="text-slate-300">（无备注）</span>}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Link
          to={`/pet/${pet.petId}`}
          className="inline-flex items-center gap-1 rounded-md border border-sage-200 bg-white px-2 py-1 text-xs text-sage-700 hover:bg-sage-50"
        >
          <Eye className="h-3 w-3" />
          时间线
        </Link>
        <button
          onClick={onAddNote}
          className="inline-flex items-center gap-1 rounded-md border border-sage-200 bg-white px-2 py-1 text-xs text-sage-700 hover:bg-sage-50"
        >
          <FileText className="h-3 w-3" />
          补录
        </button>
        <button
          onClick={onRejudge}
          className="inline-flex items-center gap-1 rounded-md border border-clay-300 bg-clay-50 px-2 py-1 text-xs text-clay-700 hover:bg-clay-100"
        >
          <Scale className="h-3 w-3" />
          改判
        </button>
        {!pet.confirmed && !pet.revoked && (
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-1 rounded-md bg-sage-600 px-2 py-1 text-xs text-white hover:bg-sage-700"
          >
            <CheckCircle2 className="h-3 w-3" />
            确认
          </button>
        )}
        {!pet.revoked && (
          <button
            onClick={onRevoke}
            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
          >
            <RotateCcw className="h-3 w-3" />
            撤回
          </button>
        )}
      </div>
    </li>
  );
}

import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, ArrowRight } from 'lucide-react';
import type { TrainingJudge, PetProfile } from '@/types';
import { JudgeLabel } from '@/components/Badges';
import { computeSnapshotDiffs } from '@/utils/tracking';
import { EMPTY_PROFILE } from '@/data/demoEvents';
import type { PetEvent } from '@/types';

type BaseProps = {
  open: boolean;
  onClose: () => void;
};

export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  accent = 'sage',
}: BaseProps & {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: 'sage' | 'clay' | 'slate';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const accentRing = {
    sage: 'ring-sage-100',
    clay: 'ring-clay-100',
    slate: 'ring-slate-100',
  }[accent];
  const accentTitle = {
    sage: 'text-sage-800',
    clay: 'text-clay-600',
    slate: 'text-slate-800',
  }[accent];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full max-w-2xl rounded-2xl border border-parchment-200 bg-parchment-50 shadow-card ring-8 ${accentRing}`}>
        <div className="flex items-start justify-between border-b border-parchment-200 px-6 py-4">
          <div>
            <h2 className={`font-song text-xl font-bold ${accentTitle}`}>{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function AddNoteModal({
  open,
  onClose,
  petName,
  onSubmit,
}: BaseProps & {
  petName: string;
  onSubmit: (note: string, updates: Partial<PetProfile>) => void;
}) {
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState<PetProfile['trainingProgress'] | ''>('');
  const [judge, setJudge] = useState<TrainingJudge | ''>('');
  const [vaccine, setVaccine] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setNote('');
      setProgress('');
      setJudge('');
      setVaccine('');
      setPhotoUrl('');
      setNewAlias('');
      setAliases([]);
    }
  }, [open]);

  const canSubmit = note.trim().length > 0;
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={`补录备注 · ${petName}`}
      subtitle="主人临时补充的信息，系统将对比旧值留痕，导出时自动说明变化位置"
      accent="sage"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
            <AlertCircle className="h-3.5 w-3.5 text-sage-600" />
            补录内容 <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="例如：主人微信补充，2025-01 已接种加强针，附新疫苗本截图…"
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">训练进度</label>
            <select
              value={progress}
              onChange={(e) => setProgress(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-sage-400"
            >
              <option value="">不变更</option>
              <option>未开始</option>
              <option>进行中</option>
              <option>已完成</option>
              <option>中止</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">训练评定</label>
            <select
              value={judge}
              onChange={(e) => setJudge(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-sage-400"
            >
              <option value="">不变更</option>
              <option>待评定</option>
              <option>合格</option>
              <option>不合格</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">疫苗状态更新</label>
          <input
            value={vaccine}
            onChange={(e) => setVaccine(e.target.value)}
            placeholder="留空表示不更新，例如：已接种 4 针（含加强针 2025-01）"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sage-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">新增别名（多个用顿号分隔）</label>
          <div className="flex gap-2">
            <input
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const parts = newAlias.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
                  if (parts.length) setAliases([...aliases, ...parts]);
                  setNewAlias('');
                }
              }}
              placeholder="输入后回车，例如：小豆、胖丁"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sage-400"
            />
            <button
              type="button"
              onClick={() => {
                const parts = newAlias.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
                if (parts.length) setAliases([...aliases, ...parts]);
                setNewAlias('');
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-sage-50"
            >
              添加
            </button>
          </div>
          {aliases.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {aliases.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-xs text-sage-700"
                >
                  {a}
                  <button onClick={() => setAliases(aliases.filter((_, j) => j !== i))} className="text-sage-500 hover:text-rose-600">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">疫苗本照片/截图 URL（可选）</label>
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://…  （演示环境使用公开图片链接）"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sage-400"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-parchment-200 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => {
              const updates: Partial<PetProfile> = {};
              if (progress) updates.trainingProgress = progress;
              if (judge) updates.trainingJudge = judge;
              if (vaccine) updates.vaccineStatus = vaccine;
              if (aliases.length) updates.aliases = aliases;
              if (photoUrl) updates.photoUrls = [photoUrl];
              onSubmit(note.trim(), updates);
              onClose();
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
              canSubmit ? 'bg-sage-600 hover:bg-sage-700' : 'cursor-not-allowed bg-slate-300'
            }`}
          >
            <Save className="h-4 w-4" />
            保存补录（自动写入历史）
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function RejudgeModal({
  open,
  onClose,
  petName,
  currentJudge,
  onSubmit,
}: BaseProps & {
  petName: string;
  currentJudge: TrainingJudge;
  onSubmit: (oldJ: TrainingJudge, newJ: TrainingJudge, reason: string) => void;
}) {
  const [newJudge, setNewJudge] = useState<TrainingJudge>('待评定');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setNewJudge(currentJudge === '合格' ? '不合格' : currentJudge === '不合格' ? '合格' : '合格');
      setReason('');
    }
  }, [open, currentJudge]);

  const canSubmit = reason.trim().length >= 8 && newJudge !== currentJudge;
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={`人工改判 · ${petName}`}
      subtitle="旧判断、新判断与改判说明将永久写入历史时间线，导出时自动留痕"
      accent="clay"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-parchment-200 bg-white/70 p-4">
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">旧判断（即将覆盖）</div>
            <div className="rounded-lg bg-slate-100 p-3">
              <div className="text-slate-400 line-through">
                <JudgeLabel judge={currentJudge} />
              </div>
              <div className="mt-1 text-xs text-slate-400">{currentJudge}</div>
            </div>
          </div>
          <div className="text-clay-500">
            <ArrowRight className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-sage-500">新判断</div>
            <div className="space-y-1.5">
              {(['合格', '不合格', '待评定'] as TrainingJudge[]).map((j) => (
                <label
                  key={j}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition ${
                    newJudge === j
                      ? 'border-sage-400 bg-sage-50 ring-2 ring-sage-100'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    checked={newJudge === j}
                    onChange={() => setNewJudge(j)}
                    className="h-4 w-4 accent-sage-600"
                  />
                  <JudgeLabel judge={j} />
                </label>
              ))}
            </div>
          </div>
        </div>

        {newJudge === currentJudge && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            ⚠ 新判断与旧判断一致，无需改判。请选择不同的评定结果。
          </div>
        )}

        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
            <AlertCircle className="h-3.5 w-3.5 text-clay-500" />
            改判说明 <span className="text-rose-500">*</span>
            <span className="ml-auto text-slate-400">至少 8 字</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="必须说明改判的客观依据：主人提供的录像/病历/训练师复核意见，以及原判断偏差原因…"
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-clay-400 focus:ring-2 focus:ring-clay-100"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-parchment-200 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => {
              onSubmit(currentJudge, newJudge, reason.trim());
              onClose();
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
              canSubmit ? 'bg-clay-500 hover:bg-clay-600' : 'cursor-not-allowed bg-slate-300'
            }`}
          >
            确认改判（写入历史）
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function RevokeModal({
  open,
  onClose,
  petName,
  onSubmit,
}: BaseProps & {
  petName: string;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const canSubmit = reason.trim().length >= 4;
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={`撤回记录 · ${petName}`}
      subtitle="撤回不会删除历史，只会新增一条撤回事件写入时间线"
      accent="clay"
    >
      <div className="space-y-4">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="撤回原因（至少 4 字）：例如「旧版疫苗本照片与原件不符，作废」"
          className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-clay-400 focus:ring-2 focus:ring-clay-100"
        />
        <div className="flex items-center justify-end gap-2 border-t border-parchment-200 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => {
              onSubmit(reason.trim());
              onClose();
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
              canSubmit ? 'bg-rose-600 hover:bg-rose-700' : 'cursor-not-allowed bg-slate-300'
            }`}
          >
            确认撤回
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function ImportModal({
  open,
  onClose,
  onSubmit,
}: BaseProps & {
  onSubmit: (profile: PetProfile, photoUrls: string[], note: string) => void;
}) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetProfile['species']>('狗');
  const [breed, setBreed] = useState('');
  const [aliases, setAliases] = useState('');
  const [vaccine, setVaccine] = useState('');
  const [progress, setProgress] = useState<PetProfile['trainingProgress']>('未开始');
  const [judge, setJudge] = useState<PetProfile['trainingJudge']>('待评定');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setSpecies('狗');
      setBreed('');
      setAliases('');
      setVaccine('');
      setProgress('未开始');
      setJudge('待评定');
      setNote('');
      setPhoto('');
    }
  }, [open]);

  const canSubmit = name.trim() && breed.trim();
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="导入疫苗本 / 训练记录"
      subtitle="将作为一条 import 事件写入时间线，后续变更均保留完整快照"
      accent="sage"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">宠物名 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sage-400"
            placeholder="例如：豆豆"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">别名（顿号分隔）</label>
          <input
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sage-400"
            placeholder="豆包、小胖…"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">种类</label>
          <select
            value={species}
            onChange={(e) => setSpecies(e.target.value as any)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-sage-400"
          >
            <option>狗</option>
            <option>猫</option>
            <option>其他</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">品种 *</label>
          <input
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sage-400"
            placeholder="柯基 / 英短…"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">训练进度</label>
          <select
            value={progress}
            onChange={(e) => setProgress(e.target.value as any)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-sage-400"
          >
            <option>未开始</option>
            <option>进行中</option>
            <option>已完成</option>
            <option>中止</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">训练评定</label>
          <select
            value={judge}
            onChange={(e) => setJudge(e.target.value as any)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-sage-400"
          >
            <option>待评定</option>
            <option>合格</option>
            <option>不合格</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">疫苗状态</label>
          <input
            value={vaccine}
            onChange={(e) => setVaccine(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sage-400"
            placeholder="例如：已接种 3 针（疫苗本照片 2024-11）"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">疫苗本照片 URL（可选）</label>
          <input
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sage-400"
            placeholder="https://…"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">导入备注</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-sage-400"
            placeholder="例如：首次导入疫苗本照片「柯基-豆豆-20241115.jpg」"
          />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-parchment-200 pt-4">
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          取消
        </button>
        <button
          disabled={!canSubmit}
          onClick={() => {
            const profile: PetProfile = {
              ...EMPTY_PROFILE,
              name: name.trim(),
              species,
              breed: breed.trim(),
              aliases: aliases
                .split(/[、,，]/)
                .map((s) => s.trim())
                .filter(Boolean),
              vaccineStatus: vaccine.trim(),
              trainingProgress: progress,
              trainingJudge: judge,
              confirmed: false,
              revoked: false,
            };
            const photos = photo.trim() ? [photo.trim()] : [];
            onSubmit(profile, photos, note.trim() || `导入：${name.trim()}`);
            onClose();
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white ${
            canSubmit ? 'bg-sage-600 hover:bg-sage-700' : 'cursor-not-allowed bg-slate-300'
          }`}
        >
          导入（写入历史）
        </button>
      </div>
    </ModalShell>
  );
}

export function EventDiffPanel({ event }: { event: PetEvent }) {
  const diffs = computeSnapshotDiffs(event);
  if (!diffs.length) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-parchment-200">
      <table className="w-full text-xs">
        <thead className="bg-parchment-100 text-slate-600">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium">字段</th>
            <th className="px-3 py-1.5 text-left font-medium">变更前</th>
            <th className="w-6"></th>
            <th className="px-3 py-1.5 text-left font-medium">变更后</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-parchment-100 bg-white">
          {diffs.map((d, i) => (
            <tr key={i}>
              <td className="px-3 py-2 font-medium text-sage-800">{d.field}</td>
              <td className="px-3 py-2 text-slate-400 line-through">
                <div className="max-w-[40ch] break-words">{d.before}</div>
              </td>
              <td className="text-slate-300">→</td>
              <td className="px-3 py-2 text-slate-800">
                <div className="max-w-[40ch] break-words">{d.after}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

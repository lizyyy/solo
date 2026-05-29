import { useState, useRef } from 'react';
import { usePropStore } from '@/store';
import { statusLabel, entryTypeLabel } from '@/utils/report';
import type { EntryType } from '@/types';
import {
  PlusCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Camera,
  Undo2,
  Clock,
  LogIn,
  X,
} from 'lucide-react';

const inputCls =
  'w-full rounded-lg bg-[#12121f] border border-[#2a2a45] px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#d4a843] transition';

function toLocalDatetime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Entry() {
  const store = usePropStore();

  const [entryMode, setEntryMode] = useState<EntryType>('normal');
  const [propId, setPropId] = useState('');
  const [sceneNumber, setSceneNumber] = useState('');
  const [borrower, setBorrower] = useState('');
  const [borrowTime, setBorrowTime] = useState(toLocalDatetime(new Date().toISOString()));
  const [expectedReturnTime, setExpectedReturnTime] = useState('');

  const [damageOpen, setDamageOpen] = useState(false);
  const [damageDesc, setDamageDesc] = useState('');
  const [damagePhotoUrl, setDamagePhotoUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [duplicateAlert, setDuplicateAlert] = useState<{
    show: boolean;
    duplicateIds: string[];
  }>({ show: false, duplicateIds: [] });

  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnTime, setReturnTime] = useState(toLocalDatetime(new Date().toISOString()));
  const [returnResult, setReturnResult] = useState<{
    recordId: string;
    isLate: boolean;
  } | null>(null);

  const sceneNumbers = store.sceneSchedule.map((s) => s.sceneNumber);
  const activeBorrows = store.borrowRecords.filter(
    (r) =>
      (r.status === 'borrowed' || r.status === 'on_stage') &&
      !r.isWithdrawn
  );
  const recentRecords = [...store.borrowRecords]
    .sort((a, b) => (a.id > b.id ? -1 : 1))
    .slice(0, 10);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDamagePhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function resetForm() {
    setPropId('');
    setSceneNumber('');
    setBorrower('');
    setBorrowTime(toLocalDatetime(new Date().toISOString()));
    setExpectedReturnTime('');
    setDamageDesc('');
    setDamagePhotoUrl('');
    setDamageOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propId || !borrower || !borrowTime || !expectedReturnTime) return;

    const result = store.createBorrowRecord({
      propId,
      sceneNumber,
      borrower,
      borrowTime: new Date(borrowTime).toISOString(),
      expectedReturnTime: new Date(expectedReturnTime).toISOString(),
      actualReturnTime: '',
      entryType: entryMode,
    });

    if (!result.success) {
      setDuplicateAlert({ show: true, duplicateIds: result.duplicateIds });
    }

    if (damageDesc && result.recordId) {
      store.addDamageRecord({
        borrowRecordId: result.recordId,
        description: damageDesc,
        photoUrl: damagePhotoUrl,
      });
    }

    resetForm();
  }

  function handleReturnSubmit(recordId: string) {
    const result = store.registerReturn(recordId, new Date(returnTime).toISOString());
    setReturnResult({ recordId, isLate: result.isLate });
    setReturningId(null);
    setReturnTime(toLocalDatetime(new Date().toISOString()));
  }

  function handleWithdraw(recordId: string) {
    if (confirm('确定要撤回该记录吗？')) {
      store.withdrawRecord(recordId);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-gray-200 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-[#d4a843] flex items-center gap-2">
          <PlusCircle className="w-6 h-6" />
          道具录入
        </h1>

        {/* Entry Mode Switcher */}
        <div className="flex gap-3">
          <button
            onClick={() => setEntryMode('normal')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              entryMode === 'normal'
                ? 'bg-[#d4a843] text-[#0f0f1a]'
                : 'bg-[#1e1e32] text-gray-400 hover:text-gray-200'
            }`}
          >
            <RotateCcw className="w-4 h-4 inline mr-1" />
            正常录入
          </button>
          <button
            onClick={() => setEntryMode('supplement')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              entryMode === 'supplement'
                ? 'bg-[#d4a843] text-[#0f0f1a]'
                : 'bg-[#1e1e32] text-gray-400 hover:text-gray-200'
            }`}
          >
            <PlusCircle className="w-4 h-4 inline mr-1" />
            补录
          </button>
        </div>

        {entryMode === 'supplement' && (
          <div className="rounded-lg bg-amber-900/30 border border-amber-700/50 px-4 py-3 text-sm text-amber-300">
            补录模式：请填写实际发生的时间，系统会保留原始记录值
          </div>
        )}

        {/* Duplicate Borrow Alert */}
        {duplicateAlert.show && (
          <div className="rounded-lg bg-red-900/40 border border-red-600/60 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-red-300">
                  ⚠️ 重复借出拦截：该道具已有活跃借出记录，已标记为待复核
                </p>
                <p className="text-red-400 mt-1">
                  重复记录 ID：{duplicateAlert.duplicateIds.join('、')}
                </p>
              </div>
              <button
                onClick={() => setDuplicateAlert({ show: false, duplicateIds: [] })}
                className="text-red-400 hover:text-red-300 ml-auto shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Basic Info Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-[#1e1e32] p-5">
          <div>
            <label className="mb-1 block text-sm text-gray-400">道具选择</label>
            {store.props.length === 0 ? (
              <p className="text-sm text-amber-400">请先导入样例数据</p>
            ) : (
              <select
                value={propId}
                onChange={(e) => setPropId(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">-- 请选择道具 --</option>
                {store.props.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{p.code}）
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">场次</label>
            <input
              type="text"
              list="scene-options"
              value={sceneNumber}
              onChange={(e) => setSceneNumber(e.target.value)}
              className={inputCls}
              placeholder="输入或选择场次"
            />
            <datalist id="scene-options">
              {sceneNumbers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">借用人</label>
            <input
              type="text"
              value={borrower}
              onChange={(e) => setBorrower(e.target.value)}
              className={inputCls}
              placeholder="输入借用人姓名"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">借出时间</label>
            <input
              type="datetime-local"
              value={borrowTime}
              onChange={(e) => setBorrowTime(e.target.value)}
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">预计返库时间</label>
            <input
              type="datetime-local"
              value={expectedReturnTime}
              onChange={(e) => setExpectedReturnTime(e.target.value)}
              className={inputCls}
              required
            />
          </div>

          {/* Damage Section */}
          <div className="rounded-lg border border-[#2a2a45] overflow-hidden">
            <button
              type="button"
              onClick={() => setDamageOpen(!damageOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm text-gray-300 hover:text-[#d4a843] transition"
            >
              <span className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                损伤记录（可选）
              </span>
              {damageOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {damageOpen && (
              <div className="space-y-3 border-t border-[#2a2a45] px-4 py-3">
                <div>
                  <label className="mb-1 block text-sm text-gray-400">损伤描述</label>
                  <textarea
                    value={damageDesc}
                    onChange={(e) => setDamageDesc(e.target.value)}
                    className={inputCls + ' min-h-[80px] resize-y'}
                    placeholder="描述损伤情况"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-400">损伤照片</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-[#2a2a45] file:text-gray-300 hover:file:bg-[#3a3a55] file:cursor-pointer cursor-pointer"
                  />
                  {damagePhotoUrl && (
                    <div className="mt-2">
                      <img
                        src={damagePhotoUrl}
                        alt="损伤预览"
                        className="h-24 w-24 rounded-md object-cover border border-[#2a2a45]"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-[#d4a843] py-2.5 text-sm font-semibold text-[#0f0f1a] hover:bg-[#c4983a] transition"
          >
            提交录入
          </button>
        </form>

        {/* Return Registration Section */}
        <section className="rounded-xl bg-[#1e1e32] p-5 space-y-4">
          <h2 className="text-lg font-semibold text-[#d4a843] flex items-center gap-2">
            <LogIn className="w-5 h-5" />
            登记返库
          </h2>

          {returnResult && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                returnResult.isLate
                  ? 'bg-red-900/30 border border-red-700/50 text-red-300'
                  : 'bg-green-900/30 border border-green-700/50 text-green-300'
              }`}
            >
              {returnResult.isLate
                ? '⚠️ 返库超时，已标记为待复核'
                : '✅ 正常返库'}
              <button
                onClick={() => setReturnResult(null)}
                className="ml-2 underline text-current opacity-70 hover:opacity-100"
              >
                关闭
              </button>
            </div>
          )}

          {activeBorrows.length === 0 ? (
            <p className="text-sm text-gray-500">暂无活跃借出记录</p>
          ) : (
            <ul className="space-y-3">
              {activeBorrows.map((r) => {
                const prop = store.getPropById(r.propId);
                return (
                  <li
                    key={r.id}
                    className="rounded-lg border border-[#2a2a45] p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm space-y-0.5">
                        <p className="font-medium text-gray-200">
                          {prop?.name || r.propId}
                          <span className="ml-2 text-xs text-gray-500">
                            {prop?.code}
                          </span>
                        </p>
                        <p className="text-gray-400">
                          场次：{r.sceneNumber || '—'} ｜ 借用人：{r.borrower}
                        </p>
                        <p className="text-gray-500 text-xs">
                          <Clock className="w-3 h-3 inline mr-1" />
                          借出：{r.borrowTime ? new Date(r.borrowTime).toLocaleString() : '—'}
                        </p>
                        <p className="text-gray-500 text-xs">
                          预计返库：{r.expectedReturnTime ? new Date(r.expectedReturnTime).toLocaleString() : '—'}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#2a2a45] px-2 py-0.5 text-xs text-gray-400">
                        {statusLabel(r.status)}
                      </span>
                    </div>

                    {returningId === r.id ? (
                      <div className="flex items-end gap-2 pt-1">
                        <div className="flex-1">
                          <label className="mb-1 block text-xs text-gray-500">
                            实际返库时间
                          </label>
                          <input
                            type="datetime-local"
                            value={returnTime}
                            onChange={(e) => setReturnTime(e.target.value)}
                            className={inputCls + ' text-xs'}
                          />
                        </div>
                        <button
                          onClick={() => handleReturnSubmit(r.id)}
                          className="rounded-md bg-[#d4a843] px-3 py-2 text-xs font-medium text-[#0f0f1a] hover:bg-[#c4983a] transition"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => {
                            setReturningId(null);
                          }}
                          className="rounded-md bg-[#2a2a45] px-3 py-2 text-xs text-gray-400 hover:text-gray-200 transition"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReturningId(r.id);
                          setReturnTime(toLocalDatetime(new Date().toISOString()));
                        }}
                        className="rounded-md bg-[#2a2a45] px-3 py-1.5 text-xs text-[#d4a843] hover:bg-[#3a3a55] transition"
                      >
                        <LogIn className="w-3.5 h-3.5 inline mr-1" />
                        登记返库
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Withdraw Section */}
        <section className="rounded-xl bg-[#1e1e32] p-5 space-y-4">
          <h2 className="text-lg font-semibold text-[#d4a843] flex items-center gap-2">
            <Undo2 className="w-5 h-5" />
            最近记录撤回
          </h2>

          {recentRecords.length === 0 ? (
            <p className="text-sm text-gray-500">暂无记录</p>
          ) : (
            <ul className="space-y-2">
              {recentRecords.map((r) => {
                const prop = store.getPropById(r.propId);
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#2a2a45] px-3 py-2"
                  >
                    <div className="text-sm min-w-0">
                      <span className="font-medium text-gray-200">
                        {prop?.name || r.propId}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {r.borrower} · {statusLabel(r.status)} · {entryTypeLabel(r.entryType)}
                      </span>
                    </div>
                    {!r.isWithdrawn ? (
                      <button
                        onClick={() => handleWithdraw(r.id)}
                        className="shrink-0 rounded-md bg-[#2a2a45] px-2.5 py-1 text-xs text-red-400 hover:bg-red-900/30 transition"
                      >
                        <Undo2 className="w-3 h-3 inline mr-1" />
                        撤回
                      </button>
                    ) : (
                      <span className="shrink-0 text-xs text-gray-600">已撤回</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

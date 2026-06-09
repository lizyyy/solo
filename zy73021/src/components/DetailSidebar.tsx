import { useState } from 'react';
import { X, Send, Plus, UploadCloud, AlertTriangle, CheckCircle2, RotateCcw, Download } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { AbnormalAlert, AlertStatus } from '@/types';
import { SEVERITY_LABEL, STATUS_LABEL, OPERATORS } from '@/types';
import { severityColor, statusColor, formatDateTime } from '@/utils/format';
import TimelineView from './TimelineView';
import MiniWeightChart from './MiniWeightChart';
import MedicationDialog from './MedicationDialog';
import { generateCsv, downloadCsv, fileTimestamp } from '@/utils/csv';
import { formatDate } from '@/utils/format';

export default function DetailSidebar({ alert, onClose }: { alert: AbnormalAlert; onClose: () => void }) {
  const pet = alert.pet!;
  const [note, setNote] = useState('');
  const [material, setMaterial] = useState('');
  const [showMedDialog, setShowMedDialog] = useState(false);
  const [rerunResult, setRerunResult] = useState<{ ok: boolean; gaps: string[] } | null>(null);
  const [exportResult, setExportResult] = useState<string | null>(null);

  const addNote = useAppStore((s) => s.addNote);
  const supplementMaterial = useAppStore((s) => s.supplementMaterial);
  const changeMedication = useAppStore((s) => s.changeMedication);
  const addVaccinePhotos = useAppStore((s) => s.addVaccinePhotos);
  const rerun = useAppStore((s) => s.rerunJudgment);
  const updateStatus = useAppStore((s) => s.updateStatus);
  const exportCsvRows = useAppStore((s) => s.exportCsvRows);
  const validate = useAppStore((s) => s.validateHistoryContinuity);
  const user = useAppStore((s) => s.currentUser);

  const sev = severityColor(alert.severity);
  const st = statusColor(alert.currentStatus);
  const validation = validate(alert);

  const submitNote = () => {
    const v = note.trim();
    if (!v) return;
    addNote(alert.id, v);
    setNote('');
  };

  const submitMaterial = () => {
    const v = material.trim();
    if (!v) return;
    supplementMaterial(alert.id, v);
    setMaterial('');
  };

  const handleRerun = () => {
    const res = rerun(alert.id);
    setRerunResult(res);
    setTimeout(() => setRerunResult(null), 5000);
  };

  const handleUploadDemo = () => {
    const demoUrls = [
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=veterinary%20document%20paper%20form%20blue%20stamp&image_size=square',
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=pet%20health%20record%20booklet%20page&image_size=square',
    ];
    addVaccinePhotos(
      alert.id,
      demoUrls.map((u, i) => ({
        url: u,
        remark: i === 0 ? '现场演示上传：补登页' : '现场演示上传：处方页',
      })),
    );
  };

  const handleExportThis = () => {
    const rows = exportCsvRows().filter((r) => r.id === alert.id);
    const maxV = Math.max(...rows.map((r) => r.judgmentVersion), alert.judgmentVersion);
    const csv = generateCsv(rows, maxV);
    const fname = `宠物减重异常_${pet.name}_${fileTimestamp()}_v${maxV}.csv`;
    downloadCsv(fname, csv);
    setExportResult(`✅ 已导出单条CSV：${fname}（与页面同源，判断版本 v${maxV}）`);
    setTimeout(() => setExportResult(null), 5000);
  };

  return (
    <div className="w-[520px] shrink-0 h-[calc(100vh-88px)] bg-white rounded-xl shadow-panel border border-slate-100 flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white">
        <div className="flex items-start gap-3">
          <img src={pet.avatarUrl} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-card" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold text-slate-800">
                {pet.name}
                <span className="ml-2 text-sm font-sans font-normal text-slate-500">
                  {pet.species} · {pet.breed} · {pet.age}岁
                </span>
              </h2>
              <button
                onClick={onClose}
                className="btn-ghost !p-1.5 hover:bg-slate-100"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className={`chip ${sev.bg} ${sev.text} border ${sev.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                {SEVERITY_LABEL[alert.severity]} · 减重 {alert.weightLossPct.toFixed(1)}%
              </span>
              <span className={`chip ${st.bg} ${st.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                {STATUS_LABEL[alert.currentStatus]}
              </span>
              <span className="chip bg-white text-slate-600 border border-slate-200">
                判断 v{alert.judgmentVersion}
              </span>
              <span
                className={`chip border ${validation.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}
              >
                {validation.ok ? (
                  <><CheckCircle2 size={10} /> 历史连续</>
                ) : (
                  <><AlertTriangle size={10} /> 历史断档</>
                )}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap gap-x-4">
              <span>主人：{pet.ownerName} · {pet.ownerPhone}</span>
              <span>提醒日期：{alert.alertDate}</span>
              <span>负责人：{alert.assignedTo}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 迷你趋势图 */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="section-title">体重趋势</h3>
            <span className="text-xs text-slate-500">{alert.weightRecords?.length ?? 0} 次称重</span>
          </div>
          {alert.weightRecords && alert.weightRecords.length > 0 ? (
            <div className="card p-3 bg-slate-50/50">
              <MiniWeightChart records={alert.weightRecords} width={440} height={96} />
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                <div className="p-2 rounded bg-white border border-slate-100">
                  <div className="text-slate-500">起始体重</div>
                  <div className="font-serif font-bold text-base text-slate-800">
                    {alert.weightRecords[0].weightKg}kg
                    <span className="ml-1 text-[10px] text-slate-400 font-sans">({formatDate(alert.weightRecords[0].weighDate)})</span>
                  </div>
                </div>
                <div className="p-2 rounded bg-white border border-slate-100">
                  <div className="text-slate-500">最新体重</div>
                  <div className="font-serif font-bold text-base text-rose-600">
                    {alert.weightRecords[alert.weightRecords.length - 1].weightKg}kg
                    <span className="ml-1 text-[10px] text-slate-400 font-sans">
                      ({formatDate(alert.weightRecords[alert.weightRecords.length - 1].weighDate)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-sm italic">暂无称重记录</div>
          )}
        </section>

        {/* 当前用药 */}
        <section>
          <h3 className="section-title mb-2 flex items-center justify-between">
            <span>当前用药</span>
            <button
              className="text-xs text-warn hover:text-amber-700 font-medium flex items-center gap-1 transition"
              onClick={() => setShowMedDialog(true)}
            >
              <AlertTriangle size={12} />
              修改剂量
            </button>
          </h3>
          {alert.currentMedication ? (
            <div className="card p-3 bg-amber-50/40 border border-amber-100">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="label">药品</div>
                  <div className="font-medium text-slate-800 text-sm">{alert.currentMedication.drugName}</div>
                </div>
                <div>
                  <div className="label">剂量</div>
                  <div className="font-medium text-slate-800 text-sm">{alert.currentMedication.dosage}</div>
                </div>
                <div>
                  <div className="label">开始日期</div>
                  <div className="font-medium text-slate-800 text-sm">{alert.currentMedication.startDate}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic p-3 border border-dashed border-slate-200 rounded-lg">
              暂无持续用药记录
            </div>
          )}
        </section>

        {/* 追加备注 */}
        <section>
          <h3 className="section-title mb-2 flex items-center justify-between">
            追加人工备注
            <span className="text-[10px] text-slate-400 font-normal">以时间线形式追加，旧备注永不覆盖</span>
          </h3>
          <div className="space-y-2">
            <textarea
              className="input min-h-[72px] resize-y"
              placeholder={`以「${user}」身份追加备注，会写入时间线...`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                onClick={submitNote}
                disabled={!note.trim()}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={14} />
                追加备注
              </button>
            </div>
          </div>
          {(alert.notes?.length ?? 0) > 0 && (
            <div className="mt-3 space-y-2">
              {(alert.notes ?? [])
                .slice()
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((n) => (
                  <div key={n.id} className="p-3 rounded-lg bg-sky-50/60 border border-sky-100 text-sm">
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <span className="font-medium text-sky-700">{n.author}</span>
                      <span className="text-slate-400">{formatDateTime(n.createdAt)}</span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap">{n.content}</p>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* 补录材料 */}
        <section>
          <h3 className="section-title mb-2">补录病历材料</h3>
          <div className="space-y-2">
            <textarea
              className="input min-h-[60px] resize-y"
              placeholder="补充化验结果/门诊记录/主人反馈等..."
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                onClick={submitMaterial}
                disabled={!material.trim()}
                className="btn-secondary disabled:opacity-40"
              >
                <Plus size={14} /> 补录并写入时间线
              </button>
            </div>
          </div>
        </section>

        {/* 疫苗本照片（分次上传，批次号递增） */}
        <section>
          <h3 className="section-title mb-2 flex items-center justify-between">
            疫苗本照片
            <button
              className="text-xs text-teal-700 hover:text-teal-800 font-medium flex items-center gap-1 transition"
              onClick={handleUploadDemo}
            >
              <UploadCloud size={12} /> 上传新一批（演示）
            </button>
          </h3>
          <VaccinePhotoGrid alert={alert} />
        </section>

        {/* 完整时间线 */}
        <section>
          <h3 className="section-title mb-2">完整操作时间线</h3>
          <TimelineView entries={alert.timeline} />
        </section>
      </div>

      {/* Footer 操作栏 */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/80 space-y-2">
        <div className="grid grid-cols-4 gap-2">
          <StatusSelector current={alert.currentStatus} onChange={(s) => updateStatus(alert.id, s)} />
          <button
            onClick={handleRerun}
            className="btn-secondary !justify-center"
          >
            <RotateCcw size={14} />
            重跑判断
          </button>
          <button
            onClick={handleUploadDemo}
            className="btn-secondary !justify-center"
          >
            <UploadCloud size={14} />
            补录疫苗照
          </button>
          <button
            onClick={handleExportThis}
            className="btn-primary !justify-center"
          >
            <Download size={14} />
            导出CSV
          </button>
        </div>
        {rerunResult && (
          <div
            className={`text-xs p-2 rounded-lg animate-fade-in ${
              rerunResult.ok
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}
          >
            {rerunResult.ok ? (
              <>✅ 重跑完成 · 判断版本已升级 · 历史连续性校验通过</>
            ) : (
              <>⚠️ 重跑完成但发现历史断档：{rerunResult.gaps.join('；')}</>
            )}
          </div>
        )}
        {exportResult && (
          <div className="text-xs p-2 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 animate-fade-in">
            {exportResult}
          </div>
        )}
      </div>

      {showMedDialog && (
        <MedicationDialog
          alert={alert}
          onClose={() => setShowMedDialog(false)}
          onConfirm={(change) => {
            changeMedication(alert.id, change);
            setShowMedDialog(false);
          }}
        />
      )}
    </div>
  );
}

function VaccinePhotoGrid({ alert }: { alert: AbnormalAlert }) {
  const batches = new Map<number, { url: string; remark?: string; uploadTime: string }[]>();
  for (const tl of alert.timeline ?? []) {
    for (const p of tl.photos ?? []) {
      if (!batches.has(p.batchNumber)) batches.set(p.batchNumber, []);
      batches.get(p.batchNumber)!.push({
        url: p.url,
        remark: p.remark,
        uploadTime: p.uploadTime,
      });
    }
  }
  const list = Array.from(batches.entries()).sort((a, b) => a[0] - b[0]);
  if (!list.length) {
    return (
      <div className="text-xs text-slate-400 italic p-4 border border-dashed border-slate-200 rounded-lg text-center">
        暂无疫苗本照片 · 分批上传，批次号自动递增，不覆盖早先发判断
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {list.map(([batch, photos]) => (
        <div key={batch}>
          <div className="flex items-center justify-between mb-2">
            <span className="chip bg-teal-100 text-teal-700 border border-teal-200">
              第 {batch} 批 · {photos.length} 张
            </span>
            <span className="text-[10px] text-slate-400">
              {formatDateTime(photos[0].uploadTime)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-lg border border-slate-200 aspect-square"
              >
                <img src={p.url} className="w-full h-full object-cover group-hover:scale-105 transition" />
                {p.remark && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-[10px] text-white px-1.5 py-1 line-clamp-2">
                    {p.remark}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusSelector({
  current,
  onChange,
}: {
  current: AlertStatus;
  onChange: (s: AlertStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: AlertStatus[] = ['pending', 'in_progress', 'follow_up', 'resolved'];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-secondary w-full !justify-between"
      >
        <span className="truncate">状态: {STATUS_LABEL[current]}</span>
        <span className="text-[10px] opacity-60">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 card p-1 animate-scale-in">
            {options.map((o) => {
              const c = statusColor(o);
              return (
                <button
                  key={o}
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-50 flex items-center gap-2 transition ${
                    o === current ? 'bg-brand-50 text-brand-700' : ''
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                  {STATUS_LABEL[o]}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

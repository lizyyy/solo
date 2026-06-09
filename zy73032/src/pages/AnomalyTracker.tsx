import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  CalendarDays,
  ArrowRightLeft,
  Info,
} from "lucide-react";
import { useReconcileStore } from "@/store/useReconcileStore";
import { summarizeConflicts } from "@/utils/reconciliation";
import type { Pet, Schedule, MedicalRecord } from "@/types";

export default function AnomalyTracker() {
  const {
    getAliasConflicts,
    pets,
    schedules,
    medicalRecords,
    getPetById,
    bindAliasToPet,
    getConflictSummary,
  } = useReconcileStore();

  const conflicts = useMemo(() => getAliasConflicts(), [getAliasConflicts]);
  const summary = getConflictSummary();
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [bindingAlias, setBindingAlias] = useState<string | null>(null);

  const schedById = useMemo(
    () => new Map(schedules.map((s) => [s.id, s])),
    [schedules]
  );
  const medById = useMemo(
    () => new Map(medicalRecords.map((m) => [m.id, m])),
    [medicalRecords]
  );

  return (
    <div className="space-y-5">
      <section className="card p-5 bg-gradient-to-br from-danger-50 to-white">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-danger-100 text-danger-700 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-xl font-semibold text-warm-800">
              别名冲突异常追踪
            </h2>
            <p className="text-sm text-warm-500 mt-1">
              以下异常不会进入正常汇总。每张卡片都写清楚了：
              <b className="text-warm-700">来源是哪里</b>、
              <b className="text-warm-700">影响了哪些排程和病历</b>，让接手同事从这里一路追到原始记录。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat label="冲突名" value={summary.namesAffected} />
            <Stat label="排程受影响" value={summary.schedulesExcluded} />
            <Stat label="病历受影响" value={summary.medicalExcluded} />
          </div>
        </div>
      </section>

      {conflicts.length === 0 ? (
        <section className="card-dashed text-center py-12">
          <div className="text-5xl mb-3">🎈</div>
          <div className="font-serif text-xl text-warm-800 mb-1">
            没有别名冲突
          </div>
          <div className="text-sm text-warm-500">
            所有排程和病历都能对应到规范宠物，汇总数据是干净的
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          {conflicts.map((c) => {
            const isResolved = resolved.has(c.aliasName);
            return (
              <article
                key={c.aliasName}
                className={`card transition-all ${
                  isResolved ? "opacity-70" : ""
                }`}
              >
                <div className="px-6 py-4 flex items-center gap-4 border-b border-dashed border-warm-200">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      isResolved
                        ? "bg-success-100 text-success-700"
                        : "bg-danger-100 text-danger-700 animate-pulseSoft"
                    }`}
                  >
                    {isResolved ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif text-lg font-semibold text-warm-800">
                        别名「{c.aliasName}」
                      </span>
                      {c.matchedPetIds.length > 1 && (
                        <span className="tag-anomaly">
                          对应 {c.matchedPetIds.length} 只不同宠物（歧义）
                        </span>
                      )}
                      {c.matchedPetIds.length === 0 && (
                        <span className="tag-anomaly">未绑定任何规范宠物</span>
                      )}
                      {c.matchedPetIds.length === 1 &&
                        getPetById(c.matchedPetIds[0]) && (
                          <span className="tag-confirmed">
                            已识别 → {getPetById(c.matchedPetIds[0])!.canonicalName}
                          </span>
                        )}
                      {isResolved && <span className="tag-confirmed">已处理</span>}
                    </div>
                    <div className="text-xs text-warm-500 mt-1 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        影响 {c.affectedScheduleIds.length} 条排程
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        影响 {c.affectedMedicalIds.length} 份病历
                      </span>
                      {c.matchedPetIds.length > 0 && (
                        <span className="text-warm-600">
                          可能对应：
                          {c.matchedPetIds
                            .map((pid) => getPetById(pid)?.canonicalName)
                            .filter(Boolean)
                            .join(" / ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isResolved && (
                      <button
                        className="btn-primary"
                        onClick={() => setBindingAlias(c.aliasName)}
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        处理：绑定规范宠物
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="p-5 md:border-r md:border-dashed md:border-warm-200">
                    <h3 className="text-xs font-semibold text-warm-700 mb-3 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-brand-600" />
                      需要补看的来源
                      <span className="text-[10px] text-warm-400 font-normal">
                        （点击可直接跳到排程明细）
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {c.sourceRecords.length === 0 ? (
                        <div className="text-xs text-warm-500 rounded-lg bg-warm-50 p-3">
                          该别名所有记录都能对得上规范宠物，无需补看来源。问题可能出在对应多只宠物。
                        </div>
                      ) : (
                        c.sourceRecords.map((r) => (
                          <Link
                            key={`${r.type}-${r.id}`}
                            to={`/schedules?id=${r.id}`}
                            className="block rounded-lg border border-warm-200 p-3 text-xs hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={`tag ${
                                  r.type === "CSV" ? "tag-pending" : "tag-anomaly"
                                }`}
                              >
                                {r.type === "CSV" ? "CSV 来源" : "病历来源"}
                              </span>
                              <span className="text-warm-400 inline-flex items-center gap-1">
                                钻取
                                <ExternalLink className="w-3 h-3" />
                              </span>
                            </div>
                            <div className="text-warm-800 font-medium">{r.label}</div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="text-xs font-semibold text-warm-700 mb-3">
                      影响范围：关联的排程与病历
                    </h3>
                    <div className="space-y-2">
                      {c.affectedScheduleIds.map((sid) => {
                        const s = schedById.get(sid) as Schedule | undefined;
                        if (!s) return null;
                        return (
                          <Link
                            key={`sch-${sid}`}
                            to={`/schedules?id=${s.id}`}
                            className="block rounded-lg border border-warm-200 p-3 text-xs hover:border-brand-400 hover:bg-brand-50/30"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="w-3 h-3 text-brand-600" />
                                <b className="text-warm-800">{s.courseDate}</b>
                                <span className="text-warm-600">{s.courseName}</span>
                              </span>
                              <span className="tag-anomaly">未纳入汇总</span>
                            </div>
                            <div className="text-warm-500">
                              宠物名：{s.petName} · 训导师：{s.trainer} ·{" "}
                              {s.durationMin}分钟
                            </div>
                          </Link>
                        );
                      })}
                      {c.affectedMedicalIds.map((mid) => {
                        const m = medById.get(mid) as MedicalRecord | undefined;
                        if (!m) return null;
                        return (
                          <div
                            key={`med-${mid}`}
                            className="rounded-lg border border-warm-200 p-3 text-xs bg-warm-50/50"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="inline-flex items-center gap-1.5">
                                <FileText className="w-3 h-3 text-danger-600" />
                                <b className="text-warm-800">{m.visitDate}</b>
                                <span className="text-warm-600">{m.petName}</span>
                              </span>
                              <span className="text-warm-400">病历</span>
                            </div>
                            <div className="text-warm-500">
                              诊断：{m.diagnosis} · 医生：{m.veterinarian}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {bindingAlias && (
        <ResolveDialog
          aliasName={bindingAlias}
          pets={pets as Pet[]}
          onClose={() => setBindingAlias(null)}
          onConfirm={({ petId, createNew, source }) => {
            bindAliasToPet({
              aliasName: bindingAlias,
              petId: createNew ? null : petId || null,
              createPetIfMissing: createNew,
              source,
              remark: "异常追踪页处理别名冲突",
            });
            setResolved((prev) => new Set(prev).add(bindingAlias));
            setBindingAlias(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="font-serif text-2xl font-bold text-danger-700">{value}</div>
      <div className="text-[11px] text-warm-500 mt-0.5">{label}</div>
    </div>
  );
}

function ResolveDialog({
  aliasName,
  pets,
  onClose,
  onConfirm,
}: {
  aliasName: string;
  pets: Pet[];
  onClose: () => void;
  onConfirm: (args: {
    petId?: string;
    createNew?: { canonicalName: string; species: "狗" | "猫" | "其他"; gender: "公" | "母" | "未知" };
    source: "CSV_COLUMN" | "MANUAL" | "MEDICAL_FORM";
  }) => void;
}) {
  const [mode, setMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [petId, setPetId] = useState<string>(pets[0]?.id || "");
  const [newName, setNewName] = useState(aliasName);
  const [species, setSpecies] = useState<"狗" | "猫" | "其他">("狗");
  const [gender, setGender] = useState<"公" | "母" | "未知">("未知");
  const [source, setSource] = useState<"CSV_COLUMN" | "MANUAL" | "MEDICAL_FORM">("MANUAL");
  return (
    <div
      className="fixed inset-0 bg-warm-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg p-6 space-y-4 animate-fadeUp"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg font-semibold text-warm-800">
          解决「{aliasName}」的别名冲突
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("EXISTING")}
            className={`py-2 rounded-lg text-xs font-medium border ${
              mode === "EXISTING"
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white border-warm-200 text-warm-600 hover:bg-warm-50"
            }`}
          >
            绑定到已有宠物
          </button>
          <button
            onClick={() => setMode("NEW")}
            className={`py-2 rounded-lg text-xs font-medium border ${
              mode === "NEW"
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white border-warm-200 text-warm-600 hover:bg-warm-50"
            }`}
          >
            新建规范宠物
          </button>
        </div>
        {mode === "EXISTING" ? (
          <div className="space-y-2 max-h-48 overflow-y-auto scroll-thin">
            {pets.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${
                  petId === p.id
                    ? "border-brand-500 bg-brand-50"
                    : "border-warm-200 hover:bg-warm-50"
                }`}
              >
                <input
                  type="radio"
                  className="accent-brand-600"
                  checked={petId === p.id}
                  onChange={() => setPetId(p.id)}
                />
                <div>
                  <div className="text-sm font-medium">{p.canonicalName}</div>
                  <div className="text-[11px] text-warm-500">
                    {p.species} · {p.gender}
                  </div>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 text-xs">
              规范名
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs">
              物种
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value as typeof species)}
                className="mt-1 w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
              >
                <option>狗</option>
                <option>猫</option>
                <option>其他</option>
              </select>
            </label>
            <label className="text-xs">
              性别
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as typeof gender)}
                className="mt-1 w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
              >
                <option>公</option>
                <option>母</option>
                <option>未知</option>
              </select>
            </label>
          </div>
        )}
        <label className="text-xs block">
          来源标记
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="mt-1 w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
          >
            <option value="MANUAL">人工补看（异常追踪页处理）</option>
            <option value="CSV_COLUMN">CSV 列中的宠物名</option>
            <option value="MEDICAL_FORM">病历手写单上的名字</option>
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2 border-t border-warm-100">
          <button className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn-primary"
            disabled={mode === "EXISTING" ? !petId : !newName.trim()}
            onClick={() =>
              onConfirm({
                petId: mode === "EXISTING" ? petId : undefined,
                createNew:
                  mode === "NEW"
                    ? { canonicalName: newName.trim(), species, gender }
                    : undefined,
                source,
              })
            }
          >
            <CheckCircle2 className="w-4 h-4" />
            确认处理
          </button>
        </div>
      </div>
    </div>
  );
}

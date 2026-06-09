import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  CheckCircle2,
  Undo2,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  ScrollText,
  CalendarDays,
  User,
  Clock,
  FileText,
  AlertCircle,
  ArrowRightLeft,
} from "lucide-react";
import { useReconcileStore } from "@/store/useReconcileStore";
import {
  SCHEDULE_STATUS_LABEL,
  type ScheduleStatus,
  type Schedule,
} from "@/types";
import DiffViewer from "@/components/DiffViewer";
import { deepDiff, formatValue } from "@/utils/diff";

type FilterStatus = "ALL" | ScheduleStatus;

export default function ScheduleList() {
  const [sp] = useSearchParams();
  const highlightId = sp.get("id");

  const {
    schedules,
    pets,
    dataSources,
    medicalRecords,
    getPetById,
    getDataSourceById,
    confirmSchedule,
    withdrawSchedule,
    bindAliasToPet,
    getLogsByTarget,
  } = useReconcileStore();

  const [kw, setKw] = useState("");
  const [status, setStatus] = useState<FilterStatus>("ALL");
  const [expanded, setExpanded] = useState<string | null>(highlightId);
  const [bindingFor, setBindingFor] = useState<Schedule | null>(null);

  useEffect(() => {
    if (highlightId) {
      setExpanded(highlightId);
      setTimeout(() => {
        document.getElementById(`sch-${highlightId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [highlightId]);

  const filtered = useMemo(() => {
    return schedules
      .filter((s) => (status === "ALL" ? true : s.status === status))
      .filter((s) => {
        if (!kw.trim()) return true;
        const k = kw.trim().toLowerCase();
        return (
          s.petName.toLowerCase().includes(k) ||
          s.courseName.toLowerCase().includes(k) ||
          s.trainer.toLowerCase().includes(k) ||
          s.courseDate.includes(k)
        );
      })
      .sort((a, b) => (b.courseDate > a.courseDate ? 1 : -1));
  }, [schedules, status, kw]);

  const counts = useMemo(() => {
    const all = schedules.length;
    const byStatus = (st: ScheduleStatus) =>
      schedules.filter((s) => s.status === st).length;
    return {
      ALL: all,
      PENDING: byStatus("PENDING"),
      CONFIRMED: byStatus("CONFIRMED"),
      WITHDRAWN: byStatus("WITHDRAWN"),
      ANOMALY: byStatus("ANOMALY"),
    };
  }, [schedules]);

  const medicalByScheduleId = useMemo(() => {
    const map = new Map<string, typeof medicalRecords>();
    medicalRecords.forEach((m) => {
      if (!m.linkedScheduleId) return;
      if (!map.has(m.linkedScheduleId)) map.set(m.linkedScheduleId, []);
      map.get(m.linkedScheduleId)!.push(m);
    });
    return map;
  }, [medicalRecords]);

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索宠物名 / 课程 / 训导师 / 日期"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-warm-200 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { k: "ALL", label: "全部" },
                { k: "PENDING", label: "待确认" },
                { k: "CONFIRMED", label: "已确认" },
                { k: "WITHDRAWN", label: "已撤回" },
                { k: "ANOMALY", label: "异常隔离" },
              ] as { k: FilterStatus; label: string }[]
            ).map((t) => (
              <button
                key={t.k}
                onClick={() => setStatus(t.k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  status === t.k
                    ? "bg-brand-600 text-white"
                    : "bg-warm-100 text-warm-600 hover:bg-warm-200"
                }`}
              >
                {t.label} · {counts[t.k]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-warm-500">
            没有符合条件的排程
            <div className="mt-2">
              <Link to="/import" className="btn-primary !py-1.5 !px-3 text-xs inline-flex">
                去导入排程
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-warm-100">
            {filtered.map((s) => {
              const src = getDataSourceById(s.sourceId);
              const boundPet = s.petId ? getPetById(s.petId) : undefined;
              const meds = medicalByScheduleId.get(s.id) || [];
              const isExpanded = expanded === s.id;
              const isHL = highlightId === s.id;
              return (
                <div
                  key={s.id}
                  id={`sch-${s.id}`}
                  className={`${
                    isHL ? "bg-brand-50/50" : ""
                  } transition-colors`}
                >
                  <div className="px-5 py-3 flex items-center gap-3 hover:bg-warm-50 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : s.id)}
                  >
                    <div className="w-11 shrink-0 text-center">
                      <div className="text-xs text-warm-700 font-semibold">
                        {s.courseDate.slice(5)}
                      </div>
                      <div className="text-[10px] text-warm-400">
                        {s.courseDate.slice(0, 4)}
                      </div>
                    </div>
                    <div className="min-w-[110px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-warm-800">
                          {s.petName}
                        </span>
                        {boundPet && boundPet.canonicalName !== s.petName && (
                          <span className="text-[10px] text-brand-700 bg-brand-50 px-1.5 rounded">
                            → {boundPet.canonicalName}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-warm-500">
                        {boundPet
                          ? `${boundPet.species}·${boundPet.gender}`
                          : "未绑定规范宠物"}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-warm-800 truncate">
                        {s.courseName}
                      </div>
                      <div className="text-[11px] text-warm-500 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {s.durationMin}分钟
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {s.trainer}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {src?.fileName?.slice(0, 18) || s.sourceRow}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={s.status} />
                    <div
                      className="flex items-center gap-1 ml-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {s.status === "PENDING" || s.status === "ANOMALY" ? (
                        <>
                          <button
                            className="btn-success !py-1 !px-2.5 text-xs"
                            onClick={() => {
                              if (boundPet) {
                                confirmSchedule(s.id, boundPet.id, "明细页手动确认");
                              } else {
                                setBindingFor(s);
                              }
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            确认
                          </button>
                          {!boundPet && (
                            <button
                              className="btn-secondary !py-1 !px-2.5 text-xs"
                              onClick={() => setBindingFor(s)}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              绑别名
                            </button>
                          )}
                        </>
                      ) : null}
                      {s.status === "CONFIRMED" && (
                        <button
                          className="btn-secondary !py-1 !px-2.5 text-xs"
                          onClick={() => withdrawSchedule(s.id, "明细页撤回确认")}
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          撤回
                        </button>
                      )}
                      <button className="w-7 h-7 rounded-lg hover:bg-warm-100 flex items-center justify-center text-warm-500">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 animate-fadeUp">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl bg-warm-50 p-4 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-warm-700 mb-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            排程详情
                          </div>
                          <InfoRow label="导入来源" value={`${src?.fileName || "—"} · ${s.sourceRow}`} />
                          <InfoRow label="状态" value={SCHEDULE_STATUS_LABEL[s.status]} />
                          {s.anomalyReason && (
                            <InfoRow
                              label="异常原因"
                              value={
                                <span className="text-danger-700">
                                  <AlertCircle className="w-3 h-3 inline -mt-0.5 mr-1" />
                                  {s.anomalyReason}
                                </span>
                              }
                            />
                          )}
                          {s.confirmedAt && (
                            <InfoRow
                              label="确认信息"
                              value={`${s.confirmedBy || "—"} · ${s.confirmedAt.replace("T", " ").slice(0, 16)}`}
                            />
                          )}
                          {s.withdrawnAt && (
                            <InfoRow
                              label="撤回时间"
                              value={s.withdrawnAt.replace("T", " ").slice(0, 16)}
                            />
                          )}
                        </div>
                        <div className="rounded-xl bg-warm-50 p-4 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-warm-700 mb-1">
                            <ScrollText className="w-3.5 h-3.5" />
                            关联的手写病历
                          </div>
                          {meds.length === 0 ? (
                            <div className="text-xs text-warm-500">
                              还没有关联的病历。可以在
                              <Link to="/import#medical" className="text-brand-700 mx-1 underline">
                                录入病历
                              </Link>
                              时自动关联。
                            </div>
                          ) : (
                            meds.map((m) => (
                              <div
                                key={m.id}
                                className="rounded-lg border border-warm-200 bg-white p-3 text-xs space-y-1"
                              >
                                <div className="flex justify-between">
                                  <span className="font-medium text-warm-800">
                                    {m.petName} · {m.visitDate}
                                  </span>
                                  <span className="text-warm-400">
                                    {m.veterinarian}
                                  </span>
                                </div>
                                <div className="text-warm-700">
                                  <b>诊断：</b>
                                  {m.diagnosis}
                                </div>
                                <div className="text-warm-500">
                                  <b>处置：</b>
                                  {m.treatment}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center gap-2 text-xs font-medium text-warm-700 mb-2">
                          🕘 这条记录的操作轨迹（公示复盘可用）
                        </div>
                        <div className="rounded-xl border border-warm-200 divide-y divide-warm-100 overflow-hidden">
                          {(() => {
                            const logs = getLogsByTarget("SCHEDULE", s.id);
                            if (logs.length === 0) {
                              return (
                                <div className="p-4 text-xs text-warm-500 text-center">
                                  还没有操作记录
                                </div>
                              );
                            }
                            return logs.map((l) => (
                              <div key={l.id} className="p-3 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="tag-pending">{l.action}</span>
                                    <span className="text-warm-700 font-medium">
                                      {l.operator}
                                    </span>
                                    {l.remark && (
                                      <span className="text-warm-500">{l.remark}</span>
                                    )}
                                  </div>
                                  <span className="text-warm-400">
                                    {l.operatedAt.replace("T", " ").slice(0, 16)}
                                  </span>
                                </div>
                                {l.beforeState && l.afterState && (
                                  <DiffViewer
                                    chunks={deepDiff(l.beforeState, l.afterState)}
                                    compact
                                  />
                                )}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {bindingFor && (
        <BindAliasDialog
          schedule={bindingFor}
          pets={pets}
          onClose={() => setBindingFor(null)}
          onConfirm={({ petId, createNew, aliasSource }) => {
            const result = bindAliasToPet({
              aliasName: bindingFor.petName,
              petId: createNew ? null : petId || null,
              createPetIfMissing: createNew,
              source: aliasSource,
              linkedRecordId: bindingFor.id,
              remark: "排程明细页绑定别名",
            });
            confirmSchedule(bindingFor.id, result.petId, "完成别名绑定后自动确认");
            setBindingFor(null);
          }}
        />
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="text-xs flex items-start gap-2">
      <div className="text-warm-500 w-20 shrink-0">{label}</div>
      <div className="text-warm-800 flex-1 min-w-0">
        {typeof value === "string" ? formatValue(value) : value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ScheduleStatus }) {
  const map: Record<ScheduleStatus, string> = {
    PENDING: "tag-pending",
    CONFIRMED: "tag-confirmed",
    WITHDRAWN: "tag-withdrawn",
    ANOMALY: "tag-anomaly",
  };
  return <span className={map[status]}>{SCHEDULE_STATUS_LABEL[status]}</span>;
}

function BindAliasDialog({
  schedule,
  pets,
  onClose,
  onConfirm,
}: {
  schedule: Schedule;
  pets: { id: string; canonicalName: string; species: string; gender: string }[];
  onClose: () => void;
  onConfirm: (args: {
    petId?: string;
    createNew?: { canonicalName: string; species: "狗" | "猫" | "其他"; gender: "公" | "母" | "未知" };
    aliasSource: "CSV_COLUMN" | "MANUAL" | "MEDICAL_FORM";
  }) => void;
}) {
  const [mode, setMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [petId, setPetId] = useState<string>(pets[0]?.id || "");
  const [newName, setNewName] = useState(schedule.petName);
  const [species, setSpecies] = useState<"狗" | "猫" | "其他">("狗");
  const [gender, setGender] = useState<"公" | "母" | "未知">("未知");
  const [src, setSrc] = useState<"CSV_COLUMN" | "MANUAL" | "MEDICAL_FORM">(
    schedule.sourceRow.startsWith("CSV") ? "CSV_COLUMN" : "MEDICAL_FORM"
  );

  return (
    <div
      className="fixed inset-0 bg-warm-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg p-6 space-y-4 animate-fadeUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <LinkIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold text-warm-800">
              为「{schedule.petName}」绑定规范宠物
            </h3>
            <p className="text-xs text-warm-500 mt-0.5">
              绑定后别名将被记入关系表，下次同名出现会自动关联
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            className={`py-2 rounded-lg text-xs font-medium border ${
              mode === "EXISTING"
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white border-warm-200 text-warm-600 hover:bg-warm-50"
            }`}
            onClick={() => setMode("EXISTING")}
          >
            选已有规范宠物
          </button>
          <button
            className={`py-2 rounded-lg text-xs font-medium border ${
              mode === "NEW"
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white border-warm-200 text-warm-600 hover:bg-warm-50"
            }`}
            onClick={() => setMode("NEW")}
          >
            新建规范宠物
          </button>
        </div>

        {mode === "EXISTING" ? (
          <div className="space-y-2">
            <label className="text-xs text-warm-600 block">
              选择对应规范宠物
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto scroll-thin">
              {pets.length === 0 && (
                <div className="text-xs text-warm-500 py-3 text-center">
                  还没有宠物，切到「新建」吧
                </div>
              )}
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
                    name="pet"
                    className="accent-brand-600"
                    checked={petId === p.id}
                    onChange={() => setPetId(p.id)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-warm-800">
                      {p.canonicalName}
                    </div>
                    <div className="text-[11px] text-warm-500">
                      {p.species} · {p.gender} · {p.id}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 text-xs text-warm-600">
              规范名（主名）
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-warm-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              />
            </label>
            <label className="text-xs text-warm-600">
              物种
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value as typeof species)}
                className="mt-1 w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
              >
                <option value="狗">狗</option>
                <option value="猫">猫</option>
                <option value="其他">其他</option>
              </select>
            </label>
            <label className="text-xs text-warm-600">
              性别
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as typeof gender)}
                className="mt-1 w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
              >
                <option value="公">公</option>
                <option value="母">母</option>
                <option value="未知">未知</option>
              </select>
            </label>
          </div>
        )}

        <div>
          <label className="text-xs text-warm-600 block mb-1.5">
            这个别名的来源
          </label>
          <select
            value={src}
            onChange={(e) => setSrc(e.target.value as typeof src)}
            className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
          >
            <option value="CSV_COLUMN">CSV 列中的宠物名</option>
            <option value="MEDICAL_FORM">病历手写单上的名字</option>
            <option value="MANUAL">人工记录</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-warm-100">
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
                aliasSource: src,
              })
            }
          >
            <CheckCircle2 className="w-4 h-4" />
            绑定并确认
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Save,
  Send,
  PauseCircle,
  MapPin,
  Eye,
  Info,
} from "lucide-react";
import { useChecklistStore } from "@/store/useChecklistStore";
import { LAYER_NAME_REGEX } from "@/data/mockData";
import { STATUS_LABEL } from "shared/types";
import type {
  ChecklistStatus,
  DrawingVersion,
  DrainPoint,
  BimNote,
  Role,
} from "shared/types";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import VersionChip from "@/components/VersionChip";
import { cn } from "@/lib/utils";

function nowStr(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function genNoteId(): string {
  return `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export default function ChecklistEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === undefined || id === "new";
  const {
    checklists,
    fetchChecklists,
    fetchOne,
    createChecklist,
    updateChecklist,
    currentRole,
    loading,
  } = useChecklistStore();

  const [projectName, setProjectName] = useState("");
  const [layerName, setLayerName] = useState("");
  const [versions, setVersions] = useState<DrawingVersion[]>([
    { version: "v1", isLatest: true, isValid: true, releasedAt: nowStr(), remark: "初版" },
  ]);
  const [initialStatus, setInitialStatus] = useState<ChecklistStatus>("pending");
  const [bimNotes, setBimNotes] = useState<Omit<BimNote, "id">[]>([
    {
      content: "",
      createdAt: nowStr(),
      createdBy: "architect" as Role,
      isWithdrawn: false,
      isSupplementary: false,
      versionTag: "v1",
    },
  ]);
  const [drainPoints, setDrainPoints] = useState<DrainPoint[]>([
    { id: "p1", label: "", apiField: "drainPoint_1_spec", x: 25, y: 30, description: "" },
    { id: "p2", label: "", apiField: "drainPoint_2_spec", x: 75, y: 30, description: "" },
    { id: "p3", label: "", apiField: "drainPoint_3_spec", x: 50, y: 70, description: "" },
  ]);

  useEffect(() => {
    if (!isNew && checklists.length === 0) {
      fetchChecklists();
    }
  }, [isNew, checklists.length, fetchChecklists]);

  useEffect(() => {
    if (!isNew) {
      const existing = id ? fetchOne(id) : undefined;
      if (existing) {
        setProjectName(existing.projectName);
        setLayerName(existing.layerName);
        setVersions(existing.versions);
        setInitialStatus(existing.status);
        setBimNotes(
          existing.bimNotes.map((n) => ({
            content: n.content,
            createdAt: n.createdAt,
            createdBy: n.createdBy,
            isWithdrawn: n.isWithdrawn,
            withdrawnAt: n.withdrawnAt,
            withdrawnBy: n.withdrawnBy,
            isSupplementary: n.isSupplementary,
            versionTag: n.versionTag,
          }))
        );
        setDrainPoints(existing.drainPoints);
      }
    }
  }, [isNew, id, checklists, fetchOne]);

  const layerValid = useMemo(() => {
    if (!layerName.trim()) return { valid: false, show: false };
    return {
      valid: LAYER_NAME_REGEX.test(layerName),
      show: true,
    };
  }, [layerName]);

  const autoCode = useMemo(() => {
    return `RD-${String(checklists.length + 1).padStart(3, "0")}`;
  }, [checklists.length]);

  const addVersion = () => {
    const nextNum = versions.length + 1;
    setVersions((prev) =>
      prev.map((v) => ({ ...v, isLatest: false })).concat([
        {
          version: `v${nextNum}`,
          isLatest: true,
          isValid: true,
          releasedAt: nowStr(),
          remark: "",
        },
      ])
    );
  };

  const updateVersion = (idx: number, patch: Partial<DrawingVersion>) => {
    setVersions((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };

  const removeVersion = (idx: number) => {
    if (versions.length <= 1) return;
    setVersions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateDrainPoint = (id: string, patch: Partial<DrainPoint>) => {
    setDrainPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const updateBimNote = (idx: number, patch: Partial<BimNote>) => {
    setBimNotes((prev) => prev.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  };

  const buildPayload = (status: ChecklistStatus) => ({
    projectName: projectName.trim(),
    layerName: layerName.trim(),
    status,
    versions,
    drainPoints: drainPoints.map((p) => ({
      ...p,
      label: p.label.trim(),
      description: p.description.trim(),
    })),
    bimNotes: bimNotes
      .filter((n) => n.content.trim())
      .map((n) => ({
        id: genNoteId(),
        ...n,
        content: n.content.trim(),
      })),
    handledBy: currentRole,
  });

  const handleSaveDraft = () => {
    if (!projectName.trim()) return;
    if (isNew) {
      const created = createChecklist(buildPayload("pending"));
      navigate(`/checklist/${created.id}`);
    } else if (id) {
      updateChecklist(id, buildPayload(initialStatus));
      navigate(`/checklist/${id}`);
    }
  };

  const handleSubmit = () => {
    if (!projectName.trim()) return;
    if (isNew) {
      const created = createChecklist(buildPayload(initialStatus));
      navigate(`/checklist/${created.id}`);
    } else if (id) {
      updateChecklist(id, buildPayload(initialStatus));
      navigate(`/checklist/${id}`);
    }
  };

  const handleSuspend = () => {
    if (!projectName.trim()) return;
    if (isNew) {
      const created = createChecklist(buildPayload("suspended"));
      navigate(`/checklist/${created.id}`);
    } else if (id) {
      updateChecklist(id, buildPayload("suspended"));
      navigate(`/checklist/${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50">
      <AppHeader
        breadcrumb={[
          { label: "清单列表", to: "/" },
          { label: isNew ? "新建清单" : "编辑清单" },
        ]}
        showBack
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-7 space-y-6">
            <div className="card p-6">
              <h2 className="section-title">基础信息</h2>
              <div className="space-y-5">
                <div>
                  <label className="label-base">
                    项目名 <span className="text-accent-returned">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="例如：A3 栋屋面排水"
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="label-base">编号</label>
                  <div className="input-base bg-ink-50 font-mono text-ink-600 cursor-not-allowed">
                    {isNew ? <span className="text-ink-400">自动生成（{autoCode}）</span> : (id ? fetchOne(id)?.code : "")}
                  </div>
                </div>

                <div>
                  <label className="label-base">图层名</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={layerName}
                      onChange={(e) => setLayerName(e.target.value)}
                      placeholder="例如：A-ROOF-DRAIN-MAIN"
                      className={cn(
                        "input-base pr-10",
                        layerValid.show && !layerValid.valid &&
                          "border-orange-400 focus:ring-orange-400 focus:border-orange-400"
                      )}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {layerValid.show &&
                        (layerValid.valid ? (
                          <CheckCircle className="w-5 h-5 text-accent-confirmed" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-accent-suspended" />
                        ))}
                    </div>
                  </div>
                  <p
                    className={cn(
                      "text-xs mt-1.5 flex items-center gap-1",
                      layerValid.show && !layerValid.valid
                        ? "text-accent-suspended"
                        : "text-ink-500"
                    )}
                  >
                    {layerValid.show && !layerValid.valid ? (
                      <>
                        <Info className="w-3 h-3" />
                        建议挂起，待运营主管确认
                      </>
                    ) : layerValid.show && layerValid.valid ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-accent-confirmed" />
                        图层命名符合规范
                      </>
                    ) : (
                      "请输入符合命名规范的图层名称"
                    )}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label-base mb-0">图纸版本</label>
                    <button
                      onClick={addVersion}
                      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增版本
                    </button>
                  </div>
                  <div className="space-y-2">
                    {versions.map((v, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-start p-3 border border-ink-200 rounded-sm2 bg-ink-50"
                      >
                        <div className="col-span-2">
                          <label className="text-[10px] text-ink-500 mb-1 block">版本号</label>
                          <input
                            type="text"
                            value={v.version}
                            onChange={(e) => updateVersion(idx, { version: e.target.value })}
                            className="input-base text-xs font-mono"
                          />
                        </div>
                        <div className="col-span-5">
                          <label className="text-[10px] text-ink-500 mb-1 block">备注</label>
                          <input
                            type="text"
                            value={v.remark || ""}
                            onChange={(e) => updateVersion(idx, { remark: e.target.value })}
                            placeholder="版本说明"
                            className="input-base text-xs"
                          />
                        </div>
                        <div className="col-span-4">
                          <label className="text-[10px] text-ink-500 mb-1 block">发布日期</label>
                          <input
                            type="text"
                            value={v.releasedAt}
                            onChange={(e) => updateVersion(idx, { releasedAt: e.target.value })}
                            className="input-base text-xs font-mono"
                          />
                        </div>
                        <div className="col-span-1 pt-5">
                          <button
                            onClick={() => removeVersion(idx)}
                            disabled={versions.length <= 1}
                            className="p-1.5 rounded-sm2 hover:bg-red-50 text-ink-400 hover:text-accent-returned disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label-base">初始状态</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { key: "confirmed", label: "已确认", color: "green" },
                        { key: "pending", label: "待补件", color: "blue" },
                        { key: "suspended", label: "挂起", color: "amber" },
                      ] as const
                    ).map((opt) => {
                      const active = initialStatus === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setInitialStatus(opt.key)}
                          className={cn(
                            "px-4 py-2.5 rounded-sm2 border text-sm font-medium transition-all",
                            active
                              ? opt.color === "green"
                                ? "bg-green-50 border-green-400 text-green-700 shadow-inset"
                                : opt.color === "blue"
                                ? "bg-blue-50 border-blue-400 text-blue-700 shadow-inset"
                                : "bg-amber-50 border-amber-400 text-amber-700 shadow-inset"
                              : "bg-white border-ink-200 text-ink-600 hover:bg-ink-50"
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="label-base">BIM 备注</label>
                  <div className="space-y-3">
                    {bimNotes.map((note, idx) => (
                      <div
                        key={idx}
                        className="p-3 border border-ink-200 rounded-sm2 bg-white space-y-2"
                      >
                        <textarea
                          value={note.content}
                          onChange={(e) =>
                            updateBimNote(idx, { content: e.target.value })
                          }
                          placeholder="输入备注内容..."
                          rows={2}
                          className="input-base resize-none text-sm"
                        />
                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-1.5 text-xs text-ink-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={note.isSupplementary}
                              onChange={(e) =>
                                updateBimNote(idx, {
                                  isSupplementary: e.target.checked,
                                })
                              }
                              className="w-3.5 h-3.5 rounded-sm2 border-ink-300 text-brand-600"
                            />
                            后补说明
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="section-title">
                <MapPin className="w-4 h-4 text-brand-600" />
                排水点位（三端同步）
              </h2>
              <p className="text-xs text-ink-500 mb-4 flex items-center gap-1">
                <Info className="w-3 h-3" />
                三端同步：将同时写入标注、说明、接口
              </p>
              <div className="space-y-4">
                {drainPoints.map((point, idx) => (
                  <div
                    key={point.id}
                    className="border border-ink-200 rounded-sm2 p-4 bg-ink-50 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <span className="font-medium text-sm text-ink-700">
                        点位 {idx + 1}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="label-base">点位标签</label>
                        <input
                          type="text"
                          value={point.label}
                          onChange={(e) =>
                            updateDrainPoint(point.id, { label: e.target.value })
                          }
                          placeholder="例如：1# 雨水斗（DN100）"
                          className="input-base text-sm"
                        />
                      </div>
                      <div>
                        <label className="label-base">X (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={point.x}
                          onChange={(e) =>
                            updateDrainPoint(point.id, {
                              x: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                            })
                          }
                          className="input-base text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="label-base">Y (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={point.y}
                          onChange={(e) =>
                            updateDrainPoint(point.id, {
                              y: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                            })
                          }
                          className="input-base text-sm font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="label-base">交底说明</label>
                        <textarea
                          value={point.description}
                          onChange={(e) =>
                            updateDrainPoint(point.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="详细说明，三端同步展示"
                          rows={2}
                          className="input-base text-sm resize-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="label-base">接口字段</label>
                        <input
                          type="text"
                          value={point.apiField}
                          onChange={(e) =>
                            updateDrainPoint(point.id, { apiField: e.target.value })
                          }
                          className="input-base text-sm font-mono bg-ink-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 bg-white border-ink-200 flex items-center justify-between gap-4">
              <Link to="/" className="btn-ghost">
                取消
              </Link>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={!projectName.trim()}
                  className="btn-ghost"
                >
                  <Save className="w-4 h-4" />
                  保存草稿
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!projectName.trim()}
                  className="btn-primary"
                >
                  <Send className="w-4 h-4" />
                  提交
                </button>
                <button
                  onClick={handleSuspend}
                  disabled={!projectName.trim()}
                  className={cn(
                    !layerValid.show || layerValid.valid
                      ? "btn-warn opacity-70"
                      : "btn-warn ring-2 ring-accent-suspended ring-offset-2"
                  )}
                >
                  <PauseCircle className="w-4 h-4" />
                  挂起并转运营
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-5">
            <div className="sticky top-20 space-y-6">
              <div className="card p-5 bg-gradient-to-br from-brand-600 to-brand-800 text-white">
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-4 h-4" />
                  <span className="text-xs font-medium tracking-wide opacity-80">
                    实时预览
                  </span>
                </div>
                <div className="font-mono text-xs opacity-70 mb-1">
                  {isNew ? autoCode : (id ? fetchOne(id)?.code : "")}
                </div>
                <div className="font-serif text-xl font-bold mb-2 truncate">
                  {projectName || "未命名项目"}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge
                    status={initialStatus}
                    className="bg-white/90 border-white"
                  />
                  {layerValid.show && !layerValid.valid && (
                    <span className="chip bg-accent-suspended/90 text-white border-none">
                      <AlertTriangle className="w-3 h-3" />
                      图层异常
                    </span>
                  )}
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-brand-600" />
                  <span className="text-sm font-semibold text-ink-800">
                    场景标注预览
                  </span>
                </div>
                <div className="grid-bg w-full aspect-[4/3] relative rounded-sm2 border border-ink-200 mb-4 overflow-hidden bg-white">
                  {drainPoints.map((point, idx) => (
                    <div
                      key={point.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-md border-2 border-white",
                          point.label
                            ? "bg-brand-600"
                            : "bg-ink-300"
                        )}
                      >
                        {idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {drainPoints.map((point, idx) => (
                    <div
                      key={point.id}
                      className="flex items-start gap-2 p-2 rounded-sm2 bg-ink-50"
                    >
                      <div className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-ink-800 truncate">
                          {point.label || "（未填写标签）"}
                        </div>
                        {point.description && (
                          <div className="text-[11px] text-ink-500 mt-0.5 line-clamp-2">
                            {point.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-ink-800 mb-3">
                  版本
                </h3>
                <div className="flex flex-wrap gap-2">
                  {versions.map((v) => (
                    <VersionChip key={v.version} version={v} />
                  ))}
                </div>
              </div>

              <div className="card p-5 bg-ink-100">
                <h3 className="text-sm font-semibold text-ink-800 mb-3">
                  说明面板预览
                </h3>
                <div className="space-y-2">
                  {drainPoints.map((point, idx) => (
                    <div
                      key={point.id}
                      className="flex items-start gap-2 p-3 bg-white rounded-sm2 border border-ink-200"
                    >
                      <div className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-ink-700 leading-relaxed">
                        {point.description || "（未填写说明）"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileOutput,
  RotateCcw,
  Clock,
  ArrowRight,
  Check,
  AlertTriangle,
  ArrowUpRight,
  FileText,
  Pin,
  Activity,
  CheckCircle2,
  XCircle,
  MessageSquarePlus,
  Edit3,
  ListTodo,
} from "lucide-react";
import { useReviewStore } from "@/store/useReviewStore";
import type { ActionType, ReviewAction } from "@/types";
import { cn } from "@/lib/utils";

const ACTION_FILTERS: { label: string; type: ActionType }[] = [
  { label: "状态修改", type: "状态修改" },
  { label: "确认正常", type: "确认正常" },
  { label: "标记异常", type: "标记异常" },
  { label: "补录备注", type: "补录备注" },
];

const NODE_COLOR: Record<ActionType, string> = {
  确认正常: "bg-emerald-500",
  标记异常: "bg-red-500",
  补录备注: "bg-amber-500",
  状态修改: "bg-blue-500",
};

const BADGE_CLASS: Record<ActionType, string> = {
  确认正常: "badge-success",
  标记异常: "badge-danger",
  补录备注: "badge-warn",
  状态修改: "badge-info",
};

const ACTION_ICON: Record<ActionType, React.ReactNode> = {
  确认正常: <CheckCircle2 className="w-3 h-3 mr-1" />,
  标记异常: <XCircle className="w-3 h-3 mr-1" />,
  补录备注: <MessageSquarePlus className="w-3 h-3 mr-1" />,
  状态修改: <Edit3 className="w-3 h-3 mr-1" />,
};

function valueToString(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function FieldList({
  data,
  diffKeys,
  isAfter = false,
}: {
  data: Record<string, unknown>;
  diffKeys: Set<string>;
  isAfter?: boolean;
}) {
  const keys = Object.keys(data);
  if (keys.length === 0) {
    return (
      <div className="text-sm text-slate-400 italic py-4 text-center">
        无变更前数据
      </div>
    );
  }
  return (
    <div className="space-y-2.5 py-1">
      {keys.map((k) => {
        const changed = isAfter && diffKeys.has(k);
        return (
          <div key={k} className="flex items-start gap-3">
            <div className="w-20 flex-shrink-0 text-slate-500 text-xs pt-0.5">
              {k}
            </div>
            <div className="flex-1 min-w-0 flex items-start gap-2">
              <span
                className={cn(
                  "font-mono text-sm break-all",
                  changed && "diff-change"
                )}
              >
                {valueToString(data[k])}
              </span>
              {changed && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 text-red-700 border border-red-200">
                  <AlertTriangle className="w-3 h-3" />
                  变更
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReviewLog() {
  const navigate = useNavigate();
  const store = useReviewStore();
  const {
    reviewActions,
    anomalies,
    materials,
    drawingPoints,
    supplementNotes,
    resetAll,
    setHighlightedPoint,
    setSelectedAnomaly,
  } = store;

  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [filterTypes, setFilterTypes] = useState<Set<ActionType>>(
    new Set(ACTION_FILTERS.map((f) => f.type))
  );

  const toggleFilter = (t: ActionType) => {
    const next = new Set(filterTypes);
    next.has(t) ? next.delete(t) : next.add(t);
    setFilterTypes(next);
  };

  const filteredActions = useMemo(() => {
    return reviewActions
      .filter((a) => filterTypes.has(a.type))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [reviewActions, filterTypes]);

  const selectedAction: ReviewAction | null = useMemo(() => {
    if (!selectedActionId) return null;
    return reviewActions.find((a) => a.id === selectedActionId) ?? null;
  }, [selectedActionId, reviewActions]);

  const diffKeys = useMemo(() => {
    const set = new Set<string>();
    if (!selectedAction) return set;
    const { before, after } = selectedAction;
    for (const k of Object.keys(after)) {
      if (
        Object.prototype.hasOwnProperty.call(before, k) &&
        valueToString(before[k]) !== valueToString(after[k])
      ) {
        set.add(k);
      }
    }
    return set;
  }, [selectedAction]);

  const stats = useMemo(() => {
    const total = reviewActions.length;
    const confirmed = reviewActions.filter(
      (a) => a.type === "确认正常" || a.type === "标记异常"
    ).length;
    const notes = supplementNotes.length;
    const statusChanges = reviewActions.filter(
      (a) => a.type === "状态修改"
    ).length;
    return { total, confirmed, notes, statusChanges };
  }, [reviewActions, supplementNotes]);

  const handleExportReport = () => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const now = new Date();
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const lines: string[] = [];
    lines.push("=".repeat(60));
    lines.push("复盘报告 · 屋面排水图纸复核");
    lines.push(`生成时间：${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`);
    lines.push("=".repeat(60));
    lines.push("");
    lines.push("【操作日志汇总】");
    lines.push(`- 总操作次数：${stats.total}`);
    lines.push(`- 人工确认数：${stats.confirmed}`);
    lines.push(`- 补录备注条数：${stats.notes}`);
    lines.push(`- 状态修改次数：${stats.statusChanges}`);
    lines.push("");
    lines.push("【详细操作日志】");
    [...reviewActions]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .forEach((a, idx) => {
        lines.push(`${idx + 1}. [${a.timestamp}] ${a.operator} → ${a.type}`);
        lines.push(`   目标：${a.targetType} ${a.targetId}`);
        if (Object.keys(a.before).length) {
          lines.push(`   变更前：${JSON.stringify(a.before)}`);
        }
        if (Object.keys(a.after).length) {
          lines.push(`   变更后：${JSON.stringify(a.after)}`);
        }
        lines.push("");
      });
    lines.push("【补录记录】");
    if (supplementNotes.length === 0) {
      lines.push("  暂无补录记录");
    } else {
      supplementNotes.forEach((n, idx) => {
        const mat = materials.find((m) => m.id === n.materialItemId);
        lines.push(`${idx + 1}. [${n.createdAt}] ${n.author}`);
        lines.push(`   关联：${mat?.code ?? n.materialItemId} ${mat?.name ?? ""}`);
        lines.push(`   内容：${n.content}`);
        lines.push("");
      });
    }
    lines.push("【异常点汇总】");
    if (anomalies.length === 0) {
      lines.push("  暂无异常点");
    } else {
      anomalies.forEach((an, idx) => {
        const point = drawingPoints.find((p) => p.id === an.drawingPointId);
        const mat = materials.find((m) => m.id === an.materialItemId);
        lines.push(`${idx + 1}. ${an.id} [${an.type}/${an.severity}] 状态：${an.status}`);
        lines.push(`   点位：${point?.name ?? an.drawingPointId}`);
        lines.push(`   关联材料：${mat?.code ?? an.materialItemId} ${mat?.name ?? ""}`);
        lines.push(`   描述：${an.description}`);
        if (an.confirmedBy) {
          lines.push(`   确认人：${an.confirmedBy} @ ${an.confirmedAt}`);
        }
        lines.push("");
      });
    }
    lines.push("=".repeat(60));
    lines.push("—— 报告结束 ——");

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `复盘报告_${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleJumpDrawing = () => {
    if (!selectedAction) return;
    if (selectedAction.targetType === "异常点") {
      const anomaly = anomalies.find((a) => a.id === selectedAction.targetId);
      if (anomaly) {
        const point = drawingPoints.find((p) => p.id === anomaly.drawingPointId);
        if (point) setHighlightedPoint(point.id);
        setSelectedAnomaly(anomaly.id);
      }
    } else if (selectedAction.targetType === "材料行") {
      const point = drawingPoints.find((p) => p.materialItemId === selectedAction.targetId);
      const anomaly = anomalies.find((a) => a.materialItemId === selectedAction.targetId);
      if (point) setHighlightedPoint(point.id);
      if (anomaly) setSelectedAnomaly(anomaly.id);
    } else if (selectedAction.targetType === "图纸点位") {
      setHighlightedPoint(selectedAction.targetId);
    }
    navigate("/drawing-review");
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[1680px] mx-auto">
        <header className="mb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-800 flex items-center gap-2">
              复盘记录
              <span className="text-brand-600 text-xl">·</span>
              <span className="text-brand-700">屋面排水图纸复核</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              项目经理次日复盘：看人工确认前后到底改了什么
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportReport} className="btn btn-primary">
              <FileOutput className="w-4 h-4" />
              导出复盘报告
            </button>
            <button onClick={resetAll} className="btn">
              <RotateCcw className="w-4 h-4" />
              重置演示数据
            </button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-[30%]">
            <div className="card h-full flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-500" />
                  <h2 className="font-display font-semibold text-slate-800">
                    操作日志
                  </h2>
                </div>
              </div>
              <div className="px-4 py-2.5 border-b border-slate-100 flex flex-wrap gap-x-3 gap-y-1.5">
                {ACTION_FILTERS.map((f) => (
                  <label
                    key={f.type}
                    className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none hover:text-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={filterTypes.has(f.type)}
                      onChange={() => toggleFilter(f.type)}
                      className="rounded border-slate-300 w-3.5 h-3.5 text-brand-600 focus:ring-brand-500/30"
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto max-h-[68vh] p-4 pl-6">
                {filteredActions.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-400">
                    暂无操作日志
                  </div>
                ) : (
                  <div className="border-l-2 border-slate-200">
                    {filteredActions.map((action) => {
                      const active = selectedActionId === action.id;
                      return (
                        <div
                          key={action.id}
                          onClick={() => setSelectedActionId(action.id)}
                          className="pl-6 pb-4 last:pb-0 relative cursor-pointer group"
                        >
                          <span
                            className={cn(
                              "timeline-node",
                              NODE_COLOR[action.type]
                            )}
                          />
                          <div
                            className={cn(
                              "card p-3 hover:shadow-md transition-all",
                              active &&
                                "ring-2 ring-brand-400 ring-offset-1 border-brand-300"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span
                                className={cn(
                                  "badge",
                                  BADGE_CLASS[action.type]
                                )}
                              >
                                {ACTION_ICON[action.type]}
                                {action.type}
                              </span>
                              <span className="text-xs text-slate-500 whitespace-nowrap">
                                {action.timestamp.split(" ")[1]}
                              </span>
                            </div>
                            <div className="font-medium text-slate-800 text-sm mb-1">
                              {action.operator}
                            </div>
                            <div className="text-slate-600 text-xs flex items-center gap-1.5">
                              <span>{action.targetType}</span>
                              <span className="font-mono text-slate-500">
                                {action.targetId}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {action.timestamp.split(" ")[0]}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-[45%]">
            <div className="card h-full flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-slate-500" />
                <h2 className="font-display font-semibold text-slate-800">
                  变更前后对比
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[68vh] p-4">
                {!selectedAction ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="card p-8 max-w-sm text-center border-dashed border-2">
                      <Clock className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-medium text-slate-700 mb-1">
                        请在左侧选择一条操作记录
                      </div>
                      <div className="text-sm text-slate-500">
                        选择后将展示该操作的变更前后对比
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="card bg-slate-50/50 p-3.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span
                          className={cn(
                            "badge",
                            BADGE_CLASS[selectedAction.type]
                          )}
                        >
                          {ACTION_ICON[selectedAction.type]}
                          {selectedAction.type}
                        </span>
                        <span className="text-slate-700 font-medium">
                          {selectedAction.operator}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">
                          {selectedAction.timestamp}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">
                          {selectedAction.targetType}
                          <span className="font-mono ml-1">
                            {selectedAction.targetId}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="card overflow-hidden">
                        <div className="bg-slate-100 p-2 flex items-center gap-1.5 rounded-t">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700">
                            变更前 Before
                          </span>
                        </div>
                        <div className="p-3.5">
                          <FieldList
                            data={selectedAction.before}
                            diffKeys={diffKeys}
                          />
                        </div>
                      </div>
                      <div className="card overflow-hidden">
                        <div className="bg-brand-50 p-2 flex items-center gap-1.5 rounded-t">
                          {diffKeys.size > 0 ? (
                            <ArrowRight className="w-4 h-4 text-brand-600" />
                          ) : (
                            <Check className="w-4 h-4 text-emerald-600" />
                          )}
                          <span className="text-sm font-medium text-brand-700">
                            变更后 After
                          </span>
                        </div>
                        <div className="p-3.5">
                          <FieldList
                            data={selectedAction.after}
                            diffKeys={diffKeys}
                            isAfter
                          />
                        </div>
                      </div>
                    </div>

                    {(selectedAction.targetType === "异常点" ||
                      selectedAction.targetType === "材料行") && (
                      <div className="card bg-slate-50 border-slate-200">
                        <div className="px-3.5 py-2.5 border-b border-slate-200/70 text-xs font-medium text-slate-500">
                          关联上下文
                        </div>
                        <div className="p-3.5 space-y-2 text-sm">
                          {selectedAction.targetType === "异常点" && (() => {
                            const anomaly = anomalies.find(
                              (a) => a.id === selectedAction.targetId
                            );
                            if (!anomaly)
                              return (
                                <div className="text-slate-400">
                                  未找到对应异常点
                                </div>
                              );
                            const point = drawingPoints.find(
                              (p) => p.id === anomaly.drawingPointId
                            );
                            const mat = materials.find(
                              (m) => m.id === anomaly.materialItemId
                            );
                            return (
                              <>
                                <div className="flex items-start gap-3">
                                  <span className="w-16 text-slate-500 text-xs pt-0.5">
                                    异常描述
                                  </span>
                                  <span className="flex-1 text-slate-700">
                                    {anomaly.description}
                                  </span>
                                </div>
                                <div className="flex items-start gap-3">
                                  <span className="w-16 text-slate-500 text-xs pt-0.5">
                                    点位名称
                                  </span>
                                  <span className="flex-1 text-slate-700">
                                    {point?.name ?? anomaly.drawingPointId}
                                  </span>
                                </div>
                                <div className="flex items-start gap-3">
                                  <span className="w-16 text-slate-500 text-xs pt-0.5">
                                    关联材料
                                  </span>
                                  <span className="flex-1 text-slate-700">
                                    <span className="font-mono text-xs">
                                      {mat?.code ?? anomaly.materialItemId}
                                    </span>
                                    {mat?.name && (
                                      <span className="ml-2">
                                        {mat.name}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                          {selectedAction.targetType === "材料行" && (() => {
                            const mat = materials.find(
                              (m) => m.id === selectedAction.targetId
                            );
                            if (!mat)
                              return (
                                <div className="text-slate-400">
                                  未找到对应材料行
                                </div>
                              );
                            return (
                              <>
                                <div className="flex items-start gap-3">
                                  <span className="w-16 text-slate-500 text-xs pt-0.5">
                                    材料编号
                                  </span>
                                  <span className="flex-1 font-mono text-slate-700">
                                    {mat.code}
                                  </span>
                                </div>
                                <div className="flex items-start gap-3">
                                  <span className="w-16 text-slate-500 text-xs pt-0.5">
                                    材料名称
                                  </span>
                                  <span className="flex-1 text-slate-700">
                                    {mat.name}
                                  </span>
                                </div>
                                {mat.remark && (
                                  <div className="flex items-start gap-3">
                                    <span className="w-16 text-slate-500 text-xs pt-0.5">
                                      备注
                                    </span>
                                    <span className="flex-1 text-slate-700 whitespace-pre-wrap text-sm">
                                      {mat.remark}
                                    </span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleJumpDrawing}
                        className="btn btn-primary"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        跳转至对应图纸位置
                      </button>
                      <button
                        onClick={() => navigate("/material-review")}
                        className="btn"
                      >
                        <FileText className="w-4 h-4" />
                        查看关联送审表行
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-[25%]">
            <div className="card h-full flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="w-4 h-4 text-amber-500" />
                  <h2 className="font-display font-semibold text-slate-800">
                    补录记录
                    <span className="text-slate-500 text-xs font-normal ml-1.5">
                      · 非标准行
                    </span>
                  </h2>
                </div>
                <span className="badge badge-warn">{supplementNotes.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[68vh] p-3 space-y-3">
                {supplementNotes.length === 0 ? (
                  <div className="h-full flex items-center justify-center py-16">
                    <div className="text-center">
                      <Pin className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <div className="text-sm text-slate-400">
                        暂无补录记录
                      </div>
                    </div>
                  </div>
                ) : (
                  supplementNotes.map((note) => {
                    const mat = materials.find(
                      (m) => m.id === note.materialItemId
                    );
                    return (
                      <div
                        key={note.id}
                        className="card row-note p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-medium text-slate-800 text-sm">
                            {note.author}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            {note.createdAt}
                            <span>📌</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="badge badge-warn">
                            {mat?.code ?? note.materialItemId}
                          </span>
                          {mat?.name && (
                            <span className="text-xs text-slate-600 truncate">
                              {mat.name}
                            </span>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap text-sm text-slate-700 mb-3 leading-relaxed">
                          {note.content}
                        </div>
                        <button
                          onClick={() => navigate("/material-review")}
                          className="btn-sm btn-warn inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-amber-700 bg-amber-500 text-white hover:bg-amber-600"
                        >
                          <FileText className="w-3 h-3" />
                          在送审表中查看
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">
                    总操作次数
                  </div>
                  <div className="text-2xl font-bold text-slate-800">
                    {stats.total}
                  </div>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">
                    已完成人工确认
                  </div>
                  <div className="text-2xl font-bold text-slate-800">
                    {stats.confirmed}
                  </div>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <MessageSquarePlus className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">
                    补录备注条数
                  </div>
                  <div className="text-2xl font-bold text-slate-800">
                    {stats.notes}
                  </div>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Edit3 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">
                    材料状态变更
                  </div>
                  <div className="text-2xl font-bold text-slate-800">
                    {stats.statusChanges}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

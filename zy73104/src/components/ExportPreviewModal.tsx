import { X, Download, FileText } from "lucide-react";
import type { Checklist, DrainPoint } from "shared/types";
import { STATUS_LABEL, ROLE_LABEL } from "shared/types";
import { VIEW_LABELS, type ViewAngle } from "./RoofThreeScene";

interface ExportPreviewModalProps {
  open: boolean;
  onClose: () => void;
  checklist: Checklist;
  viewAngle: ViewAngle;
}

function buildExportText(checklist: Checklist, viewAngle: ViewAngle): string {
  const lines: string[] = [];
  lines.push("=" .repeat(56));
  lines.push("         屋面排水交底清单");
  lines.push("=" .repeat(56));
  lines.push("");
  lines.push(`【记录编号】 ${checklist.code}`);
  lines.push(`【项目名称】 ${checklist.projectName}`);
  lines.push(`【图层名称】 ${checklist.layerName}`);
  lines.push(`【清单状态】 ${STATUS_LABEL[checklist.status]}`);
  lines.push(`【处理角色】 ${ROLE_LABEL[checklist.handledBy]}`);
  lines.push(`【负责人】   ${checklist.assignee}`);
  lines.push(`【当前视角】 ${VIEW_LABELS[viewAngle]}`);
  lines.push(`【创建时间】 ${checklist.createdAt}`);
  lines.push(`【更新时间】 ${checklist.updatedAt}`);
  lines.push("");
  lines.push("-" .repeat(56));
  lines.push("  交底点位说明");
  lines.push("-" .repeat(56));
  lines.push("");

  checklist.drainPoints.forEach((p: DrainPoint, idx: number) => {
    lines.push(`  ${idx + 1}. ${p.label}`);
    lines.push(`     接口字段：${p.apiField}`);
    lines.push(`     说明：${p.description}`);
    lines.push("");
  });

  lines.push("-" .repeat(56));
  lines.push("  图纸版本");
  lines.push("-" .repeat(56));
  lines.push("");
  checklist.versions.forEach((v) => {
    const tags: string[] = [];
    if (v.isLatest) tags.push("最新");
    if (!v.isValid) tags.push("已失效");
    const tagStr = tags.length > 0 ? ` [${tags.join(" / ")}]` : "";
    lines.push(`  ${v.version}${tagStr}  ${v.releasedAt}`);
    if (v.remark) {
      lines.push(`       ${v.remark}`);
    }
  });

  if (checklist.revisions.length > 0) {
    lines.push("");
    lines.push("-" .repeat(56));
    lines.push("  改判记录");
    lines.push("-" .repeat(56));
    lines.push("");
    checklist.revisions.forEach((rev, idx) => {
      lines.push(`  [改判 ${idx + 1}] ${STATUS_LABEL[rev.fromStatus]} → ${STATUS_LABEL[rev.toStatus]}`);
      lines.push(`       操作人：${ROLE_LABEL[rev.changedBy]}  ${rev.changedAt}`);
      lines.push(`       原因：${rev.reason}`);
      if (rev.fieldChanges.length > 0) {
        lines.push(`       字段变更：`);
        rev.fieldChanges.forEach((fc) => {
          lines.push(`         - ${fc.field}：${fc.oldValue} → ${fc.newValue}`);
        });
      }
      lines.push("");
    });
  }

  lines.push("");
  lines.push("-" .repeat(56));
  lines.push("  BIM 备注时间线");
  lines.push("-" .repeat(56));
  lines.push("");
  const sortedNotes = [...checklist.bimNotes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  sortedNotes.forEach((note) => {
    const tags: string[] = [];
    if (note.isWithdrawn) tags.push("已撤回");
    if (note.isSupplementary) tags.push("后补");
    if (note.versionTag) tags.push(note.versionTag);
    const tagStr = tags.length > 0 ? ` [${tags.join(" / ")}]` : "";
    lines.push(`  ${ROLE_LABEL[note.createdBy]}${tagStr}  ${note.createdAt}`);
    const prefix = note.isWithdrawn ? "  ~~" : "    ";
    const suffix = note.isWithdrawn ? "~~" : "";
    lines.push(`${prefix}${note.content}${suffix}`);
    lines.push("");
  });

  lines.push("=" .repeat(56));
  lines.push("  本文件由屋面排水交底系统自动生成，数据与接口同源");
  lines.push("=" .repeat(56));

  return lines.join("\n");
}

export default function ExportPreviewModal({
  open,
  onClose,
  checklist,
  viewAngle,
}: ExportPreviewModalProps) {
  if (!open) return null;

  const exportText = buildExportText(checklist, viewAngle);

  const handleDownload = () => {
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${checklist.code}_${checklist.projectName}_交底清单_${VIEW_LABELS[viewAngle]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
    } catch (e) {
      console.error("copy failed:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm">
      <div className="card w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-ink-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm2 bg-brand-100 flex items-center justify-center text-brand-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold text-ink-900">
                导出预览
              </h3>
              <p className="text-xs text-ink-500 mt-0.5">
                {checklist.code} · {VIEW_LABELS[viewAngle]} · 数据与接口同源
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm2 hover:bg-ink-100 text-ink-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 bg-ink-50">
          <pre className="font-mono text-xs leading-relaxed text-ink-700 whitespace-pre-wrap bg-white p-4 rounded-sm2 border border-ink-200 shadow-sm">
            {exportText}
          </pre>
        </div>

        <div className="flex items-center justify-between gap-3 p-5 border-t border-ink-200 bg-white shrink-0">
          <div className="text-xs text-ink-500">
            导出内容包含：记录信息 / 视角 / 点位说明 / 版本 / 改判 / 备注
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="btn-ghost">
              复制文本
            </button>
            <button
              onClick={handleDownload}
              className="btn-primary"
            >
              <Download className="w-4 h-4" />
              下载 TXT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

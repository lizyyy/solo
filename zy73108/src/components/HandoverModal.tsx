import { useMemo } from "react";
import {
  X,
  FileSignature,
  FileText,
  History,
  CheckSquare,
  Copy,
  Download,
  CheckCircle2,
  AlertTriangle,
  GitBranchPlus,
} from "lucide-react";
import { useMaterialStore } from "@/store/materialStore";
import type { FilterOptions } from "@/types";
import { formatDateShort } from "@/utils/validators";

interface Props {
  open: boolean;
  onClose: () => void;
  filter: FilterOptions;
}

export const HandoverModal = ({ open, onClose, filter }: Props) => {
  const records = useMaterialStore((s) => s.records);
  const logs = useMaterialStore((s) => s.logs);
  const filterRecords = useMaterialStore((s) => s.filterRecords);
  const filterLogs = useMaterialStore((s) => s.filterLogs);

  const filteredRecords = useMemo(
    () => filterRecords(filter),
    [filter, filterRecords]
  );
  const filteredLogs = useMemo(
    () => filterLogs(filter),
    [filter, filterLogs]
  );

  const stats = useMemo(() => {
    const confirmed = filteredRecords.filter(
      (r) => r.status === "confirmed"
    ).length;
    const pending = filteredRecords.filter(
      (r) => r.status === "pending"
    ).length;
    const revoked = filteredRecords.filter(
      (r) => r.status === "revoked"
    ).length;
    const late = filteredRecords.filter((r) => r.isLateChange).length;
    const supplemented = filteredRecords.filter(
      (r) => r.parentId
    ).length;
    const uniqueMaterials = new Set(
      filteredRecords.map((r) => r.materialNo)
    ).size;
    return {
      confirmed,
      pending,
      revoked,
      late,
      supplemented,
      uniqueMaterials,
      records: filteredRecords.length,
      logs: filteredLogs.length,
    };
  }, [filteredRecords, filteredLogs]);

  const batchSummary = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach((r) => {
      map.set(r.batchNo, (map.get(r.batchNo) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredRecords]);

  const handoverText = useMemo(() => {
    const today = formatDateShort(new Date().toISOString());
    const lines: string[] = [];
    lines.push("【日照体量方案比选 · 交接说明】");
    lines.push(`交接日期：${today}`);
    lines.push("");
    lines.push(`（一）材料送审表：共 ${stats.uniqueMaterials} 份材料，合计 ${stats.records} 条记录。`);
    if (stats.supplemented > 0) {
      lines.push(`  其中 ${stats.supplemented} 条为后补新版本，v1 判断均保留未被覆盖。`);
    }
    lines.push(`（二）处理记录：已确认 ${stats.confirmed}、待确认 ${stats.pending}、已撤回 ${stats.revoked}。`);
    if (stats.late > 0) {
      lines.push(`  ⚠ 晚到变更单 ${stats.late} 条，已单独拎出隔离，未揉进正常结果。`);
    }
    lines.push(`（三）历史时间线：共 ${stats.logs} 条操作日志，可按批次号完整追回。`);
    if (batchSummary.length > 0) {
      lines.push(`  涉及批次：${batchSummary
        .map(([b, n]) => `${b}（${n}条）`)
        .join("、")}`);
    }
    lines.push("");
    lines.push("交接人：小赵　复核人：__________");
    return lines.join("\n");
  }, [stats, batchSummary]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(handoverText);
      alert("交接说明已复制到剪贴板");
    } catch {
      alert("复制失败，请手动选择文本");
    }
  };

  const download = () => {
    const blob = new Blob([handoverText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `日照体量方案比选-交接说明-${formatDateShort(new Date().toISOString())}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-paper rounded-lg border border-paper-line shadow-cardHover max-w-3xl w-full max-h-[90vh] flex flex-col animate-slideIn">
        <header className="flex items-center justify-between px-5 py-3 border-b border-paper-line">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-ink text-white flex items-center justify-center">
              <FileSignature size={16} />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-ink text-base">
                交接说明
              </h3>
              <p className="text-xs text-ink-500 -mt-0.5">
                让接手人能对上材料送审表 / 处理记录 / 历史时间线
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost !p-1.5">
            <X size={16} />
          </button>
        </header>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3">
              <div className="flex items-center gap-2 text-ink-500 text-xs mb-2">
                <FileText size={13} /> 材料送审表
              </div>
              <div className="flex items-start gap-1.5 mb-2">
                <CheckSquare
                  size={14}
                  className="text-moss-500 mt-0.5 flex-shrink-0"
                />
                <span className="text-xs text-ink-700">
                  {stats.uniqueMaterials} 份材料 / {stats.records} 条记录
                </span>
              </div>
              {stats.supplemented > 0 && (
                <div className="flex items-start gap-1.5">
                  <GitBranchPlus
                    size={14}
                    className="text-ink-500 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-xs text-ink-600">
                    {stats.supplemented} 条后补新版本（v1 保留）
                  </span>
                </div>
              )}
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-2 text-ink-500 text-xs mb-2">
                <CheckCircle2 size={13} /> 处理记录
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-moss-600">已确认</span>
                  <span className="font-mono text-ink">{stats.confirmed}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-500">待确认</span>
                  <span className="font-mono text-ink">{stats.pending}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ember-500">已撤回</span>
                  <span className="font-mono text-ink">{stats.revoked}</span>
                </div>
              </div>
            </div>
            <div className="card p-3 border-ember-200">
              <div className="flex items-center gap-2 text-ember-500 text-xs mb-2">
                <AlertTriangle size={13} /> 晚到变更专区
              </div>
              <p className="text-2xl font-serif font-semibold text-ember-500 mb-1">
                {stats.late}
              </p>
              <p className="text-[11px] text-ember-600 leading-relaxed">
                条晚到变更单已单独拎出，不进入正常筛选结果
              </p>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-ink-600 text-sm font-medium">
                <History size={14} /> 交接文本（简短版）
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={copy} className="btn-secondary !text-xs !py-1">
                  <Copy size={12} /> 复制
                </button>
                <button onClick={download} className="btn-primary !text-xs !py-1">
                  <Download size={12} /> 下载 .txt
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap bg-paper border border-paper-line rounded p-3 text-xs leading-relaxed text-ink-800 font-mono">
              {handoverText}
            </pre>
          </div>

          <div className="card p-4">
            <p className="text-xs text-ink-500 mb-3">涉及批次清单（点击可跳转时间线追回同批记录）：</p>
            <div className="flex flex-wrap gap-2">
              {batchSummary.map(([b, n]) => (
                <span key={b} className="chip-ink font-mono">
                  {b}
                  <span className="ml-1.5 text-ink-400">×{n}</span>
                </span>
              ))}
              {batchSummary.length === 0 && (
                <span className="text-xs text-ink-400">暂无记录</span>
              )}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-paper-line">
          <button onClick={onClose} className="btn-secondary">
            我已知悉，关闭
          </button>
        </footer>
      </div>
    </div>
  );
};

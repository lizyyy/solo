import { useState } from "react";
import {
  CheckCircle2,
  Undo2,
  PencilLine,
  AlertOctagon,
  Hash,
  Clock4,
  User,
  GitBranchPlus,
  Save,
  X,
  CornerDownRight,
} from "lucide-react";
import type { MaterialRecord } from "@/types";
import { useMaterialStore } from "@/store/materialStore";
import { formatDate } from "@/utils/validators";
import { buildBatchFilterUrl } from "@/utils/exporter";
import { Link } from "react-router-dom";

interface Props {
  record: MaterialRecord;
  operator: string;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  highlight?: boolean;
}

const STATUS_MAP: Record<
  MaterialRecord["status"],
  { label: string; chip: string; stamp?: string }
> = {
  pending: { label: "待确认", chip: "chip-neutral" },
  confirmed: { label: "已确认", chip: "chip-moss", stamp: "stamp-moss" },
  revoked: { label: "已撤回", chip: "chip-ember", stamp: "stamp-ember" },
};

export const RecordCard = ({
  record,
  operator,
  selected,
  onSelect,
  highlight,
}: Props) => {
  const confirmRecord = useMaterialStore((s) => s.confirmRecord);
  const revokeRecord = useMaterialStore((s) => s.revokeRecord);
  const updateRemark = useMaterialStore((s) => s.updateRemark);
  const markLateChange = useMaterialStore((s) => s.markLateChange);
  const getRecordById = useMaterialStore((s) => s.getRecordById);
  const getVersionChain = useMaterialStore((s) => s.getVersionChain);
  const chain = getVersionChain(record.materialNo);

  const [editingRemark, setEditingRemark] = useState(false);
  const [remarkDraft, setRemarkDraft] = useState(record.remark);
  const status = STATUS_MAP[record.status];
  const parent = record.parentId ? getRecordById(record.parentId) : undefined;

  const saveRemark = () => {
    updateRemark(record.id, remarkDraft, operator || "未命名操作员");
    setEditingRemark(false);
  };

  const cancelRemark = () => {
    setRemarkDraft(record.remark);
    setEditingRemark(false);
  };

  return (
    <article
      className={`card-interactive p-3.5 relative animate-slideIn ${
        selected ? "ring-2 ring-ink-300 ring-offset-1 ring-offset-paper" : ""
      } ${highlight ? "border-ink-300" : ""} ${
        record.isLateChange ? "border-l-4 !border-l-ember-400" : ""
      }`}
    >
      <div className="absolute top-3 left-3">
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(record.id, e.target.checked)}
            className="w-3.5 h-3.5 accent-ink rounded"
          />
        </label>
      </div>

      <div className="flex items-start justify-between gap-3 pl-7 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="chip-ink !font-mono !text-[11px]">
              <Hash size={10} /> {record.materialNo}
            </span>
            <span className={`${status.chip} !text-[11px]`}>
              {status.label}
            </span>
            {record.version > 1 && (
              <span className="chip-neutral !text-[11px]">
                <GitBranchPlus size={10} /> v{record.version}
                {parent && (
                  <Link
                    to={buildBatchFilterUrl(parent.batchNo)}
                    className="ml-0.5 text-ink-400 hover:text-ink underline-offset-2 hover:underline"
                    title="追溯上一版本批次"
                  >
                    来自 v{parent.version}
                  </Link>
                )}
              </span>
            )}
            {record.isLateChange && (
              <span className="chip-ember !text-[11px]">
                <AlertOctagon size={10} /> 晚到变更单
              </span>
            )}
            {record.status === "confirmed" && (
              <span className={status.stamp}>CONFIRMED</span>
            )}
            {record.status === "revoked" && (
              <span className={status.stamp}>REVOKED</span>
            )}
          </div>
          <h3 className="font-serif font-semibold text-ink text-sm leading-snug mb-1.5">
            {record.title}
          </h3>
          {record.content && (
            <p className="text-xs text-ink-600 leading-relaxed line-clamp-3 whitespace-pre-wrap">
              {record.content}
            </p>
          )}
          {chain.length > 1 && (
            <details className="mt-2 text-[11px] text-ink-500 group">
              <summary className="cursor-pointer hover:text-ink inline-flex items-center gap-1">
                <CornerDownRight size={11} /> 同编号版本链（
                {chain.length} 条）
              </summary>
              <ul className="mt-1.5 ml-4 space-y-0.5 border-l border-paper-line pl-3">
                {chain.map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5">
                    <span className="font-mono text-ink-400">v{c.version}</span>
                    <span
                      className={`text-ink-700 ${
                        c.id === record.id ? "font-semibold" : ""
                      }`}
                    >
                      {c.title.slice(0, 30)}
                    </span>
                    <span className="chip-neutral !py-0 !text-[10px]">
                      {STATUS_MAP[c.status].label}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      <div className="pl-7 mt-3 pt-3 border-t border-paper-line/70 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-ink-500">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Clock4 size={11} /> {formatDate(record.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <User size={11} /> {record.operator}
            </span>
            <Link
              to={buildBatchFilterUrl(record.batchNo)}
              className="inline-flex items-center gap-1 font-mono hover:text-ink hover:underline underline-offset-2"
              title="点击在时间线中追回同批记录"
            >
              <Hash size={11} /> {record.batchNo}
            </Link>
          </div>
        </div>

        {editingRemark ? (
          <div className="space-y-1.5">
            <textarea
              autoFocus
              value={remarkDraft}
              onChange={(e) => setRemarkDraft(e.target.value)}
              placeholder="人工备注（空值将被忽略，不覆盖原备注）..."
              className="input text-xs min-h-[60px] bg-paper/50"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button onClick={cancelRemark} className="btn-ghost !text-xs !py-1">
                <X size={12} /> 取消
              </button>
              <button onClick={saveRemark} className="btn-primary !text-xs !py-1">
                <Save size={12} /> 保存（不覆盖旧值）
              </button>
            </div>
          </div>
        ) : record.remark ? (
          <div className="group relative rounded bg-paper border border-paper-line p-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-ink-700 leading-relaxed whitespace-pre-wrap flex-1">
                {record.remark}
              </p>
              <button
                onClick={() => setEditingRemark(true)}
                className="btn-ghost !p-1 opacity-60 hover:opacity-100"
                title="编辑备注"
              >
                <PencilLine size={12} />
              </button>
            </div>
            <p className="text-[10px] text-ink-400 mt-1">
              人工备注 · 空导入将被保留
            </p>
          </div>
        ) : (
          <button
            onClick={() => setEditingRemark(true)}
            className="btn-ghost !text-xs !py-1 w-full justify-start text-ink-400 hover:text-ink"
          >
            <PencilLine size={12} /> + 添加人工备注...
          </button>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={record.isLateChange}
              onChange={(e) =>
                markLateChange(
                  record.id,
                  e.target.checked,
                  operator || "未命名操作员"
                )
              }
              className="w-3.5 h-3.5 accent-ember-500"
            />
            <span
              className={
                record.isLateChange
                  ? "text-ember-600 font-medium"
                  : "text-ink-500"
              }
            >
              {record.isLateChange ? "已单独拎出" : "标记晚到变更"}
            </span>
          </label>
          <div className="flex items-center gap-1">
            {record.status !== "confirmed" && (
              <button
                onClick={() =>
                  confirmRecord(record.id, operator || "未命名操作员")
                }
                className="btn-success !text-xs !py-1"
                title="确认，进入正常结果"
              >
                <CheckCircle2 size={12} /> 确认
              </button>
            )}
            {record.status !== "revoked" && (
              <button
                onClick={() =>
                  revokeRecord(record.id, operator || "未命名操作员")
                }
                className="btn-danger !text-xs !py-1"
                title="撤回，从正常结果移除"
              >
                <Undo2 size={12} /> 撤回
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

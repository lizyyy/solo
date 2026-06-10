import {
  ShieldCheck,
  ShieldAlert,
  Download,
  FileSpreadsheet,
  FileJson,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { useReviewStore } from "@/store/reviewStore";
import { validateConsistency } from "@/utils/consistencyChecker";
import { exportToCSV, exportToJSON } from "@/utils/exportGenerator";
import { useState } from "react";
import type { AlertRecord } from "@/types";

const statusTextMap: Record<string, string> = {
  pending: "待复核",
  reviewing: "复核中",
  approved: "已通过",
  rejected: "已驳回",
};

function RecordRow({ record }: { record: AlertRecord }) {
  const result = validateConsistency(record);
  const [open, setOpen] = useState(false);

  const fileConclusionText =
    record.conclusionFile?.conclusion === "pass"
      ? "文件：通过"
      : record.conclusionFile?.conclusion === "fail"
      ? "文件：驳回"
      : "文件：未上传";

  return (
    <div
      className={`border rounded-industrial overflow-hidden transition-all ${
        result.isConsistent
          ? "border-success-200 bg-success-50/30"
          : "border-alert-200 bg-alert-50/30"
      }`}
    >
      <div
        className="grid grid-cols-12 gap-3 p-3 items-center cursor-pointer hover:bg-white/60 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="col-span-1 flex items-center gap-2">
          {result.isConsistent ? (
            <ShieldCheck size={18} className="text-success-600" strokeWidth={2} />
          ) : (
            <ShieldAlert size={18} className="text-alert-500" strokeWidth={2} />
          )}
          <span className="text-xs font-mono text-gray-400">#{record.id.slice(-3)}</span>
        </div>
        <div className="col-span-2 font-mono font-semibold text-industrial-700 text-sm">
          {record.unifiedDeviceId}
        </div>

        <div
          className={`col-span-3 p-2 rounded-industrial text-xs border ${
            result.isConsistent
              ? "bg-white border-success-100"
              : "bg-white border-alert-100"
          }`}
        >
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">
            ① 状态列
          </p>
          <p className="font-medium text-gray-800">
            {statusTextMap[record.status]}
          </p>
        </div>

        <div
          className={`col-span-3 p-2 rounded-industrial text-xs border ${
            result.isConsistent
              ? "bg-white border-success-100"
              : "bg-white border-alert-100"
          }`}
        >
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">
            ② 备注列
          </p>
          <p className="font-medium text-gray-800 truncate">
            {record.remark || "(未填写备注)"}
          </p>
        </div>

        <div
          className={`col-span-2 p-2 rounded-industrial text-xs border ${
            result.isConsistent
              ? "bg-white border-success-100"
              : "bg-white border-alert-100"
          }`}
        >
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">
            ③ 文件结论
          </p>
          <p className="font-medium text-gray-800">{fileConclusionText}</p>
        </div>

        <div className="col-span-1 flex items-center justify-end">
          {open ? (
            <ChevronDown size={16} className="text-gray-400" strokeWidth={2.5} />
          ) : (
            <ChevronRight size={16} className="text-gray-400" strokeWidth={2.5} />
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-200 p-4 bg-white animate-fade-in">
          {result.isConsistent ? (
            <div className="flex items-center gap-3 p-3 bg-success-50 border border-success-200 rounded-industrial">
              <Check size={20} className="text-success-600" strokeWidth={2.5} />
              <div>
                <p className="font-semibold text-success-700">三列一致 ✓</p>
                <p className="text-xs text-success-600">
                  状态、备注、文件结论三者互相对得上，可安全导出
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-alert-50 border border-alert-200 rounded-industrial">
                <AlertCircle
                  size={20}
                  className="text-alert-600 mt-0.5 shrink-0"
                  strokeWidth={2}
                />
                <div>
                  <p className="font-semibold text-alert-700 mb-1">
                    发现 {result.mismatches.length} 处不一致，请修正后再导出
                  </p>
                  <p className="text-xs text-alert-600">
                    导出页面摘要时，状态列、备注和文件结论必须互相对得上
                  </p>
                </div>
              </div>
              <div className="border border-gray-200 rounded-industrial overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-muted">
                      <th className="px-3 py-2 text-left font-semibold text-industrial-700">
                        核对项
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-industrial-700">
                        ① 状态值
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-industrial-700">
                        ② 备注值
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-industrial-700">
                        ③ 文件结论值
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.mismatches.map((m, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-semibold text-alert-700 bg-alert-50/60">
                          ✗ {m.field}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            m.statusValue.includes("✗")
                              ? "text-alert-700 font-semibold bg-alert-50/40"
                              : "text-success-700"
                          }`}
                        >
                          {m.statusValue}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            m.remarkValue.includes("✗")
                              ? "text-alert-700 font-semibold bg-alert-50/40"
                              : "text-success-700"
                          }`}
                        >
                          {m.remarkValue}
                        </td>
                        <td
                          className={`px-3 py-2 ${
                            m.fileValue.includes("✗")
                              ? "text-alert-700 font-semibold bg-alert-50/40"
                              : "text-success-700"
                          }`}
                        >
                          {m.fileValue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConsistencyPreview() {
  const { records } = useReviewStore();

  const results = records.map((r) => ({
    record: r,
    result: validateConsistency(r),
  }));
  const passCount = results.filter((r) => r.result.isConsistent).length;
  const failCount = results.length - passCount;
  const passRate = results.length > 0 ? Math.round((passCount / results.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="card-surface border border-success-200 bg-success-50/40 p-5 animate-stagger-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-success-700 font-medium mb-1">三列一致 ✓</p>
              <p className="text-4xl font-bold text-success-600 font-mono">{passCount}</p>
              <p className="text-xs text-success-500 mt-1">可直接导出</p>
            </div>
            <div className="p-3 bg-white/60 rounded-industrial">
              <ShieldCheck size={28} className="text-success-500" strokeWidth={1.8} />
            </div>
          </div>
        </div>

        <div className="card-surface border border-alert-200 bg-alert-50/40 p-5 animate-stagger-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-alert-700 font-medium mb-1">存在不一致 ✗</p>
              <p className="text-4xl font-bold text-alert-600 font-mono">{failCount}</p>
              <p className="text-xs text-alert-500 mt-1">需复核后再导出</p>
            </div>
            <div className="p-3 bg-white/60 rounded-industrial">
              <ShieldAlert size={28} className="text-alert-500" strokeWidth={1.8} />
            </div>
          </div>
        </div>

        <div className="card-surface border border-industrial-200 bg-industrial-50/40 p-5 animate-stagger-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-industrial-700 font-medium mb-1">整体通过率</p>
              <p className="text-4xl font-bold text-industrial-700 font-mono">
                {passRate}
                <span className="text-2xl ml-1">%</span>
              </p>
              <div className="mt-2 w-full h-2 bg-white/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-industrial-400 to-industrial-600 rounded-full transition-all duration-1000"
                  style={{ width: `${passRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-surface p-5 border border-gray-200">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-industrial-800 mb-1">
              导出前一致性校验预览
            </h3>
            <p className="text-sm text-gray-500">
              逐条核对：①处理状态 ↔ ②复核人备注 ↔ ③上传文件结论，确保三者互相对得上
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV(records)}
              className="btn-success inline-flex items-center gap-1.5"
              disabled={failCount > 0}
              title={failCount > 0 ? "请先修正不一致的记录" : ""}
            >
              <FileSpreadsheet size={16} strokeWidth={2} />
              <span>导出 CSV</span>
            </button>
            <button
              onClick={() => exportToJSON(records)}
              className="btn-outline inline-flex items-center gap-1.5"
            >
              <FileJson size={16} strokeWidth={2} />
              <span>导出 JSON</span>
            </button>
            <button className="btn-industrial inline-flex items-center gap-1.5">
              <Download size={16} strokeWidth={2} />
              <span>导出页面摘要</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {results.map(({ record }, i) => (
            <RecordRow key={record.id} record={record} />
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useSettlementStore } from "@/store/settlementStore";
import ImportDropZone from "@/components/ImportDropZone";
import DedupResult from "@/components/DedupResult";
import StatusBadge from "@/components/StatusBadge";

export default function ImportCenter() {
  const { importResult, importSessions, fetchImportSessions, setImportResult } =
    useSettlementStore();
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();

  useEffect(() => {
    fetchImportSessions();
    return () => setImportResult(null);
  }, []);

  const handleImportComplete = () => {
    fetchImportSessions();
  };

  const handleConfirmDone = () => {
    setImportResult(null);
    setCurrentSessionId(undefined);
    fetchImportSessions();
  };

  return (
    <div className="space-y-6">
      <ImportDropZone onImportComplete={handleImportComplete} />

      {importResult && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">
            去重校验结果
          </h2>
          <DedupResult
            result={importResult}
            sessionId={currentSessionId}
            onConfirmDone={handleConfirmDone}
          />
        </div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          最近导入记录
        </h2>
        {importSessions.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            暂无导入记录
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="pb-2 text-left font-medium">文件名</th>
                <th className="pb-2 text-left font-medium">导入时间</th>
                <th className="pb-2 text-right font-medium">总行数</th>
                <th className="pb-2 text-right font-medium">新增</th>
                <th className="pb-2 text-right font-medium">重复</th>
                <th className="pb-2 text-right font-medium">冲突</th>
                <th className="pb-2 text-right font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {importSessions.map((session) => (
                <tr
                  key={session.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="py-2.5 text-slate-700">{session.file_name}</td>
                  <td className="py-2.5 tabular-nums text-slate-500">
                    {new Date(session.created_at).toLocaleString("zh-CN")}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-slate-600">
                    {session.total_rows}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-emerald-600">
                    {session.new_count}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-amber-600">
                    {session.duplicate_count}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-red-600">
                    {session.conflict_count}
                  </td>
                  <td className="py-2.5 text-right">
                    <StatusBadge
                      status={
                        session.status === "completed"
                          ? "confirmed"
                          : session.status === "failed"
                          ? "conflict"
                          : "pending"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

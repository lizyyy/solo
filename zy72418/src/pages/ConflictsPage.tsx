import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, XCircle, FileText, Calendar, User } from "lucide-react";
import { api } from "@/api/client";
import { useAppStore } from "@/store/appStore";
import StatusBadge from "@/components/StatusBadge";
import type { ConflictRecord, AudioRecord } from "@shared/types";

export default function ConflictsPage() {
  const { currentUser, setLoading, setError, setConflicts, conflicts } = useAppStore();
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null);
  const [resolution, setResolution] = useState<"confirm" | "reject" | null>(null);
  const [reason, setReason] = useState("");

  const loadConflicts = async () => {
    setLoading(true);
    try {
      const res = await api.conflicts.list();
      setConflicts(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, []);

  const handleResolve = async (conflictId: string) => {
    if (!resolution || !reason.trim()) {
      setError("请选择处理方式并填写理由");
      return;
    }

    setLoading(true);
    try {
      await api.conflicts.resolve(conflictId, {
        resolution,
        reason: reason.trim(),
        operator: currentUser.name,
        operatorRole: currentUser.role,
      });
      setSelectedConflict(null);
      setResolution(null);
      setReason("");
      await loadConflicts();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fieldLabels: Record<string, string> = {
    authorization_expiry_date: "授权到期日",
    amount: "金额",
  };

  if (conflicts.length === 0) {
    return (
      <div className="card p-12 text-center animate-fade-in">
        <CheckCircle size={64} className="mx-auto text-success-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-800 mb-2">暂无冲突</h3>
        <p className="text-gray-500">所有音频备注与授权期限页数据一致</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-danger-500" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-gray-800">待处理冲突</h3>
            <p className="text-sm text-gray-500">
              共 {conflicts.length} 条冲突待处理，必须人工确认或驳回
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className={`card overflow-hidden transition-all ${
              selectedConflict === conflict.id
                ? "ring-2 ring-danger-500 ring-offset-2"
                : "hover:shadow-md"
            }`}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-danger-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="text-danger-600" size={24} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="font-semibold text-gray-800">
                      {fieldLabels[conflict.fieldName] || conflict.fieldName} 不一致
                    </h4>
                    <span className="text-xs text-gray-500">
                      冲突ID：{conflict.id}
                    </span>
                  </div>

                  {conflict.record && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">音频文件：</span>
                          <span className="text-gray-800 font-medium">
                            {conflict.record.audioFileName}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">课程：</span>
                          <span className="text-gray-800 font-medium">
                            {conflict.record.courseName}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">状态：</span>
                          <StatusBadge status={conflict.record.status} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                      <div className="flex items-center gap-2 text-danger-700 mb-2">
                        <FileText size={16} />
                        <span className="text-sm font-medium">音频文件备注</span>
                      </div>
                      <p className="text-lg font-semibold text-danger-800">
                        {conflict.audioRemarkValue}
                      </p>
                      <p className="text-xs text-danger-600 mt-2">
                        来源：{conflict.audioRemarkSource}
                      </p>
                    </div>

                    <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                      <div className="flex items-center gap-2 text-primary-700 mb-2">
                        <FileText size={16} />
                        <span className="text-sm font-medium">授权期限页</span>
                      </div>
                      <p className="text-lg font-semibold text-primary-800">
                        {conflict.authorizationValue}
                      </p>
                      <p className="text-xs text-primary-600 mt-2">
                        来源：{conflict.authorizationSource}
                      </p>
                    </div>
                  </div>

                  {selectedConflict === conflict.id ? (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg animate-slide-up">
                      <p className="text-sm text-gray-600 mb-4">
                        请选择处理方式并填写理由（必填），系统将自动记录审计日志
                      </p>

                      <div className="flex gap-4 mb-4">
                        <button
                          onClick={() => setResolution("confirm")}
                          className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                            resolution === "confirm"
                              ? "border-primary-500 bg-primary-50 text-primary-700"
                              : "border-gray-200 hover:border-primary-300"
                          }`}
                        >
                          <CheckCircle size={20} />
                          <div className="text-left">
                            <p className="font-medium">确认（采用授权期限页）</p>
                            <p className="text-xs opacity-70">更新记录为授权页的值</p>
                          </div>
                        </button>

                        <button
                          onClick={() => setResolution("reject")}
                          className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${
                            resolution === "reject"
                              ? "border-danger-500 bg-danger-50 text-danger-700"
                              : "border-gray-200 hover:border-danger-300"
                          }`}
                        >
                          <XCircle size={20} />
                          <div className="text-left">
                            <p className="font-medium">驳回（保留音频备注）</p>
                            <p className="text-xs opacity-70">保持音频备注原值不变</p>
                          </div>
                        </button>
                      </div>

                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="请输入处理理由..."
                        className="textarea-field mb-4"
                        rows={3}
                      />

                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => {
                            setSelectedConflict(null);
                            setResolution(null);
                            setReason("");
                          }}
                          className="btn-secondary"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => handleResolve(conflict.id)}
                          disabled={!resolution || !reason.trim() || useAppStore.getState().loading}
                          className={`${
                            resolution === "confirm" ? "btn-primary" : "btn-danger"
                          }`}
                        >
                          提交处理
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-3 justify-end">
                      <button
                        onClick={() => setSelectedConflict(conflict.id)}
                        className="btn-primary"
                      >
                        处理此冲突
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar size={12} />
                检测时间：{new Date(conflict.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

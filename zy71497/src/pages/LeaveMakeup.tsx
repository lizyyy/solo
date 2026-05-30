import { useEffect, useState } from "react";
import { Plus, CalendarX, RefreshCcw, AlertCircle, Check } from "lucide-react";
import { useStore } from "../store/useStore";
import { api } from "../api/client";
import { cn } from "../lib/utils";
import type { Leave, Makeup } from "../../shared/types";

export default function LeaveMakeup() {
  const { students, leaves, fetchStudents, fetchLeaves } = useStore();
  const [makeups, setMakeups] = useState<Makeup[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showMakeupModal, setShowMakeupModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    student_id: 0,
    date: new Date().toISOString().split("T")[0],
    reason: "",
  });
  const [makeupForm, setMakeupForm] = useState({
    makeup_date: new Date().toISOString().split("T")[0],
    duration_minutes: 0,
  });
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchLeaves();
    loadMakeups();
  }, [fetchStudents, fetchLeaves]);

  const loadMakeups = async () => {
    const data = await api.leaves.getMakeups();
    setMakeups(data);
  };

  const activeStudents = students.filter((s) => s.status === "active");

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.student_id) return;

    setSubmitting(true);
    try {
      await api.leaves.create(leaveForm);
      await fetchLeaves();
      setShowLeaveModal(false);
      setLeaveForm({
        student_id: 0,
        date: new Date().toISOString().split("T")[0],
        reason: "",
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const openMakeupModal = async (leave: Leave) => {
    setSelectedLeave(leave);
    setDuplicateWarning(null);
    setMakeupForm({
      makeup_date: new Date().toISOString().split("T")[0],
      duration_minutes: 0,
    });

    const check = await api.leaves.checkDuplicateMakeup(leave.id);
    if (check.is_duplicate && check.existing_makeup) {
      const student = students.find((s) => s.id === leave.student_id);
      setDuplicateWarning(
        `${student?.name} 在 ${leave.date} 的请假已于 ${check.existing_makeup.makeup_date} 补练，时长 ${check.existing_makeup.duration_minutes} 分钟，返还 ${check.existing_makeup.stars_returned} 颗星。不可重复补练。`
      );
    }
    setShowMakeupModal(true);
  };

  const handleCreateMakeup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeave || duplicateWarning) return;

    setSubmitting(true);
    try {
      await api.leaves.createMakeup({
        leave_id: selectedLeave.id,
        ...makeupForm,
      });
      await fetchLeaves();
      await loadMakeups();
      setShowMakeupModal(false);
      setSelectedLeave(null);
    } catch (e: any) {
      if (e.message.includes("已补练")) {
        setDuplicateWarning(e.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getMakeupForLeave = (leaveId: number) =>
    makeups.find((m) => m.leave_id === leaveId);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-display text-secondary mb-2">请假与补练</h1>
        <p className="text-gray-500">
          登记请假、管理补练申请，请假扣分和补练返还分别记录
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-coral/10 rounded-xl">
              <CalendarX className="text-coral" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">本月请假</p>
              <p className="text-2xl font-bold text-coral">
                {
                  leaves.filter((l) =>
                    l.date.startsWith(
                      new Date().toISOString().slice(0, 7)
                    )
                  ).length
                }
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-mint/10 rounded-xl">
              <RefreshCcw className="text-mint" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">已补练</p>
              <p className="text-2xl font-bold text-mint">
                {leaves.filter((l) => l.has_makeup).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-xl">
              <AlertCircle className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">待补练</p>
              <p className="text-2xl font-bold text-yellow-600">
                {leaves.filter((l) => !l.has_makeup).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowLeaveModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors"
        >
          <Plus size={20} />
          登记请假
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {leaves.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              暂无请假记录
            </div>
          ) : (
            leaves.map((leave) => {
              const student = students.find((s) => s.id === leave.student_id);
              const makeup = getMakeupForLeave(leave.id);
              return (
                <div key={leave.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "p-3 rounded-xl",
                          leave.has_makeup ? "bg-mint/10" : "bg-coral/10"
                        )}
                      >
                        {leave.has_makeup ? (
                          <RefreshCcw className="text-mint" size={20} />
                        ) : (
                          <CalendarX className="text-coral" size={20} />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-lg">
                          {student?.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          请假日期：{leave.date}
                        </p>
                        <p className="text-sm text-gray-500">
                          请假原因：{leave.reason || "无"}
                        </p>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-coral/10 text-coral rounded text-xs">
                              <CalendarX size={12} /> 请假扣除{" "}
                              {Math.abs(leave.stars_deducted)} ⭐
                            </span>
                          </p>
                          {makeup && (
                            <p className="text-sm">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-mint/10 text-mint rounded text-xs">
                                <RefreshCcw size={12} /> 补练返还{" "}
                                {makeup.stars_returned} ⭐
                                （{makeup.makeup_date}，
                                {makeup.duration_minutes}分钟）
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      {!leave.has_makeup && (
                        <button
                          onClick={() => openMakeupModal(leave)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-mint/10 text-mint rounded-lg hover:bg-mint/20 transition-colors"
                        >
                          <Plus size={16} />
                          登记补练
                        </button>
                      )}
                      {leave.has_makeup && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-500 rounded-lg">
                          <Check size={16} />
                          已补练
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h3 className="font-medium text-blue-800 mb-2">📋 业务规则说明</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            <strong>请假扣分：</strong>请假当日独立扣除星星，扣分记录始终保留，不会因后续补练而删除
          </li>
          <li>
            <strong>补练返还：</strong>补练通过后，按"补练时长 × 返还倍率 × 每分钟星数"计算返还星星，生成独立的返还流水
          </li>
          <li>
            <strong>重复补练：</strong>一条请假记录只能补练一次，系统强制阻止重复补练
          </li>
          <li>
            <strong>两条记录分开：</strong>请假扣分和补练返还是两条独立流水，便于审计核对
          </li>
        </ul>
      </div>

      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="font-display text-xl text-secondary mb-4">
              登记请假
            </h2>
            <form onSubmit={handleCreateLeave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  选择学生
                </label>
                <select
                  required
                  value={leaveForm.student_id}
                  onChange={(e) =>
                    setLeaveForm({
                      ...leaveForm,
                      student_id: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                >
                  <option value={0}>请选择学生</option>
                  {activeStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  请假日期
                </label>
                <input
                  type="date"
                  required
                  value={leaveForm.date}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  请假原因
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold resize-none"
                  rows={3}
                  placeholder="例如：生病、外出旅游等"
                />
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ 请假将扣除
                  <span className="font-bold">
                    {" "}
                    {Math.floor(
                      useStore.getState().rewardRules.find((r) => r.rule_key === "leave_deduction")
                        ?.rule_value || 5
                    )}{" "}
                    颗星
                  </span>
                  ，补练通过后可返还
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting || !leaveForm.student_id}
                  className="flex-1 py-2 bg-coral text-white rounded-lg hover:bg-coral/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? "提交中..." : "确认请假"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMakeupModal && selectedLeave && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="font-display text-xl text-secondary mb-4">
              登记补练
            </h2>

            {duplicateWarning && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 flex items-start gap-2">
                  <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{duplicateWarning}</span>
                </p>
              </div>
            )}

            {!duplicateWarning && (
              <form onSubmit={handleCreateMakeup} className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm">
                    <span className="text-gray-500">学生：</span>
                    <span className="font-medium">
                      {students.find((s) => s.id === selectedLeave.student_id)
                        ?.name}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-500">原请假日期：</span>
                    <span className="font-medium">{selectedLeave.date}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-500">请假原因：</span>
                    <span className="font-medium">
                      {selectedLeave.reason || "无"}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    补练日期
                  </label>
                  <input
                    type="date"
                    required
                    value={makeupForm.makeup_date}
                    onChange={(e) =>
                      setMakeupForm({
                        ...makeupForm,
                        makeup_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    补练时长（分钟）
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={makeupForm.duration_minutes || ""}
                    onChange={(e) =>
                      setMakeupForm({
                        ...makeupForm,
                        duration_minutes: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMakeupModal(false);
                      setSelectedLeave(null);
                    }}
                    className="flex-1 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2 bg-mint text-white rounded-lg hover:bg-mint/90 transition-colors disabled:opacity-50"
                  >
                    {submitting ? "提交中..." : "确认补练"}
                  </button>
                </div>
              </form>
            )}

            {duplicateWarning && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowMakeupModal(false);
                    setSelectedLeave(null);
                    setDuplicateWarning(null);
                  }}
                  className="flex-1 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  关闭
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { api } from "../api/client";
import { cn } from "../lib/utils";

export default function Checkin() {
  const {
    students,
    checkins,
    selectedDate,
    fetchStudents,
    fetchCheckins,
    setSelectedDate,
  } = useStore();

  const [durations, setDurations] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [warnings, setWarnings] = useState<
    { student_id: number; reason: string }[]
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingBatch, setPendingBatch] = useState<
    { student_id: number; duration_minutes: number; parent_note?: string }[]
  >([]);

  const activeStudents = students.filter((s) => s.status === "active");

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (selectedDate) {
      fetchCheckins(selectedDate);
    }
  }, [selectedDate, fetchCheckins]);

  useEffect(() => {
    const initialDurations: Record<number, number> = {};
    const initialNotes: Record<number, string> = {};
    checkins.forEach((c) => {
      initialDurations[c.student_id] = c.duration_minutes;
      initialNotes[c.student_id] = c.parent_note;
    });
    setDurations(initialDurations);
    setNotes(initialNotes);
  }, [checkins]);

  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
    setWarnings([]);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
    setWarnings([]);
  };

  const handleSaveDraft = async () => {
    setSubmitting(true);
    setWarnings([]);

    const records = activeStudents
      .map((s) => ({
        student_id: s.id,
        duration_minutes: durations[s.id] || 0,
        parent_note: notes[s.id] || "",
      }))
      .filter((r) => r.duration_minutes > 0 || r.parent_note);

    if (records.length === 0) {
      setSubmitting(false);
      return;
    }

    try {
      const result = await api.checkins.batchUpsert(selectedDate, records);
      setWarnings(result.warnings);
      if (result.warnings.length > 0) {
        setPendingBatch(records);
        setShowConfirmDialog(true);
      } else {
        await fetchCheckins(selectedDate);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await api.checkins.batchUpsert(selectedDate, pendingBatch);
      setWarnings(result.warnings);
      setShowConfirmDialog(false);
      setPendingBatch([]);
      await fetchCheckins(selectedDate);

      const confirmedRecords = result.checkins.filter((c) => !c.confirmed);
      for (const c of confirmedRecords) {
        if (c.duration_minutes > 0) {
          await api.checkins.confirm(c.id);
        }
      }
      await fetchCheckins(selectedDate);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmOne = async (id: number) => {
    try {
      await api.checkins.confirm(id);
      await fetchCheckins(selectedDate);
    } catch (e) {
      console.error(e);
    }
  };

  const isWarning = (studentId: number) =>
    warnings.some((w) => w.student_id === studentId);

  const getCheckin = (studentId: number) =>
    checkins.find((c) => c.student_id === studentId && c.date === selectedDate);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-display text-secondary mb-2">打卡记录</h1>
        <p className="text-gray-500">按日期录入学生练琴时长和家长备注</p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={goToPrevDay}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Calendar className="text-gold" size={20} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setWarnings([]);
              }}
              className="text-xl font-display text-secondary bg-transparent border-none focus:outline-none focus:ring-0"
            />
          </div>
          <button
            onClick={goToNextDay}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
                  学生姓名
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
                  练琴时长（分钟）
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
                  家长备注
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
                  状态
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">
                  获得星星
                </th>
                <th className="text-center py-3 px-4 font-medium text-gray-500 text-sm">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {activeStudents.map((student) => {
                const checkin = getCheckin(student.id);
                const warning = isWarning(student.id);
                return (
                  <tr
                    key={student.id}
                    className={cn(
                      "border-t border-gray-100",
                      warning && "bg-yellow-50"
                    )}
                  >
                    <td className="py-3 px-4 font-medium">{student.name}</td>
                    <td className="py-3 px-4">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={durations[student.id] || ""}
                          onChange={(e) =>
                            setDurations({
                              ...durations,
                              [student.id]: parseInt(e.target.value) || 0,
                            })
                          }
                          disabled={checkin?.confirmed}
                          className={cn(
                            "w-24 px-2 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold",
                            checkin?.confirmed && "bg-gray-50",
                            warning && "border-yellow-400"
                          )}
                        />
                        {warning && (
                          <div className="absolute -top-1 -right-1">
                            <AlertTriangle
                              size={16}
                              className="text-yellow-500"
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={notes[student.id] || ""}
                        onChange={(e) =>
                          setNotes({ ...notes, [student.id]: e.target.value })
                        }
                        disabled={checkin?.confirmed}
                        className={cn(
                          "w-full px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold",
                          checkin?.confirmed && "bg-gray-50"
                        )}
                        placeholder="家长备注..."
                      />
                    </td>
                    <td className="py-3 px-4">
                      {checkin?.confirmed ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-mint/20 text-mint rounded-full">
                          <CheckCircle size={12} />
                          已确认
                        </span>
                      ) : checkin?.is_abnormal ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                          <AlertTriangle size={12} />
                          时长异常
                        </span>
                      ) : checkin?.duration_minutes ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                          待确认
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">未打卡</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-gold">
                        {checkin?.stars_earned || 0}
                      </span>{" "}
                      ⭐
                    </td>
                    <td className="py-3 px-4 text-center">
                      {checkin && !checkin.confirmed && checkin.duration_minutes > 0 ? (
                        <button
                          onClick={() => handleConfirmOne(checkin.id)}
                          className="px-3 py-1 text-sm bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors"
                        >
                          确认
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <h3 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
            <AlertTriangle size={18} />
            异常警告
          </h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            {warnings.map((w, i) => {
              const student = students.find((s) => s.id === w.student_id);
              return (
                <li key={i}>
                  ⚠️ {student?.name}：{w.reason}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-yellow-600 mt-2">
            注：时长夸大仅作警告标记，不影响正常提交；后端记录会标注"时长异常"供后续核对。
          </p>
        </div>
      )}

      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="text-sm text-gray-500">
            共 {activeStudents.length} 名在读学生
          </p>
          <button
            onClick={handleSaveDraft}
            disabled={submitting}
            className="px-6 py-2 bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "保存中..." : "保存并确认全部打卡"}
          </button>
        </div>
      </div>

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="font-display text-xl text-secondary mb-4">
              确认提交异常时长？
            </h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 mb-2">
                以下学生的练琴时长超过阈值，请确认：
              </p>
              <ul className="text-sm text-yellow-700 space-y-1">
                {warnings.map((w, i) => {
                  const student = students.find((s) => s.id === w.student_id);
                  return (
                    <li key={i}>
                      ⚠️ {student?.name}：{w.reason}
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              提交后，这些记录将被标记为"时长异常"，但星星照常计算。
              <br />
              <strong>业务说明：</strong>系统不替业务判断对错，只做标记留痕。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setPendingBatch([]);
                }}
                className="flex-1 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消，返回修改
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="flex-1 py-2 bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors"
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

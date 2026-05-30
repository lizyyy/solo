import { useEffect, useState } from "react";
import { Plus, Search, Edit3, Archive, Sparkles } from "lucide-react";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";

export default function Students() {
  const { students, fetchStudents, addStudent, updateStudent } = useStore();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<{
    id?: number;
    name: string;
    enroll_date: string;
    note: string;
    status: "active" | "archived";
  } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    enroll_date: new Date().toISOString().split("T")[0],
    note: "",
  });

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent?.id) {
      await updateStudent(editingStudent.id, formData);
    } else {
      await addStudent(formData);
    }
    setShowModal(false);
    setEditingStudent(null);
    setFormData({
      name: "",
      enroll_date: new Date().toISOString().split("T")[0],
      note: "",
    });
  };

  const openEdit = (student: typeof students[0]) => {
    setEditingStudent({
      id: student.id,
      name: student.name,
      enroll_date: student.enroll_date,
      note: student.note,
      status: student.status,
    });
    setFormData({
      name: student.name,
      enroll_date: student.enroll_date,
      note: student.note,
    });
    setShowModal(true);
  };

  const toggleArchive = async (student: typeof students[0]) => {
    await updateStudent(student.id, {
      status: student.status === "active" ? "archived" : "active",
    });
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-display text-secondary mb-2">学生名册</h1>
        <p className="text-gray-500">管理所有在读和归档的学生</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="搜索学生姓名..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors"
        >
          <Plus size={20} />
          新增学生
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map((student) => (
          <div
            key={student.id}
            className={cn(
              "bg-white rounded-xl p-5 shadow-sm border transition-all hover:shadow-md",
              student.status === "archived" && "opacity-60"
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display text-xl text-secondary">
                  {student.name}
                </h3>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    student.status === "active"
                      ? "bg-mint/20 text-mint"
                      : "bg-gray-100 text-gray-500"
                  )}
                >
                  {student.status === "active" ? "在读" : "已归档"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-gold">
                <Sparkles size={16} />
                <span className="font-bold text-xl">{student.total_stars}</span>
              </div>
            </div>

            <div className="text-sm text-gray-500 mb-4 space-y-1">
              <p>入学日期：{student.enroll_date}</p>
              {student.note && <p>备注：{student.note}</p>}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => openEdit(student)}
                className="flex-1 flex items-center justify-center gap-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Edit3 size={16} />
                编辑
              </button>
              <button
                onClick={() => toggleArchive(student)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-2 text-sm rounded-lg transition-colors",
                  student.status === "active"
                    ? "bg-coral/10 text-coral hover:bg-coral/20"
                    : "bg-mint/10 text-mint hover:bg-mint/20"
                )}
              >
                <Archive size={16} />
                {student.status === "active" ? "归档" : "恢复"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>暂无学生记录</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="font-display text-xl text-secondary mb-4">
              {editingStudent ? "编辑学生" : "新增学生"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  学生姓名
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  入学日期
                </label>
                <input
                  type="date"
                  required
                  value={formData.enroll_date}
                  onChange={(e) =>
                    setFormData({ ...formData, enroll_date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  备注
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingStudent(null);
                  }}
                  className="flex-1 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

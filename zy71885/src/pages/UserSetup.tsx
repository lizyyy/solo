import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { User, UserPlus, ArrowLeft } from "lucide-react";
import { useAppStore } from "@/store";
import type { UserRole } from "@/types";

export function UserSetup() {
  const navigate = useNavigate();
  const { users, currentUserId, addUser, setCurrentUser } = useAppStore();
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("assistant");

  const handleAddUser = () => {
    if (!name.trim()) return;
    const user = addUser(name.trim(), role);
    setCurrentUser(user.id);
    setName("");
  };

  const handleSelectUser = (userId: string) => {
    setCurrentUser(userId);
  };

  return (
    <div className="min-h-screen bg-lab-bg text-lab-text flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate("/import")}
          className="flex items-center gap-2 text-lab-textMuted hover:text-lab-text mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回应用
        </button>

        <div className="card">
          <h1 className="text-xl font-bold text-lab-accent mb-2">操作人设置</h1>
          <p className="text-sm text-lab-textMuted mb-6">
            选择或创建操作人，所有操作都会记录操作人信息
          </p>

          {users.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium mb-3 text-lab-text">已有操作人</h2>
              <div className="space-y-2">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded border transition-all ${
                      currentUserId === user.id
                        ? "border-lab-accent bg-lab-accent/10 shadow-glow-amber"
                        : "border-lab-bgLighter hover:bg-lab-bgLighter/50"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        currentUserId === user.id
                          ? "bg-lab-accent text-lab-bg"
                          : "bg-lab-bgLighter text-lab-textMuted"
                      }`}
                    >
                      <User className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-lab-textMuted">
                        {user.role === "assistant" ? "实验室助教" : "任课教师"}
                      </p>
                    </div>
                    {currentUserId === user.id && (
                      <span className="ml-auto text-xs text-lab-accent font-medium">
                        当前
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-lab-bgLighter pt-6">
            <h2 className="text-sm font-medium mb-3 text-lab-text flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              新建操作人
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-lab-textMuted mb-1">姓名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入姓名"
                  className="input-field"
                  onKeyDown={(e) => e.key === "Enter" && handleAddUser()}
                />
              </div>
              <div>
                <label className="block text-xs text-lab-textMuted mb-1">角色</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRole("assistant")}
                    className={`flex-1 py-2 px-3 rounded border text-sm transition-all ${
                      role === "assistant"
                        ? "border-lab-accent bg-lab-accent/10 text-lab-accent"
                        : "border-lab-bgLighter text-lab-textMuted hover:bg-lab-bgLighter/50"
                    }`}
                  >
                    实验室助教
                  </button>
                  <button
                    onClick={() => setRole("teacher")}
                    className={`flex-1 py-2 px-3 rounded border text-sm transition-all ${
                      role === "teacher"
                        ? "border-lab-accent bg-lab-accent/10 text-lab-accent"
                        : "border-lab-bgLighter text-lab-textMuted hover:bg-lab-bgLighter/50"
                    }`}
                  >
                    任课教师
                  </button>
                </div>
              </div>
              <button
                onClick={handleAddUser}
                disabled={!name.trim()}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建并设为当前操作人
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

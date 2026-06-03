import { useState } from "react";
import { useGateStore } from "@/store/useGateStore";
import type { OperatorRole } from "@/types";

export default function LoginOverlay() {
  const currentUser = useGateStore((s) => s.currentUser);
  const login = useGateStore((s) => s.login);

  const [name, setName] = useState("");
  const [role, setRole] = useState<OperatorRole>("instructor");

  if (currentUser) return null;

  const handleLogin = () => {
    if (name.trim()) {
      login(name.trim(), role);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(15, 26, 46, 0.95)" }}>
      <div className="w-96 rounded-xl p-8 border"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--color-steel)" }}>
          水库闸门开度展示
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
          请输入工号和角色进入系统
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--color-text-muted)" }}>
              工号/姓名
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入工号或姓名"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors"
              style={{
                backgroundColor: "var(--color-bg)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-steel)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
              onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--color-text-muted)" }}>
              角色
            </label>
            <div className="flex gap-3">
              {(["instructor", "field_team"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border transition-all"
                  style={{
                    backgroundColor: role === r ? "var(--color-steel)" : "transparent",
                    borderColor: role === r ? "var(--color-steel)" : "var(--color-border)",
                    color: role === r ? "#fff" : "var(--color-text-muted)",
                  }}
                >
                  {r === "instructor" ? "培训教官" : "现场班组"}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={!name.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-bold transition-all"
            style={{
              backgroundColor: name.trim() ? "var(--color-steel)" : "var(--color-border)",
              color: name.trim() ? "#fff" : "var(--color-text-muted)",
              cursor: name.trim() ? "pointer" : "not-allowed",
            }}
          >
            进入系统
          </button>
        </div>
      </div>
    </div>
  );
}

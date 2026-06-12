import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { api } from "@/api/client";
import { useAppStore } from "@/store/appStore";

export default function Layout() {
  const location = useLocation();
  const { setError, clearError, error } = useAppStore();
  const [pendingConflicts, setPendingConflicts] = useState(0);
  const [pendingReview, setPendingReview] = useState(0);

  const loadCounts = async () => {
    try {
      const [conflictsRes, subsRes] = await Promise.all([
        api.conflicts.list(),
        api.records.unreviewedSubstitutes(),
      ]);
      setPendingConflicts(conflictsRes.data.length);
      setPendingReview(subsRes.count);
    } catch (err) {
      console.error("Load counts error:", err);
    }
  };

  useEffect(() => {
    loadCounts();
  }, [location.pathname]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <div className="min-h-screen gradient-bg flex">
      <Sidebar pendingConflicts={pendingConflicts} pendingReview={pendingReview} />

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 font-serif">
              {location.pathname === "/" && "音频文件备注导入"}
              {location.pathname === "/conflicts" && "冲突处理"}
              {location.pathname === "/results" && "归并结果展示"}
              {location.pathname === "/audit" && "审计追踪"}
              {location.pathname === "/self-check" && "系统自检报告"}
              {location.pathname.startsWith("/supplement") && "信息补录"}
            </h2>
            <button
              onClick={loadCounts}
              className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
            >
              刷新数据
            </button>
          </div>
        </header>

        {error && (
          <div className="mx-8 mt-4 p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm animate-fade-in">
            {error}
          </div>
        )}

        <div className="flex-1 p-8 overflow-auto scrollbar-thin">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

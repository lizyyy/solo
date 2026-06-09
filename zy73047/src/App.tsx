import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Activity, GitBranch, Hand, FileText, Landmark, RotateCcw } from 'lucide-react';
import ScheduleList from '@/pages/ScheduleList';
import ScheduleDetail from '@/pages/ScheduleDetail';
import HandoffBoard from '@/pages/HandoffBoard';
import HandoverCenter from '@/pages/HandoverCenter';
import { useScheduleStore } from '@/store/useScheduleStore';
import { useState } from 'react';
import Modal from '@/components/Modal';

function Nav() {
  const reset = useScheduleStore((s) => s.resetToSeed);
  const [confirm, setConfirm] = useState(false);
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="container max-w-[1600px] px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-sm">
            <Landmark size={20} />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-slate-800 tracking-tight">桥梁支座备件排程</div>
            <div className="text-[10px] text-slate-500">
              异常不被均值掩盖 · 图表→日志→材料 全程可追溯
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-1 flex-wrap">
          <NavLink to="/schedules" end className="nav-link">
            <Activity size={15} /> 排程看板
          </NavLink>
          <NavLink to="/handoff" className="nav-link">
            <Hand size={15} /> 交接状态
          </NavLink>
          <NavLink to="/handover" className="nav-link">
            <FileText size={15} /> 收尾文档
          </NavLink>
          <div className="mx-2 h-5 w-px bg-slate-200" />
          <button
            onClick={() => setConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="重置为初始演示数据"
          >
            <RotateCcw size={14} /> 重置演示数据
          </button>
        </nav>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="重置演示数据？"
        footer={
          <>
            <button
              onClick={() => setConfirm(false)}
              className="px-4 py-1.5 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={() => {
                reset();
                setConfirm(false);
              }}
              className="px-4 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
            >
              确认重置
            </button>
          </>
        }
      >
        <div className="text-sm text-slate-600 leading-relaxed">
          所有补录、改判、状态切换将被清除，恢复到初始的两个小包排程演示数据。
          此操作主要用于向运营主管和接手人做完整演示。
        </div>
      </Modal>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-full flex flex-col bg-slate-50">
        <Nav />
        <main className="flex-1">
          <div className="page-root">
            <Routes>
              <Route path="/" element={<Navigate to="/schedules" replace />} />
              <Route path="/schedules" element={<ScheduleList />} />
              <Route path="/schedules/:id" element={<ScheduleDetail />} />
              <Route path="/handoff" element={<HandoffBoard />} />
              <Route path="/handover" element={<HandoverCenter />} />
              <Route path="*" element={<Navigate to="/schedules" replace />} />
            </Routes>
          </div>
        </main>
        <footer className="border-t border-slate-200 bg-white/70 mt-8">
          <div className="container max-w-[1600px] px-4 py-4 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <GitBranch size={13} />
              <span>现场调度小宋 · 运营主管审看 · 接手人核对 · 三方共用同一链路</span>
            </div>
            <div className="tabular-nums">
              数据仅保存在本机 localStorage · 版本 v0.1.0
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

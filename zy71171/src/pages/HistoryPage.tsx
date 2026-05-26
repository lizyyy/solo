import { useNavigate } from "react-router-dom";
import { useHistoryStore } from "@/store/useHistoryStore";
import { LEVELS } from "@/data/levels";
import { ArrowLeft, Trash2, Play, Trophy, AlertTriangle } from "lucide-react";
import { clearHistory } from "@/utils/storage";

export default function HistoryPage() {
  const { records, refresh } = useHistoryStore();
  const nav = useNavigate();

  return (
    <div className="min-h-full flex flex-col">
      <div className="px-6 py-3 border-b border-cold-line flex items-center gap-3">
        <button className="btn" onClick={() => nav("/")}>
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>
        <div className="text-sm text-cold-mute">历史回放（数据保存在本地浏览器）</div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm("确定清空全部历史记录？")) {
                clearHistory();
                refresh();
              }
            }}
          >
            <Trash2 className="w-4 h-4" /> 清空
          </button>
          <button className="btn" onClick={refresh}>
            刷新
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 py-6">
        {records.length === 0 ? (
          <div className="text-center text-cold-mute py-20">暂无历史记录</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {records.map((r) => {
              const lvl = LEVELS.find((l) => l.id === r.levelId);
              return (
                <div key={r.id} className="panel p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="font-display font-bold text-white">
                      {lvl?.name ?? r.levelId}
                    </div>
                    {r.result === "won" ? (
                      <Trophy className="w-4 h-4 text-amber-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <div className="text-xs text-cold-mute font-mono">
                    {new Date(r.finishedAt).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="chip bg-sky-500/15 border-sky-400/60 text-sky-200">
                      得分 {r.score}
                    </span>
                    <span className="chip border-slate-600 bg-slate-800/40 text-slate-300">
                      {r.result === "won" ? "通关" : "失败"}
                    </span>
                    {r.reason && (
                      <span className="chip bg-rose-500/15 border-rose-400/60 text-rose-200">
                        {r.reason}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-cold-line">
                    <button className="btn btn-primary" onClick={() => nav(`/replay/${r.id}`)}>
                      <Play className="w-4 h-4" /> 回放
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

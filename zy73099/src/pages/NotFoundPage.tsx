import { Link } from 'react-router-dom';
import { Home, ArrowLeft, SearchX, ShieldAlert } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col items-center justify-center px-4 py-12">
      <div className="absolute -top-10 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-100/60 blur-3xl" />
      <div className="absolute bottom-0 right-0 -z-10 h-56 w-56 rounded-full bg-amber-100/60 blur-3xl" />

      <div className="text-center animate-[fadeInUp_0.4s_ease-out]">
        <div className="mb-6 inline-flex">
          <div className="relative">
            <div className="absolute inset-0 animate-[pulse_2s_infinite] rounded-3xl bg-orange-200/60 blur-xl" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-400 via-amber-400 to-rose-400 shadow-xl shadow-orange-200/60 ring-4 ring-white">
              <SearchX className="h-10 w-10 text-white" strokeWidth={2} />
            </div>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="font-mono text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 sm:text-8xl">
            404
          </span>
          <ShieldAlert className="mb-1 h-8 w-8 text-orange-500 sm:h-10 sm:w-10" strokeWidth={2} />
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          页面走丢了
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500 sm:text-[15px]">
          这个链接不存在，或者交底记录已被删除。
          别担心，所有操作都有本地备份，你可以从主页重新开始。
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 text-sm font-semibold text-white shadow-lg shadow-orange-200/60 transition hover:from-orange-600 hover:to-amber-600 hover:shadow-xl hover:shadow-orange-200/80"
          >
            <Home className="h-4.5 w-4.5" strokeWidth={2.2} />
            返回交底清单主页
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4.5 w-4.5" strokeWidth={2.2} />
            回到上一页
          </button>
        </div>

        <div className="mt-12 rounded-2xl border border-slate-100 bg-white/60 p-5 backdrop-blur-sm shadow-sm">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            异常出口说明
          </div>
          <div className="grid grid-cols-1 gap-3 text-left text-[12.5px] leading-relaxed text-slate-600 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50/60 p-3">
              <div className="font-semibold text-slate-800">材料入口异常</div>
              <div className="mt-0.5 text-slate-500">上传格式错误会在导入页显示详细错误，可修改后重试。</div>
            </div>
            <div className="rounded-xl bg-orange-50/60 p-3">
              <div className="font-semibold text-orange-800">坐标偏移卡壳</div>
              <div className="mt-0.5 text-orange-600">详情页会提示卡住原因+下一步找谁补件，不会迷路。</div>
            </div>
            <div className="rounded-xl bg-emerald-50/60 p-3">
              <div className="font-semibold text-emerald-800">操作不可逆</div>
              <div className="mt-0.5 text-emerald-600">撤回/确认永久留痕，第二天复盘差异仍可查看。</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

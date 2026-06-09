import TopNav from '@/components/TopNav';
import StatsCards from '@/components/StatsCards';
import AbnormalTimeline from '@/components/AbnormalTimeline';
import WorkOrderSidebar from '@/components/WorkOrderSidebar';
import SparePartsPanel from '@/components/SparePartsPanel';
import CalcFormulaPanel from '@/components/CalcFormulaPanel';
import EvidenceManager from '@/components/EvidenceManager';
import PlaybackHistory from '@/components/PlaybackHistory';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { ScrollText, Info } from 'lucide-react';

export default function Home() {
  const selectedOrder = usePlaybackStore((s) => s.workOrders.find((o) => o.id === s.selectedOrderId));

  return (
    <div className="min-h-screen bg-coolgray-100">
      <TopNav />

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        <div className="rounded-md border-l-4 border-coral-400 bg-gradient-to-r from-coral-50/90 via-white to-white p-4 shadow-card flex items-start gap-3 animate-slide-down">
          <div className="w-10 h-10 rounded-sm bg-coral-400 text-white flex items-center justify-center shrink-0 shadow-inner">
            <Info className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div className="flex-1 text-sm">
            <p className="text-coolgray-800 leading-relaxed">
              <span className="font-bold text-coral-600">使用提示：</span>
              上方时间轴中<span className="bg-coral-100 px-1 rounded-sm font-medium">珊瑚色块</span>代表备件到货延误，
              <span className="bg-navy-500 text-white px-1 rounded-sm font-medium">深蓝色块</span>代表型号替换被拦截。
              点击异常块可直接跳转至对应备件行和拦截说明，同时联动计算口径。
              左侧工单列表示例了 <span className="font-bold">顺利 / 补录 / 异常×2</span> 四种典型场景，可逐一演示。
            </p>
          </div>
        </div>

        <StatsCards />

        <AbnormalTimeline />

        <div className="flex gap-6 items-start">
          <WorkOrderSidebar />

          <div className="flex-1 min-w-0 space-y-5">
            {selectedOrder && (
              <div className="card p-5 animate-slide-down">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-md bg-gradient-to-br from-navy-500 to-navy-600 text-white flex items-center justify-center shadow-inner">
                      <ScrollText className="w-7 h-7" strokeWidth={1.8} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-black text-navy-600">
                          {selectedOrder.pumpStationName}
                        </h3>
                        <span className="font-mono text-sm text-coolgray-500 bg-coolgray-100 px-2 py-0.5 rounded-sm">
                          {selectedOrder.orderNo}
                        </span>
                        {selectedOrder.status === 'smooth' && (
                          <span className="tag bg-jade-50 text-jade-500 border border-jade-200 font-medium">✓ 顺利完成</span>
                        )}
                        {selectedOrder.status === 'supplement' && (
                          <span className="tag bg-amber-50 text-amber-600 border border-amber-200 font-medium">⚠ 待补录</span>
                        )}
                        {selectedOrder.status === 'abnormal' && (
                          <span className="tag bg-coral-50 text-coral-500 border border-coral-200 font-medium">⚠ 含异常</span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
                        <div>
                          <span className="text-coolgray-400">计划停机：</span>
                          <span className="font-mono text-coolgray-700 ml-1">
                            {selectedOrder.plannedStartTime.slice(5, 16)} ~ {selectedOrder.plannedEndTime.slice(11, 16)}
                          </span>
                        </div>
                        <div>
                          <span className="text-coolgray-400">实际停机：</span>
                          <span className="font-mono text-navy-600 ml-1">
                            {selectedOrder.actualStartTime
                              ? `${selectedOrder.actualStartTime.slice(5, 16)} ~ ${selectedOrder.actualEndTime?.slice(11, 16)}`
                              : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-coolgray-400">备件总数：</span>
                          <span className="font-mono text-coolgray-700 ml-1">{selectedOrder.spareParts.length} 项</span>
                        </div>
                        <div>
                          <span className="text-coolgray-400">当前版本：</span>
                          <span className="font-mono text-navy-600 font-bold ml-1">
                            {selectedOrder.versions[selectedOrder.versions.length - 1]?.version}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <EvidenceManager />
              <PlaybackHistory />
            </div>

            <SparePartsPanel />

            <CalcFormulaPanel />
          </div>
        </div>

        <footer className="text-center text-xs text-coolgray-400 pt-2 pb-6">
          © 2026 泵站巡检工单回放系统 · 所有版本记录均本地持久化，刷新不丢失
        </footer>
      </main>
    </div>
  );
}

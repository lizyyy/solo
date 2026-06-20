import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { TracePanel } from '@/components/layout/TracePanel';
import { ScatterChart } from '@/components/chart/ScatterChart';
import { SampleTable } from '@/components/table/SampleTable';
import { useAppStore } from '@/store/useAppStore';

export default function Home() {
  const tracePanelOpen = useAppStore((state) => state.tracePanelOpen);

  return (
    <div className="flex h-screen flex-col bg-[#F8F5F0]">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main
          className={`flex-1 overflow-y-auto p-6 transition-all duration-300 ${
            tracePanelOpen ? 'mr-[480px]' : ''
          }`}
        >
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold" style={{ fontFamily: 'Noto Serif SC, serif' }}>
                    交班复核指引
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-blue-100">
                    1. 点击统计图中红色异常点 → 自动定位表格行并展开追溯面板
                    <br />
                    2. 核对「评分备注」「计算口径」「线索链」三个标签页
                    <br />
                    3. 必要时添加后补备注，系统会自动记录到线索链
                    <br />
                    4. 导出时使用当前筛选口径，确保屏幕与文件一致
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-blue-200">测试数据</div>
                  <div className="text-xs text-blue-300">4条样本 · 覆盖全场景</div>
                </div>
              </div>
            </div>

            <ScatterChart />
            <SampleTable />

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">排班同事操作指南</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <StepCard
                  step={1}
                  title="选择参数版本"
                  desc="左上角切换v1.0/v1.1，观察阈值变化对结果的影响"
                />
                <StepCard
                  step={2}
                  title="点击异常点"
                  desc="在统计图中点击红色点，表格会自动定位并高亮"
                />
                <StepCard
                  step={3}
                  title="追溯核对"
                  desc="在右侧面板查看评分备注、计算口径和完整线索链"
                />
                <StepCard
                  step={4}
                  title="导出记录"
                  desc="点击导出按钮，文件会保留所有筛选条件和异常痕迹"
                />
              </div>
            </div>
          </div>
        </main>
      </div>
      <TracePanel />
    </div>
  );
}

interface StepCardProps {
  step: number;
  title: string;
  desc: string;
}

function StepCard({ step, title, desc }: StepCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {step}
        </span>
        <span className="font-medium text-slate-800">{title}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{desc}</p>
    </div>
  );
}

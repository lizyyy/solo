import { FlaskConical, Info } from 'lucide-react';
import ParameterInput from '@/components/ParameterInput';
import ResultDisplay from '@/components/ResultDisplay';
import SampleImporter from '@/components/SampleImporter';
import ReportExporter from '@/components/ReportExporter';
import { useFlowStore } from '@/store/useFlowStore';

export default function Home() {
  const { currentSampleName, currentSampleId, result } = useFlowStore();

  return (
    <div className="min-h-screen bg-zinc-50 grain-overlay">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-100 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-800" style={{ fontFamily: '"LXGW WenKai", "Noto Sans SC", serif' }}>
                流体雷诺数判别
              </h1>
              <p className="text-xs text-zinc-500">化工实验教学工具</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SampleImporter />
            <ReportExporter />
          </div>
        </div>
      </header>

      {(currentSampleName || result) && (
        <div className="container mx-auto px-4 pt-4">
          <div className={`rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm border ${
            currentSampleId === 'sample-4'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-teal-50 border-teal-200 text-teal-800'
          }`}>
            <Info className="w-4 h-4 flex-shrink-0" />
            <div>
              {currentSampleId === 'sample-4' ? (
                <>
                  <span className="font-medium">待补资料记录：</span>
                  <span>黏度单位疑似错误、温度缺失，请先修正再计算，或直接查看异常标注</span>
                </>
              ) : currentSampleName ? (
                <>
                  <span className="font-medium">当前样例：</span>
                  <span>{currentSampleName} · 点击「计算雷诺数」查看结果</span>
                </>
              ) : result ? (
                <>
                  <span>数据已输入完成，可查看计算结果或导出报告</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <ParameterInput />

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5 space-y-3">
              <h3 className="text-sm font-bold text-zinc-700" style={{ fontFamily: '"LXGW WenKai", "Noto Sans SC", serif' }}>
                使用指引
              </h3>
              <div className="space-y-2 text-xs text-zinc-600">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-mono text-[10px] flex-shrink-0 mt-0.5">1</span>
                  <span>点击「导入样例」选择预设数据，或手动输入参数</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-mono text-[10px] flex-shrink-0 mt-0.5">2</span>
                  <span>点击「计算雷诺数」查看 Re 值、流态判定和单位换算过程</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-mono text-[10px] flex-shrink-0 mt-0.5">3</span>
                  <span>查看异常标注（橙色标签），点击可展开解释与修正建议</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-mono text-[10px] flex-shrink-0 mt-0.5">4</span>
                  <span>点击「导出报告」生成并下载 HTML 格式判别报告</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5">
              <h3 className="text-sm font-bold text-zinc-700 mb-3" style={{ fontFamily: '"LXGW WenKai", "Noto Sans SC", serif' }}>
                判别标准
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm">Re &lt; 2000 → <span className="font-medium text-emerald-700">层流</span></span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-sm">2000 ≤ Re ≤ 4000 → <span className="font-medium text-amber-700">过渡区（临界）</span></span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm">Re &gt; 4000 → <span className="font-medium text-red-700">紊流</span></span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <ResultDisplay />
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-4 py-6 mt-8 border-t border-zinc-100">
        <div className="text-center text-xs text-zinc-400">
          <p>流体雷诺数判别工具 · 化工实验教学辅助</p>
          <p className="mt-1">所有计算在浏览器端完成，数据不上传服务器</p>
        </div>
      </footer>
    </div>
  );
}

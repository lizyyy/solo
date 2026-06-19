import TopSummaryBar from "@/components/layout/TopSummaryBar";
import FormulaSidebar from "@/components/layout/FormulaSidebar";
import DraftDataTable from "@/components/table/DraftDataTable";
import ResultPanel from "@/components/panels/ResultPanel";
import ExceptionPanel from "@/components/panels/ExceptionPanel";
import UnitMissingDialog from "@/components/dialogs/UnitMissingDialog";
import { useFittingStore } from "@/stores/fittingStore";
import { Plus, Upload } from "lucide-react";

export default function FittingPage() {
  const s = useFittingStore();
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <TopSummaryBar />
      <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 108px)" }}>
        <FormulaSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5 min-w-[960px]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="font-serif text-xl text-ink-900">批量验算工作台</h1>
                <p className="text-xs text-ink-500 mt-0.5">
                  所有公式、单位、边界阈值均已透明展示在左侧；结论和摘要与顶部栏、沟通页严格一致。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-secondary !py-1.5">
                  <Upload className="w-4 h-4" /> 导入学生草稿 CSV
                </button>
                <button className="btn-secondary !py-1.5">
                  <Plus className="w-4 h-4" /> 新增样本行
                </button>
                <button onClick={() => s.refreshFitting()} className="btn-primary !py-1.5">
                  ▶ 重新执行拟合验算
                </button>
              </div>
            </div>

            <DraftDataTable />

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
              <div className="xl:col-span-3 space-y-4">
                <ResultPanel />
              </div>
              <div className="xl:col-span-2 space-y-4">
                <ExceptionPanel />
                <div className="card p-4">
                  <div className="card-header !px-0 !pt-0">
                    <h3 className="card-title !text-sm">实时摘要预览</h3>
                    <span className="text-[11px] text-ink-500">与顶部栏、沟通页同源</span>
                  </div>
                  <div className="text-xs text-ink-600 leading-relaxed space-y-1.5 mt-2">
                    <p>
                      <b className="text-ink-800">判断：</b>
                      <span className={
                        s.summary?.verdictLevel === "pass" ? "text-verdict-pass" :
                        s.summary?.verdictLevel === "warn" ? "text-verdict-warn" : "text-verdict-fail"
                      }>
                        {s.summary?.verdictText}
                      </span>
                    </p>
                    <p><b className="text-ink-800">边界处理：</b>{s.summary?.boundaryNote}</p>
                    <p><b className="text-ink-800">单位确认：</b>{s.summary?.unitNote}</p>
                    <p><b className="text-ink-800">异常摘要：</b>{s.summary?.exceptionNote}</p>
                    <p className="text-[11px] text-ink-400 pt-1 border-t border-ink-100">
                      摘要校验码：<code className="font-mono text-ember-600">{s.summary?.hash}</code>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <UnitMissingDialog />
    </div>
  );
}

import { Link } from "react-router-dom";
import { ChevronRight, FileSearch, Puzzle, BarChart3, AlertOctagon } from "lucide-react";
import TopSummaryBar from "@/components/layout/TopSummaryBar";
import ParamVersionList from "@/components/review/ParamVersionList";
import ExplainBlock from "@/components/review/ExplainBlock";
import ExceptionPanel from "@/components/panels/ExceptionPanel";
import ResultPanel from "@/components/panels/ResultPanel";
import { useFittingStore } from "@/stores/fittingStore";

export default function ReviewPage() {
  const s = useFittingStore();

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <TopSummaryBar />
      <div className="flex-1 overflow-y-auto" style={{ height: "calc(100vh - 108px)" }}>
        <div className="p-6 max-w-[1400px] mx-auto space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-ink-600">
              <Link to="/" className="btn-secondary !py-1.5">
                <ChevronRight className="w-4 h-4 rotate-180" /> 返回验算主页
              </Link>
              <span className="divider-dot" />
              <Link to="/summary" className="btn-ghost">查看沟通摘要 →</Link>
            </div>
            <div className="flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-ember-500" />
              <h1 className="font-serif text-xl text-ink-900">复核视图 · 参数版本 & 异常点 & 解释同屏</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-5 space-y-4">
              <ParamVersionList />

              <div className="card p-4 space-y-3">
                <div className="card-header !px-0 !pt-0">
                  <div className="flex items-center gap-2">
                    <Puzzle className="w-4 h-4 text-ember-500" />
                    <h3 className="card-title !text-sm">结论链路解释</h3>
                  </div>
                  <span className="text-[11px] text-ink-500">每一步为什么这样判断</span>
                </div>

                <ExplainBlock
                  title={`为什么最终判断是「${s.summary?.verdictText ?? "—"}」？`}
                  openKey="rv_verdict"
                  isOpen={!!s.explainOpen["rv_verdict"]}
                  onToggle={() => s.toggleExplain("rv_verdict")}
                  tone={s.summary?.verdictLevel === "pass" ? "pass" : s.summary?.verdictLevel === "warn" ? "warn" : "warn"}
                  badge={`${s.summary?.verdictLevel ?? ""}`}
                >
                  <ol className="list-decimal pl-5 space-y-1.5">
                    <li>有效样本数 <b>{s.summary?.validRows}</b>（扣除撤回 <b>{s.summary?.withdrawnRows}</b> 条后参与拟合）。</li>
                    <li>
                      拟合质量 R² = <b>{s.summary?.rSquared.toFixed(4)}</b>，
                      {s.summary && s.summary.rSquared >= 0.99 ? " ≥ 0.99 为优秀区间；" :
                       s.summary && s.summary.rSquared >= 0.95 ? " ∈ [0.95, 0.99) 为合格区间；" :
                       " < 0.95 需要引起重视；"}
                      RMSE = <b>{s.summary?.rmse.toFixed(4)}</b> N。
                    </li>
                    <li>异常类样本：边界 <b>{s.summary?.boundaryRows}</b> 条、单位缺失待处理 <b>{s.summary?.missingUnitRows}</b> 条、偏差超阈值 <b>{s.summary?.highDeviationRows}</b> 条。</li>
                    <li>综合规则：单位未确认 → 判定为「待处理」；R²&lt;0.95 或高偏差&gt;2 条 → 判定为「需复核」；边界样本存在但质量达标 → 判定为「可通过·建议二次核验」；其他为「通过」。</li>
                  </ol>
                </ExplainBlock>

                <ExplainBlock
                  title="边界样本是如何判定的？"
                  openKey="rv_boundary"
                  isOpen={!!s.explainOpen["rv_boundary"]}
                  onToggle={() => s.toggleExplain("rv_boundary")}
                  tone="warn"
                  badge={`${s.summary?.boundaryRows ?? 0} 条命中`}
                >
                  <p>边界判定采用「范围 + 容差带」双条件：</p>
                  <ul className="list-disc pl-5 space-y-1 mt-1">
                    <li>对 x、y 分别按参数版本中的阈值 [min, max] 判断是否在有效区间。</li>
                    <li>额外对 min、max 各扩展 ±5% 的容差带，凡落入容差带内均标记为「边界样本」。</li>
                    <li>边界样本仍参与拟合（不做自动剔除），仅在 UI 和摘要中高亮，提醒教练人工二次核验。</li>
                    <li>当前参数版本的阈值见左侧「参数版本管理」卡，可切换不同版本观察边界判定差异。</li>
                  </ul>
                </ExplainBlock>

                <ExplainBlock
                  title="单位缺失人工确认后，哪些地方会留存记录？"
                  openKey="rv_unit"
                  isOpen={!!s.explainOpen["rv_unit"]}
                  onToggle={() => s.toggleExplain("rv_unit")}
                  tone="info"
                >
                  <p>单位人工确认（含「确认理由」「影响范围」「补录值」）会同步写入：</p>
                  <ol className="list-decimal pl-5 space-y-1 mt-1">
                    <li>草稿表格行级详情（点击行号左侧展开箭头可查看）。</li>
                    <li>验算页面右侧「实时摘要预览」的单位确认摘要段。</li>
                    <li>顶部摘要栏（底部指标条）→ 沟通摘要卡片 → 复制的纯文本摘要（同源数据）。</li>
                    <li>本复核视图的异常聚合卡（「单位缺失」分组）。</li>
                  </ol>
                </ExplainBlock>

                <ExplainBlock
                  title="拟合参数 a、b、c 的实际物理含义是什么？"
                  openKey="rv_meaning"
                  isOpen={!!s.explainOpen["rv_meaning"]}
                  onToggle={() => s.toggleExplain("rv_meaning")}
                  tone="default"
                >
                  <p>以当前场景 <b>胡克定律 F = k·Δx</b> 为例：</p>
                  <ul className="list-disc pl-5 space-y-1 mt-1">
                    <li>线性模型 y = a·x + b：系数 <b>a</b> 即弹簧<strong>劲度系数 k</strong>（单位 N/m），系数 <b>b</b> 反映系统误差（例如弹簧原长测量偏差）。</li>
                    <li>二次模型：x² 项系数反映形变滞后或非线性弹性，越大说明弹簧越偏离理想胡克定律。</li>
                    <li>教练交接时建议重点对比不同参数版本下 a 的相对误差，&lt;2% 通常视为一致。</li>
                  </ul>
                </ExplainBlock>
              </div>
            </div>

            <div className="xl:col-span-7 space-y-4">
              <div className="card p-4">
                <div className="card-header !px-0 !pt-0">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-ember-500" />
                    <h3 className="card-title !text-sm">异常点聚合 · 点击可展开行级追溯</h3>
                  </div>
                </div>
                <div className="pt-1">
                  <ExceptionPanel />
                </div>
              </div>

              <div className="card p-4">
                <div className="card-header !px-0 !pt-0">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-ember-500" />
                    <h3 className="card-title !text-sm">中间过程与拟合质量 · 同屏追溯</h3>
                  </div>
                  <span className="text-[11px] text-ink-500">切换参数版本后此区自动重新计算</span>
                </div>
                <div className="pt-1">
                  <ResultPanel />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

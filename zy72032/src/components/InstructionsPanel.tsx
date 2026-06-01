import { useState } from "react"
import { ChevronDown, ChevronUp, Play, RefreshCw, History } from "lucide-react"

export default function InstructionsPanel() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-6 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
      >
        <h3 className="text-lg font-bold">操作说明</h3>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="px-6 pb-6 animate-fade-in">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-400/20 flex items-center justify-center flex-shrink-0">
                <Play className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <h4 className="font-medium mb-1">怎么启动训练</h4>
                <p className="text-sm text-slate-400">
                  在上方选择想要练习的关卡包，点击"开始训练"按钮即可。每局 1-2 分钟就能完成，适合课堂快节奏练习。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-success" />
              </div>
              <div>
                <h4 className="font-medium mb-1">怎么换一组关卡</h4>
                <p className="text-sm text-slate-400">
                  回到首页，点击不同的关卡包卡片即可切换。我们准备了"基础客服通关"、"情绪安抚专项"、"退换货判定"三套关卡，难度递增。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
                <History className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h4 className="font-medium mb-1">怎么看一局的历史</h4>
                <p className="text-sm text-slate-400">
                  点击顶部导航"记录"，可以看到所有完成的局次。点击任意记录的"查看详情"按钮，就能看到完整的选择链路、每步的扣分原因，以及补录备注。
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-700/30 rounded-lg">
              <h4 className="font-medium mb-2 text-sm">课堂使用小贴士</h4>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• 投影大屏上建议用 Chrome 全屏模式（F11）</li>
                <li>• 结算页的扣分明细可以一条条念给学员听</li>
                <li>• 遇到边界情况可以暂停讲解，暂停记录会被保留</li>
                <li>• 汇总页的"异常追踪"可以看到所有暂停、超时、边界分数，不会在汇总里消失</li>
                <li>• 补录备注时可以同时调整分数，系统会自动计算新的通过状态</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { FileText, Upload, BarChart3, CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react';

export function Guide() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">使用指南</h1>
        <p className="text-gray-500">训练任务排队系统操作说明</p>
      </div>

      <div className="space-y-6">
        <section className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Upload className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">如何放置线上反馈样例</h2>
              <p className="text-gray-600 text-sm">正确记录线上反馈的来源和详情</p>
            </div>
          </div>

          <div className="space-y-4 ml-14">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <div>
                <p className="font-medium text-gray-700">选择来源类型</p>
                <p className="text-sm text-gray-500">在新建任务时，来源类型选择「线上反馈」</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <div>
                <p className="font-medium text-gray-700">填写来源详情</p>
                <p className="text-sm text-gray-500">在「来源详情」字段填写具体的工单编号或链接，例如：</p>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg font-mono text-sm">
                  客服工单 #20240528-001 或 用户反馈链接
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <div>
                <p className="font-medium text-gray-700">详细描述问题</p>
                <p className="text-sm text-gray-500">在任务描述中清晰说明用户反馈的具体问题和场景</p>
              </div>
            </div>
          </div>

          <div className="mt-6 ml-14 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">注意</p>
                <p className="text-sm text-amber-700">如果线上反馈早到、配置文件晚到，请在「待处理原因」中注明："等待配置文件"。配置文件到达后，修改任务状态并注明原因，系统会自动记录变更历史。</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">去哪看指标口径变了</h2>
              <p className="text-gray-600 text-sm">追踪训练日志和指标的变更历史</p>
            </div>
          </div>

          <div className="space-y-4 ml-14">
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-700">任务详情页 → 修改历史</p>
                <p className="text-sm text-gray-500">进入任务详情页面，切换到「修改历史」标签页</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-700">点击历史记录查看差异</p>
                <p className="text-sm text-gray-500">左侧列表显示所有修改记录，点击任意一条可在右侧查看具体变更内容</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-700">颜色标识说明</p>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-emerald-100 border border-emerald-300 rounded"></span>
                    <span className="text-sm text-gray-600">绿色背景 = 新增内容</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-rose-100 border border-rose-300 rounded"></span>
                    <span className="text-sm text-gray-600">红色背景 + 删除线 = 删除内容</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">导出评估说明前怎么复核</h2>
              <p className="text-gray-600 text-sm">确保评估说明与明细一致的核对步骤</p>
            </div>
          </div>

          <div className="ml-14 space-y-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="font-medium text-gray-700 mb-2">第一步：核对训练日志与评估说明</p>
              <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
                <li>切换到「训练日志」标签，查看具体指标数值</li>
                <li>切换到「评估说明」标签，确认结论与日志数据一致</li>
                <li>特别注意准确率、损失函数等关键指标</li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="font-medium text-gray-700 mb-2">第二步：检查修改历史</p>
              <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
                <li>查看是否有影响评估结论的关键修改</li>
                <li>确认每次修改都有明确的原因说明</li>
                <li>区分"补材料"与"实质修改"的历史记录</li>
              </ul>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <p className="font-medium text-gray-700 mb-2">第三步：确认任务状态与原因</p>
              <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
                <li>如果是"补材料"任务，确认待处理原因已明确说明</li>
                <li>确认任务状态与当前实际进度一致</li>
                <li>负责人信息是否正确</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 ml-14 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800">复核通过后</p>
                <p className="text-sm text-emerald-700">点击页面右上角的「导出评估」按钮，系统会自动生成包含所有信息的 Markdown 格式评估报告。</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-violet-100 rounded-lg">
              <FileText className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">区分补材料与实际修改</h2>
              <p className="text-gray-600 text-sm">如何正确标注不同类型的任务变更</p>
            </div>
          </div>

          <div className="ml-14 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-600">场景</th>
                  <th className="text-left p-3 font-medium text-gray-600">来源类型</th>
                  <th className="text-left p-3 font-medium text-gray-600">待处理原因</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="p-3 text-gray-700">线上反馈先到，配置文件未到</td>
                  <td className="p-3">线上反馈</td>
                  <td className="p-3 text-gray-500">等待配置文件</td>
                </tr>
                <tr>
                  <td className="p-3 text-gray-700">配置文件晚到，只是补充材料</td>
                  <td className="p-3">配置文件</td>
                  <td className="p-3 text-gray-500">补材料：配置文件晚到，无实质修改</td>
                </tr>
                <tr>
                  <td className="p-3 text-gray-700">手工调整训练日志格式</td>
                  <td className="p-3">手工修改</td>
                  <td className="p-3 text-gray-500">按新规范调整日志格式</td>
                </tr>
                <tr>
                  <td className="p-3 text-gray-700">重新训练，指标有变化</td>
                  <td className="p-3">其他</td>
                  <td className="p-3 text-gray-500">重新训练，优化参数</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, RotateCcw, Flag, SkipForward, Settings, History, HelpCircle, BookOpen } from 'lucide-react';

export default function HelpPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-serif text-xl font-bold text-neutral-800">使用帮助</h1>
            <p className="text-xs text-neutral-500">股票新闻快反局 - 操作指南</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="card">
          <h2 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOpen size={20} className="text-primary-500" />
            什么是股票新闻快反局？
          </h2>
          <p className="text-neutral-600 leading-relaxed mb-3">
            这是投资社团内部的新闻事件快速反应训练工具。模拟真实市场中，突发新闻出现时，
            你需要在有限时间内做出买入、卖出或观望的决策。每局结束后会生成完整的交易报告，
            方便复盘和讨论。
          </p>
          <p className="text-sm text-neutral-500">
            💡 设计初衷：解决投影大屏复盘时暂停后局面混乱的问题，让每一次训练都有完整记录可追溯。
          </p>
        </div>

        <div className="card">
          <h2 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
            <Play size={20} className="text-success-500" />
            怎么启动一局？
          </h2>
          <ol className="space-y-3 text-neutral-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <div>
                <p className="font-medium">进入首页</p>
                <p className="text-sm text-neutral-500">默认会加载"训练关卡-基础版"配置</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <div>
                <p className="font-medium">开始对局</p>
                <p className="text-sm text-neutral-500">点击左侧控制面板的"开始对局"按钮</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <div>
                <p className="font-medium">基于新闻交易</p>
                <p className="text-sm text-neutral-500">每条新闻右下角有"基于此新闻交易"按钮，点击后可进行买卖操作</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <div>
                <p className="font-medium">进入下一回合</p>
                <p className="text-sm text-neutral-500">本回合决策完成后，点击"下一回合"继续</p>
              </div>
            </li>
          </ol>
        </div>

        <div className="card">
          <h2 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings size={20} className="text-warning-500" />
            怎么换一组关卡？
          </h2>
          <ol className="space-y-3 text-neutral-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-warning-100 text-warning-600 rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <div>
                <p className="font-medium">进入关卡管理</p>
                <p className="text-sm text-neutral-500">点击首页右上角齿轮图标，或访问 <code className="bg-neutral-100 px-1 rounded">/config</code></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-warning-100 text-warning-600 rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <div>
                <p className="font-medium">选择预设或上传</p>
                <p className="text-sm text-neutral-500">可选择系统预设的4组关卡，也可上传自定义JSON配置</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-warning-100 text-warning-600 rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <div>
                <p className="font-medium">处理配置异常</p>
                <p className="text-sm text-neutral-500">系统会自动检测空关卡、重复事件、边界值等问题，可一键自动修复</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-warning-100 text-warning-600 rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <div>
                <p className="font-medium">加载配置</p>
                <p className="text-sm text-neutral-500">确认无误后点击"加载此配置"，回到首页即可开始新局</p>
              </div>
            </li>
          </ol>
        </div>

        <div className="card">
          <h2 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
            <History size={20} className="text-primary-500" />
            怎么看一局的历史？
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-neutral-700 mb-2">查看历史记录列表</h3>
              <p className="text-sm text-neutral-600 mb-2">
                点击首页右上角时钟图标，或访问 <code className="bg-neutral-100 px-1 rounded">/history</code>，
                可查看所有已完成的对局记录，包括收益率、胜率、最大回撤等关键指标。
              </p>
            </div>
            <div>
              <h3 className="font-medium text-neutral-700 mb-2">查看完整报告</h3>
              <p className="text-sm text-neutral-600 mb-2">
                点击任意记录或"报告"按钮，可查看该对局的完整报告，包含：
              </p>
              <ul className="list-disc list-inside text-sm text-neutral-500 space-y-1 ml-2">
                <li>收益率曲线图</li>
                <li>关键绩效指标（年化收益、胜率、最大回撤等）</li>
                <li>每笔交易的明细（可展开查看决策理由和新闻来源）</li>
                <li>最终持仓明细</li>
                <li>支持导出CSV/JSON格式</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-neutral-700 mb-2">回放对局过程</h3>
              <p className="text-sm text-neutral-600">
                点击"回放"按钮，可逐回合回放当时的新闻、交易决策和资产状态，支持倍速播放。
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
            <HelpCircle size={20} className="text-primary-500" />
            核心操作说明
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Play size={18} className="text-success-500" />
                <span className="font-medium">开始对局</span>
              </div>
              <p className="text-sm text-neutral-500">从待开始状态进入进行中状态，开始计时</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Pause size={18} className="text-warning-500" />
                <span className="font-medium">暂停</span>
              </div>
              <p className="text-sm text-neutral-500">锁定当前局面，回合数和持仓保持不变</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Play size={18} className="text-success-500" />
                <span className="font-medium">继续</span>
              </div>
              <p className="text-sm text-neutral-500">从暂停处恢复，局面保持一致</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <SkipForward size={18} className="text-primary-500" />
                <span className="font-medium">下一回合</span>
              </div>
              <p className="text-sm text-neutral-500">保存当前回合数据，进入下一回合</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Flag size={18} className="text-primary-500" />
                <span className="font-medium">手动结算</span>
              </div>
              <p className="text-sm text-neutral-500">提前结束对局，生成最终报告</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw size={18} className="text-neutral-500" />
                <span className="font-medium">重新开始</span>
              </div>
              <p className="text-sm text-neutral-500">重置所有数据，开始新的一局</p>
            </div>
          </div>
        </div>

        <div className="card bg-primary-50 border-primary-200">
          <h2 className="font-serif text-lg font-semibold mb-3 text-primary-800">重要提醒</h2>
          <ul className="space-y-2 text-sm text-primary-700">
            <li className="flex items-start gap-2">
              <span className="text-primary-500">•</span>
              <span><strong>数据一致性：</strong>报告和明细使用同一数据源，确保不会出现两套说法</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">•</span>
              <span><strong>可追溯性：</strong>每条新闻都保留原始来源、处理时间和处理人，接手时不用再问小林</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">•</span>
              <span><strong>状态稳定：</strong>暂停、继续、重开后，回合数和结算原因保持稳定</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500">•</span>
              <span><strong>自动保存：</strong>对局状态实时保存到本地，刷新页面不丢失</span>
            </li>
          </ul>
        </div>

        <div className="text-center text-xs text-neutral-400 py-4">
          <p>股票新闻快反局 v1.0 · 投资社团内部训练工具</p>
          <p className="mt-1">遇到问题请联系社团技术组</p>
        </div>
      </main>
    </div>
  );
}

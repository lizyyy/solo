import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plane, Package, Zap, AlertTriangle, Clock, Target, Trophy } from 'lucide-react';
import { levelConfigs } from '@/utils/levelConfigs';

export const HelpPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950/20 to-gray-950 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          返回主菜单
        </button>

        <h1 className="text-4xl font-bold mb-8 text-center">游戏帮助</h1>

        <div className="space-y-8">
          <section className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-400" />
              游戏目标
            </h2>
            <p className="text-gray-300 leading-relaxed">
              作为机场地服人员，你的任务是将传送带上的行李准确分拣到对应的航班口。
              注意识别行李类型（普通、转机、超规）和航班状态（正点、延误、取消），
              在时间压力下保持高准确率，达到关卡通关条件。
            </p>
          </section>

          <section className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Package className="w-6 h-6 text-orange-400" />
              行李类型
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <h3 className="font-bold text-blue-400">普通行李</h3>
                </div>
                <p className="text-sm text-gray-400">
                  标准行李，直接送往行李牌上显示的航班口即可。
                </p>
              </div>
              <div className="bg-orange-900/20 rounded-xl p-4 border border-orange-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                  <h3 className="font-bold text-orange-400">转机行李</h3>
                </div>
                <p className="text-sm text-gray-400">
                  需要转机的行李，顶部有橙色球体标记。注意转机剩余时间，超时会被计为错误。
                </p>
              </div>
              <div className="bg-red-900/20 rounded-xl p-4 border border-red-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <h3 className="font-bold text-red-400">超规行李</h3>
                </div>
                <p className="text-sm text-gray-400">
                  超重或超大行李，顶部有红色八面体标记。必须送往专门的 OVERSIZE 口。
                </p>
              </div>
            </div>
          </section>

          <section className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Plane className="w-6 h-6 text-cyan-400" />
              航班状态
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-green-900/20 rounded-xl p-4 border border-green-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <h3 className="font-bold text-green-400">正点</h3>
                </div>
                <p className="text-sm text-gray-400">
                  航班正常运行，行李按正常流程送往对应航班口。
                </p>
              </div>
              <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <h3 className="font-bold text-yellow-400">延误</h3>
                </div>
                <p className="text-sm text-gray-400">
                  航班延误，可选择将行李送往 STORAGE 转存口等待。
                </p>
              </div>
              <div className="bg-red-900/20 rounded-xl p-4 border border-red-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <h3 className="font-bold text-red-400">取消</h3>
                </div>
                <p className="text-sm text-gray-400">
                  航班已取消，行李必须送往 STORAGE 转存口，否则计为错误。
                </p>
              </div>
            </div>
          </section>

          <section className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-400" />
              操作说明
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-yellow-400 font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">切换传送带方向</h3>
                  <p className="text-gray-400 text-sm">
                    点击场景中的黄色切换器（带有红色指示灯的圆柱体），可以切换该节点的传送带方向。
                    切换器周围会显示可选择的航班口选项。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-blue-400 font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">查看行李详情</h3>
                  <p className="text-gray-400 text-sm">
                    点击传送带上的任意行李，可以在左侧面板查看该行李的详细信息，
                    包括航班号、目的地、重量、转机时间等。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-green-400 font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">调整视角</h3>
                  <p className="text-gray-400 text-sm">
                    鼠标左键拖动可以旋转视角，滚轮可以缩放。
                    按空格键可以快速暂停/继续游戏。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              计分规则
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-300">普通行李正确送达</span>
                <span className="text-green-400 font-mono font-bold">+100 分</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-300">转机行李正确送达（转机时间充足）</span>
                <span className="text-green-400 font-mono font-bold">+200 分</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-300">转机行李正确送达（转机时间紧张）</span>
                <span className="text-green-400 font-mono font-bold">+150 分</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-300">超规行李正确送达</span>
                <span className="text-green-400 font-mono font-bold">+200 分</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-300">任何分拣错误</span>
                <span className="text-red-400 font-mono font-bold">-50 分</span>
              </div>
            </div>
          </section>

          <section className="bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6 text-purple-400" />
              关卡介绍
            </h2>
            <div className="space-y-4">
              {levelConfigs.map((level) => (
                <div
                  key={level.id}
                  className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg text-white">{level.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      level.difficulty === 'easy' ? 'bg-green-900/50 text-green-400' :
                      level.difficulty === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>
                      {level.difficulty === 'easy' ? '简单' : level.difficulty === 'medium' ? '中等' : '困难'}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">{level.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-gray-700 px-2 py-1 rounded">
                      时间: {Math.floor(level.timeLimit / 60)}分{level.timeLimit % 60}秒
                    </span>
                    <span className="bg-gray-700 px-2 py-1 rounded">
                      航班口: {level.gates.filter(g => g.type === 'normal').length}个
                    </span>
                    <span className="bg-gray-700 px-2 py-1 rounded">
                      准确率≥{level.passConditions.minAccuracy * 100}%
                    </span>
                    <span className="bg-gray-700 px-2 py-1 rounded">
                      错误≤{level.passConditions.maxErrors}个
                    </span>
                    {level.hasTransfer && (
                      <span className="bg-orange-900/50 text-orange-400 px-2 py-1 rounded">含转机</span>
                    )}
                    {level.hasOversize && (
                      <span className="bg-red-900/50 text-red-400 px-2 py-1 rounded">含超规</span>
                    )}
                    {level.hasDelays && (
                      <span className="bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded">含延误</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-2xl p-6 border border-blue-700/50">
            <h2 className="text-2xl font-bold mb-4">💡 游戏技巧</h2>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <span>提前观察下一个行李的信息，在行李到达切换器前做好准备</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <span>转机行李顶部有橙色标记，优先处理转机时间紧张的行李</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <span>超规行李顶部有红色八面体标记，记得送往 OVERSIZE 口</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <span>关注右侧航班状态面板，延误/取消航班的行李需要转存</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <span>游戏结束后可以查看详细报告，分析错误原因，提升分拣水平</span>
              </li>
            </ul>
          </section>
        </div>

        <div className="text-center mt-12 pb-8">
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-xl font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:scale-105"
          >
            开始游戏
          </button>
        </div>
      </div>
    </div>
  );
};

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, Clock, Trophy, Target } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { SCORE_RULES } from '../data/levels';

export default function Rules() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首页
          </Button>
          <h1 className="text-2xl font-bold font-mono">游戏规则</h1>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" />
                游戏目标
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300">
                作为码头闸口验放员，你需要快速准确地判断每一辆集装箱车辆是否可以放行。
                仔细核对箱号、车牌与预约单是否一致，检查是否有危险品标记，
                确保只有符合条件的车辆才能通过闸口。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                验放规则
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 border-l-4 border-green-600">
                  <h4 className="font-bold text-green-400 mb-2">✅ 可以放行的条件</h4>
                  <ul className="text-slate-300 text-sm space-y-1">
                    <li>• 箱号与预约单完全一致</li>
                    <li>• 车牌与预约单完全一致</li>
                    <li>• 无危险品标记，或危险品已申报</li>
                    <li>• 预约单有效</li>
                  </ul>
                </div>
                <div className="bg-slate-800 p-4 border-l-4 border-red-600">
                  <h4 className="font-bold text-red-400 mb-2">❌ 需要拦截的情况</h4>
                  <ul className="text-slate-300 text-sm space-y-1">
                    <li>• 箱号不匹配</li>
                    <li>• 车牌不匹配</li>
                    <li>• 有危险品标记但未申报</li>
                    <li>• 预约单已失效</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                计分规则
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-green-900/30 p-3">
                    <span className="text-slate-300">正确放行</span>
                    <span className="font-mono font-bold text-green-400">
                      +{SCORE_RULES.CORRECT_PASS} 分
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-green-900/30 p-3">
                    <span className="text-slate-300">正确拦截</span>
                    <span className="font-mono font-bold text-green-400">
                      +{SCORE_RULES.CORRECT_INTERCEPT} 分
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-green-900/30 p-3">
                    <span className="text-slate-300">正确拦截危品</span>
                    <span className="font-mono font-bold text-green-400">
                      +{SCORE_RULES.CORRECT_INTERCEPT + SCORE_RULES.DANGEROUS_INTERCEPT_BONUS} 分
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-red-900/30 p-3">
                    <span className="text-slate-300">错误放行</span>
                    <span className="font-mono font-bold text-red-400">
                      {SCORE_RULES.WRONG_PASS} 分
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-red-900/30 p-3">
                    <span className="text-slate-300">错误拦截</span>
                    <span className="font-mono font-bold text-red-400">
                      {SCORE_RULES.WRONG_INTERCEPT} 分
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-red-900/30 p-3">
                    <span className="text-slate-300">处理超时</span>
                    <span className="font-mono font-bold text-red-400">
                      {SCORE_RULES.TIMEOUT} 分
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-orange-900/30 p-3">
                    <span className="text-slate-300">队列拥挤（每车/秒</span>
                    <span className="font-mono font-bold text-orange-400">
                      {SCORE_RULES.QUEUE_PENALTY_PER_VEHICLE} 分
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-4">
                💡 提示：队列中车辆超过3辆时，每多1辆每秒额外扣分50分。
                达到及格分数即可通关并解锁下一关卡。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                操作方式
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold text-slate-300 mb-2">鼠标操作</h4>
                  <ul className="text-slate-400 text-sm space-y-1">
                    <li>• 点击「放行」按钮 - 放行车辆</li>
                    <li>• 点击「拦截」按钮 - 拦截车辆</li>
                    <li>• 点击「暂停」按钮 - 暂停游戏</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-slate-300 mb-2">键盘快捷键</h4>
                  <ul className="text-slate-400 text-sm space-y-1">
                    <li>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">空格</kbd> /{' '}
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Enter</kbd> - 放行
                    </li>
                    <li>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">
                        Backspace
                      </kbd>{' '}
                      /{' '}
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Delete</kbd> - 拦截
                    </li>
                    <li>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">P</kbd>{' '}
                      /{' '}
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Esc</kbd> - 暂停/继续
                    </li>
                    <li>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Ctrl+R</kbd> - 重新开始
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                常见陷阱
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-slate-300 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400">⚠️</span>
                  <span>
                    <strong>相似字符混淆：</strong>注意区分 0/O、1/I/L、2/Z、5/S、8/B 等相似字符
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400">⚠️</span>
                  <span>
                    <strong>预约单信息不一致：</strong>仔细核对每个字符，多一位或少一位都算不匹配
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400">⚠️</span>
                  <span>
                    <strong>危险品标记：</strong>危品标记可能出现在集装箱的任何位置，注意仔细检查
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400">⚠️</span>
                  <span>
                    <strong>时间压力：</strong>注意倒计时结束自动判为失误，平衡速度和准确率
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400">⚠️</span>
                  <span>
                    <strong>队列拥挤：</strong>不要让队列排太长，否则会额外扣分
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button variant="primary" size="lg" onClick={() => navigate('/')}>
            开始游戏
          </Button>
        </div>
      </div>
    </div>
  );
}

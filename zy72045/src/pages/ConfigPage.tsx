import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { ConfigLoader } from '../components/config/ConfigLoader';
import { useGameLogic } from '../hooks/useGameLogic';

export default function ConfigPage() {
  const navigate = useNavigate();
  const { canStart } = useGameLogic();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-serif text-xl font-bold text-neutral-800">关卡管理</h1>
              <p className="text-xs text-neutral-500">选择或上传关卡配置，支持异常检测与自动修复</p>
            </div>
          </div>
          {canStart && (
            <button
              onClick={() => navigate('/')}
              className="btn-primary text-sm flex items-center gap-1"
            >
              <Play size={16} />
              开始对局
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <ConfigLoader />

        <div className="card mt-6 bg-neutral-50 border-neutral-200">
          <h3 className="font-serif text-lg font-semibold mb-3">配置格式说明</h3>
          <div className="text-sm text-neutral-600 space-y-2">
            <p><span className="font-medium">关卡配置文件为JSON格式，包含以下字段：</span></p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-neutral-500">
              <li><code className="bg-white px-1 rounded">id</code>: 关卡唯一标识</li>
              <li><code className="bg-white px-1 rounded">name</code>: 关卡名称</li>
              <li><code className="bg-white px-1 rounded">description</code>: 关卡描述</li>
              <li><code className="bg-white px-1 rounded">totalRounds</code>: 总回合数</li>
              <li><code className="bg-white px-1 rounded">initialCapital</code>: 初始资金</li>
              <li><code className="bg-white px-1 rounded">stocks</code>: 可交易标的列表</li>
              <li><code className="bg-white px-1 rounded">rounds</code>: 回合配置，包含新闻事件和大盘指数</li>
            </ul>
            <p className="mt-3">
              <span className="font-medium">异常处理：</span>
              系统会自动检测空关卡、重复事件ID、影响指数超出[-100,100]边界等问题，并提供自动修复功能。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

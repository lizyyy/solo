import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function ErrorPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const error = location.state?.error as { technicalMessage: string; userMessage: string; field: string } | undefined

  const handleReset = () => {
    localStorage.clear()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-8">
      <div className="bg-paper-cream text-charcoal p-8 max-w-2xl w-full border-2 border-danger-red">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-danger-red/10 rounded-full">
            <AlertTriangle size={32} className="text-danger-red" />
          </div>
          <div className="flex-1">
            <h1 className="font-mono text-2xl font-bold text-danger-red mb-2">
              ⚠️ 配置错误
            </h1>
            <p className="text-charcoal/70 mb-4">
              给科普馆讲解员小夏的提示：系统检测到配置问题，请不要担心，数据都在。
              请按下方提示检查后重试。
            </p>
          </div>
        </div>

        {error ? (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-4 border border-charcoal/20">
              <div className="text-xs text-charcoal/50 font-mono mb-1">通俗解释</div>
              <div className="text-charcoal">{error.userMessage}</div>
            </div>
            <div className="bg-charcoal/5 p-4 border border-charcoal/10">
              <div className="text-xs text-charcoal/50 font-mono mb-1">技术信息</div>
              <div className="text-charcoal/70 font-mono text-xs break-all">
                {error.field} - {error.technicalMessage}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-danger-red/10 border border-danger-red/30 p-4 mb-6">
            <p className="text-danger-red font-medium mb-2">可能的原因：</p>
            <ul className="text-charcoal/70 text-sm space-y-1">
              <li>• 材料包 JSON 格式有语法错误</li>
              <li>• 材料或槽位缺少必要的字段</li>
              <li>• 游戏规则参数设置不合理</li>
              <li>• 本地存储的数据损坏</li>
            </ul>
          </div>
        )}

        <div className="bg-charcoal/5 p-4 mb-6 text-sm">
          <p className="font-medium mb-2">建议的解决步骤：</p>
          <ol className="text-charcoal/70 space-y-1 list-decimal list-inside">
            <li>返回配置页面，检查材料包 JSON 格式是否正确</li>
            <li>点击"验证配置"按钮，查看具体的错误信息</li>
            <li>如果是导入的材料包，请检查是否符合规范</li>
            <li>如果问题持续，可以尝试"恢复默认"或"重置所有数据"</li>
          </ol>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-charcoal text-paper-cream 
              font-mono hover:bg-charcoal/90 transition-colors"
          >
            <ArrowLeft size={18} />
            返回首页
          </button>
          <button
            onClick={() => navigate('/config')}
            className="flex items-center gap-2 px-6 py-3 bg-calm-blue text-charcoal 
              font-mono hover:bg-calm-blue/90 transition-colors"
          >
            检查配置
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 border-2 border-charcoal/30 
              text-charcoal font-mono hover:bg-charcoal/10 transition-colors"
          >
            <RefreshCw size={18} />
            重置所有数据
          </button>
        </div>

        <p className="text-center text-charcoal/40 text-xs mt-8">
          保险理赔逃脱屋 · 版本 0.1.0 · 专为科普馆讲解员小夏定制
        </p>
      </div>
    </div>
  )
}

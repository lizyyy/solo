import { Play, RotateCcw, History, BookOpen } from 'lucide-react'

export default function Guide() {
  return (
    <div className="pt-20 bg-cafe-cream min-h-screen">
      <div className="max-w-3xl mx-auto px-4 space-y-8">
        <h1 className="font-serif text-3xl text-cafe-brown">操作说明</h1>

        <div className="card-cafe">
          <div className="flex items-center gap-2 mb-4">
            <Play className="w-5 h-5 text-safe-green" />
            <h2 className="font-serif text-xl text-cafe-brown">如何启动</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cafe-brown text-cafe-cream flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <p className="text-sm text-cafe-brown/70">在首页选择想要挑战的关卡</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cafe-brown text-cafe-cream flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <p className="text-sm text-cafe-brown/70">点击"开始挑战"进入咖啡馆游戏</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cafe-brown text-cafe-cream flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <p className="text-sm text-cafe-brown/70">从左侧资源架拖入基金到操作台，调整配比后提交组合</p>
            </div>
          </div>
        </div>

        <div className="card-cafe">
          <div className="flex items-center gap-2 mb-4">
            <RotateCcw className="w-5 h-5 text-data-blue" />
            <h2 className="font-serif text-xl text-cafe-brown">如何换一组关卡</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cafe-brown text-cafe-cream flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <p className="text-sm text-cafe-brown/70">方法一：返回首页选择其他关卡</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cafe-brown text-cafe-cream flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <p className="text-sm text-cafe-brown/70">方法二：完成当前关卡后选择下一关</p>
            </div>
          </div>
        </div>

        <div className="card-cafe">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-risk-yellow" />
            <h2 className="font-serif text-xl text-cafe-brown">如何查看历史</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cafe-brown text-cafe-cream flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <p className="text-sm text-cafe-brown/70">点击顶部导航栏"历史记录"</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cafe-brown text-cafe-cream flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <p className="text-sm text-cafe-brown/70">查看所有已完成游戏</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cafe-brown text-cafe-cream flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <p className="text-sm text-cafe-brown/70">点击进入查看详细汇总</p>
            </div>
          </div>
        </div>

        <div className="card-cafe flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-cafe-brown/50 shrink-0 mt-0.5" />
          <p className="text-sm text-cafe-brown/50">
            活动策划阿蓝可在补录工作台中添加备注，补录后的差异会清晰标注
          </p>
        </div>
      </div>
    </div>
  )
}

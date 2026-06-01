import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Home } from 'lucide-react'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center">
      <div className="text-center">
        <div className="font-mono text-8xl font-bold text-calm-blue mb-4">404</div>
        <h1 className="font-mono text-2xl text-paper-cream mb-2">页面不存在</h1>
        <p className="text-white/50 mb-8">你访问的页面在保险理赔逃脱屋中不存在</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 text-paper-cream 
              font-mono hover:bg-white/20 transition-colors"
          >
            <ArrowLeft size={18} />
            返回上一页
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-calm-blue text-charcoal 
              font-mono hover:bg-calm-blue/90 transition-colors"
          >
            <Home size={18} />
            返回首页
          </button>
        </div>
      </div>
    </div>
  )
}

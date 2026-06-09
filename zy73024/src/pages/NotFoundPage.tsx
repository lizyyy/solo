import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-8xl mb-6">🐾</div>
        <h1 className="font-kai text-4xl text-clay-700 mb-3">404 · 找不到这份档案</h1>
        <p className="text-clay-500 mb-8 text-lg">
          可能是旧记录已归档，或链接输入错误
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/dashboard" className="btn-primary">
            📋 返回追踪汇总
          </Link>
          <Link to="/delivery" className="btn-ghost">
            📤 查看交付说明
          </Link>
        </div>
      </div>
    </div>
  )
}

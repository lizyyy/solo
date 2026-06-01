import { Link } from 'react-router-dom'
import { Coffee, BookOpen, History, HelpCircle } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

export default function Header() {
  const session = useGameStore((s) => s.session)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-cafe-brown text-cafe-cream flex items-center justify-between px-6">
      <Link to="/" className="flex items-center gap-2 font-serif text-xl font-bold tracking-wide">
        <Coffee className="w-6 h-6" />
        <span>基金组合咖啡馆</span>
      </Link>

      <nav className="flex items-center gap-6">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
        >
          <BookOpen className="w-4 h-4" />
          <span>关卡选择</span>
        </Link>
        <Link
          to="/history"
          className="flex items-center gap-1.5 text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
        >
          <History className="w-4 h-4" />
          <span>历史记录</span>
        </Link>
        <Link
          to="/guide"
          className="flex items-center gap-1.5 text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
        >
          <HelpCircle className="w-4 h-4" />
          <span>操作说明</span>
        </Link>
      </nav>

      <div className="flex items-center gap-2">
        {session && (
          <span className="flex items-center gap-1.5 text-xs bg-safe-green/20 text-safe-green px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-safe-green animate-pulse-soft" />
            游戏进行中
          </span>
        )}
      </div>
    </header>
  )
}

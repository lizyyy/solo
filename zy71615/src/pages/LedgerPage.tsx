import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { LedgerTable } from '../components/LedgerTable'
import { BalanceChart } from '../components/BalanceChart'

export function LedgerPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-amber-400 font-serif flex items-center gap-2">
                <BookOpen size={24} />
                现金账本
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                记录所有收支流水，每笔金额均可追溯来源
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4">
            <BalanceChart />
          </div>
          <div className="col-span-8">
            <LedgerTable />
          </div>
        </div>
      </div>
    </div>
  )
}

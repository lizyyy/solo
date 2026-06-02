import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { Upload, FilePlus, FlaskConical, Beaker } from 'lucide-react'
import type { RecordSource, CaliberType } from '@/types'

export default function DataImport() {
  const importHolidayData = useStore((s) => s.importHolidayData)
  const supplementAdjustment = useStore((s) => s.supplementAdjustment)
  const loadScenario = useStore((s) => s.loadScenario)

  const [holidayName, setHolidayName] = useState('')
  const [holidayAmount, setHolidayAmount] = useState('')
  const [holidayRemark, setHolidayRemark] = useState('')

  const [adjName, setAdjName] = useState('')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjCaliber, setAdjCaliber] = useState<CaliberType>('旧口径')
  const [adjRemark, setAdjRemark] = useState('')

  const handleHolidayImport = () => {
    if (!holidayName || !holidayAmount) return
    const amount = parseFloat(holidayAmount)
    importHolidayData([
      {
        name: holidayName,
        amount,
        status: amount === 0 && holidayRemark === '已冲正' ? '待风控复核' : '正常',
        remark: holidayRemark,
        source: '顺延说明' as RecordSource,
        caliber: '新口径' as CaliberType,
      },
    ])
    setHolidayName('')
    setHolidayAmount('')
    setHolidayRemark('')
  }

  const handleAdjImport = () => {
    if (!adjName || !adjAmount) return
    supplementAdjustment({
      name: adjName,
      amount: parseFloat(adjAmount),
      status: '尾差补录',
      remark: adjRemark || '尾差调整条补录',
      source: '尾差调整条' as RecordSource,
      caliber: adjCaliber,
    })
    setAdjName('')
    setAdjAmount('')
    setAdjRemark('')
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2
          className="text-2xl font-bold text-[#1a365d] mb-1"
          style={{ fontFamily: '"Noto Serif SC", serif' }}
        >
          数据导入
        </h2>
        <p className="text-sm text-slate-400">导入节假日顺延说明 · 补录尾差调整条</p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Upload size={18} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">节假日顺延说明导入</h3>
              <p className="text-xs text-slate-400">第一步：导入主流程数据</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">名称</label>
              <input
                type="text"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="例：2024-Q4 利息收入-A档"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">金额</label>
              <input
                type="number"
                value={holidayAmount}
                onChange={(e) => setHolidayAmount(e.target.value)}
                placeholder="例：1250000"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">备注</label>
              <input
                type="text"
                value={holidayRemark}
                onChange={(e) => setHolidayRemark(e.target.value)}
                placeholder="留空为正常，填写'已冲正'则标记待风控复核"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition"
              />
            </div>
            <button
              onClick={handleHolidayImport}
              disabled={!holidayName || !holidayAmount}
              className="w-full py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              导入顺延说明
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FilePlus size={18} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">尾差调整条补录</h3>
              <p className="text-xs text-slate-400">第二步：阿芬补看尾差调整条</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">名称</label>
              <input
                type="text"
                value={adjName}
                onChange={(e) => setAdjName(e.target.value)}
                placeholder="例：2024-Q3 尾差补录-基础资产池"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">金额</label>
              <input
                type="number"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="例：3500"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">口径</label>
              <select
                value={adjCaliber}
                onChange={(e) => setAdjCaliber(e.target.value as CaliberType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
              >
                <option value="旧口径">旧口径</option>
                <option value="新口径">新口径</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">备注</label>
              <input
                type="text"
                value={adjRemark}
                onChange={(e) => setAdjRemark(e.target.value)}
                placeholder="例：尾差调整条补录"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
              />
            </div>
            <button
              onClick={handleAdjImport}
              disabled={!adjName || !adjAmount}
              className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              补录尾差调整条
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <FlaskConical size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">测试场景快速加载</h3>
            <p className="text-xs text-slate-400">一键加载预设材料，验证不同处理结果</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => loadScenario('normal')}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition-colors group"
          >
            <Beaker size={20} className="text-emerald-600 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-emerald-800">正常材料</span>
            <span className="text-xs text-emerald-600">顺利记录，无冲突</span>
          </button>
          <button
            onClick={() => loadScenario('wrong-caliber')}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors group"
          >
            <Beaker size={20} className="text-amber-600 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-amber-800">错口径材料</span>
            <span className="text-xs text-amber-600">新旧口径冲突</span>
          </button>
          <button
            onClick={() => loadScenario('supplement')}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 transition-colors group"
          >
            <Beaker size={20} className="text-indigo-600 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-indigo-800">补录材料</span>
            <span className="text-xs text-indigo-600">尾差补录旧口径</span>
          </button>
        </div>
      </div>
    </div>
  )
}

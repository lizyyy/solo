import { useState } from "react"
import { Link } from "react-router-dom"
import { useEvidenceStore } from "@/store/useEvidenceStore"
import StatusBadge from "@/components/StatusBadge"
import type { RecordStatus } from "@/types"
import { ArrowRight, AlertTriangle, CheckCircle2, RefreshCw, RotateCcw } from "lucide-react"

const filterOptions: { value: RecordStatus | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "smooth", label: "顺利" },
  { value: "pending_review", label: "待复核" },
  { value: "supplemented", label: "已补录" },
  { value: "reviewed", label: "已复核" },
]

export default function Overview() {
  const { records, activeFilter, setActiveFilter, resetStore } = useEvidenceStore()

  const filteredRecords =
    activeFilter === "all"
      ? records
      : records.filter((r) => r.status === activeFilter)

  const stats = {
    total: records.length,
    smooth: records.filter((r) => r.status === "smooth").length,
    pending: records.filter((r) => r.status === "pending_review").length,
    supplemented: records.filter((r) => r.status === "supplemented").length,
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-pine-800">
            证据包总览
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            管理支付拒付证据记录，追踪处理状态
          </p>
        </div>
        <button
          onClick={resetStore}
          className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-all duration-200 flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          重置全部数据
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs text-gray-400 font-medium mb-1">总记录</p>
          <p className="text-2xl font-bold text-pine-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-xs text-emerald-600 font-medium">顺利</p>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{stats.smooth}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <p className="text-xs text-red-600 font-medium">待复核</p>
          </div>
          <p className="text-2xl font-bold text-red-700">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-1.5 mb-1">
            <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs text-amber-600 font-medium">已补录</p>
          </div>
          <p className="text-2xl font-bold text-amber-700">{stats.supplemented}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActiveFilter(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              activeFilter === opt.value
                ? "bg-pine-800 text-white shadow-md"
                : "bg-white text-gray-500 border border-gray-200 hover:border-pine-300 hover:text-pine-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredRecords.map((record, index) => (
          <Link
            key={record.id}
            to={record.status === "pending_review" ? "/import" : record.status === "supplemented" ? "/supplement" : "/audit"}
            className="block animate-slide-in"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-pine-200 transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-pine-50 flex items-center justify-center text-pine-700 font-bold text-xs">
                    {record.id.replace("REC-", "#")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-semibold text-pine-800">
                        {record.securityName}
                      </h3>
                      <span className="text-xs text-gray-400 font-mono">
                        {record.securityCode}
                      </span>
                      <StatusBadge status={record.status} />
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                      <span>
                        除权日：{record.correctedExDividendDate || record.exDividendDate}
                      </span>
                      {record.correctedExDividendDate && (
                        <span className="line-through text-red-400">
                          原口径 {record.exDividendDate}
                        </span>
                      )}
                      <span className="text-gray-300">|</span>
                      <span>
                        {record.custodianConfirmRef}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="text-right">
                    {record.currencyType === "MIXED" ? (
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-pine-800">
                          HKD {record.amountHKD?.toLocaleString()}
                        </p>
                        <p className="text-sm font-semibold text-red-600">
                          CNY {record.amountCNY?.toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-pine-800">
                        {record.currencyType} {(record.amountHKD || record.amountCNY)?.toLocaleString()}
                      </p>
                    )}
                    {record.currencyType === "MIXED" && (
                      <p className="text-[10px] text-red-500 font-medium mt-0.5">
                        港币/人民币同列
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-pine-600 transition-colors" />
                </div>
              </div>
            </div>
          </Link>
        ))}

        {filteredRecords.length === 0 && records.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">尚无记录</p>
            <p className="text-xs mt-1">请先到"托管确认导入"页上传 CSV 样例文件</p>
          </div>
        )}

        {filteredRecords.length === 0 && records.length > 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">暂无匹配的记录</p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useMemo } from "react"
import { useStore } from "@/store/useStore"
import { Link } from "react-router-dom"
import { Search, Shield, Calendar, FileText, History, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { cn } from "@/lib/utils"
import StatusBadge from "@/components/StatusBadge"

export default function InsuranceList() {
  const { insurancePolicies, records, getRecordById } = useStore()
  const [search, setSearch] = useState("")

  const stats = useMemo(() => {
    return {
      active: insurancePolicies.filter((p) => p.status === "active").length,
      pending: insurancePolicies.filter((p) => p.status === "pending").length,
      expired: insurancePolicies.filter((p) => p.status === "expired").length,
      cancelled: insurancePolicies.filter((p) => p.status === "cancelled").length,
    }
  }, [insurancePolicies])

  const filteredPolicies = useMemo(() => {
    if (!search) return insurancePolicies
    const searchLower = search.toLowerCase()
    return insurancePolicies.filter(
      (p) =>
        p.policyNumber.toLowerCase().includes(searchLower) ||
        p.artifactId.toLowerCase().includes(searchLower)
    )
  }, [insurancePolicies, search])

  const getLinkedRecordsCount = (policyId: string) => {
    return records.filter((r) => r.insurancePolicyId === policyId).length
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-semibold text-gray-900">保险单管理</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">有效</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Calendar className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待生效</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已过期</p>
              <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Shield className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已取消</p>
              <p className="text-2xl font-bold text-gray-600">{stats.cancelled}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="搜索保单号或文物编号..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPolicies.map((policy) => (
          <div
            key={policy.id}
            className={cn(
              "bg-white rounded-lg border overflow-hidden transition-shadow hover:shadow-md",
              policy.status === "expired" && "border-l-4 border-l-red-500"
            )}
          >
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xl font-bold text-gray-900">{policy.policyNumber}</p>
                  <p className="text-sm text-gray-500">保单号</p>
                </div>
                <StatusBadge status={policy.status} type="insurance" />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">文物编号:</span>
                  <span className="text-gray-900 font-medium">{policy.artifactId}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span className="text-gray-500">保障范围:</span>
                  <span className="text-gray-900">{policy.coverage}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">有效期:</span>
                  <span className="text-gray-900">
                    {format(new Date(policy.validFrom), "yyyy-MM-dd")} →{" "}
                    {format(new Date(policy.validTo), "yyyy-MM-dd")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">关联记录:</span>
                  <span className="text-sm font-semibold text-blue-600">
                    {getLinkedRecordsCount(policy.id)} 条
                  </span>
                </div>
                <Link
                  to={`/?insuranceStatus=linked&policyId=${policy.id}`}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  查看记录
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {policy.changeHistory.length > 0 && (
              <div className="bg-gray-50 px-4 py-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">变更历史</span>
                </div>
                <div className="space-y-2">
                  {policy.changeHistory.slice(-3).reverse().map((change) => (
                    <div
                      key={change.id}
                      className="text-xs bg-white p-2 rounded border"
                    >
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-gray-700">{change.field}:</span>
                        <span className="text-red-500 line-through">{change.oldValue}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-600 font-medium">{change.newValue}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-gray-500">{change.reason}</span>
                        <span className="text-gray-400">
                          {format(new Date(change.timestamp), "MM-dd HH:mm", { locale: zhCN })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

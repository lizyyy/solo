import { useState, useMemo } from "react"
import { useStore } from "@/store/useStore"
import { format } from "date-fns"
import { Calendar, MapPin, AlertTriangle, ChevronDown, ChevronUp, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import StatusBadge from "@/components/StatusBadge"
import type { ExhibitionChecklist, ExhibitionItem } from "@/types"

export default function ExhibitionList() {
  const { exhibitionChecklists, getLightingRecordById } = useStore()
  const [selectedExhibition, setSelectedExhibition] = useState<ExhibitionChecklist | null>(null)
  const [expandedLightingId, setExpandedLightingId] = useState<string | null>(null)

  const hasWarnings = useMemo(() => {
    if (!selectedExhibition) return false
    return selectedExhibition.items.some(
      (item) => !item.lightingRecordId || item.isDuplicate
    )
  }, [selectedExhibition])

  const missingLightingCount = useMemo(() => {
    if (!selectedExhibition) return 0
    return selectedExhibition.items.filter((item) => !item.lightingRecordId).length
  }, [selectedExhibition])

  const duplicateCount = useMemo(() => {
    if (!selectedExhibition) return 0
    return selectedExhibition.items.filter((item) => item.isDuplicate).length
  }, [selectedExhibition])

  const toggleLightingExpand = (id: string) => {
    setExpandedLightingId(expandedLightingId === id ? null : id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-semibold text-gray-900">布展清单</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-semibold text-gray-700">展览列表</h3>
          <div className="space-y-3">
            {exhibitionChecklists.map((exhibition) => (
              <div
                key={exhibition.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedExhibition(exhibition)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSelectedExhibition(exhibition)
                  }
                }}
                className={cn(
                  "bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                  selectedExhibition?.id === exhibition.id &&
                    "border-blue-500 ring-2 ring-blue-100"
                )}
              >
                <h4 className="font-semibold text-gray-900">{exhibition.exhibitionName}</h4>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {format(new Date(exhibition.startDate), "yyyy-MM-dd")} -{" "}
                    {format(new Date(exhibition.endDate), "yyyy-MM-dd")}
                  </span>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">展品数量: </span>
                  <span className="font-medium text-gray-900">{exhibition.items.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedExhibition ? (
            <div className="bg-white rounded-lg border">
              <div className="p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedExhibition.exhibitionName}
                </h3>
                <div className="flex items-center gap-6 mt-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      开始日期: {format(new Date(selectedExhibition.startDate), "yyyy年MM月dd日")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      结束日期: {format(new Date(selectedExhibition.endDate), "yyyy年MM月dd日")}
                    </span>
                  </div>
                </div>
              </div>

              {hasWarnings && (
                <div className="mx-6 mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">需要注意</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      {missingLightingCount > 0 && (
                        <span>
                          {missingLightingCount} 件展品缺少照明记录
                          {duplicateCount > 0 && "，"}
                        </span>
                      )}
                      {duplicateCount > 0 && (
                        <span>{duplicateCount} 件展品存在重复标记</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-gray-500">
                        <th className="pb-3 font-medium">文物编号</th>
                        <th className="pb-3 font-medium">位置</th>
                        <th className="pb-3 font-medium">备注</th>
                        <th className="pb-3 font-medium">照明状态</th>
                        <th className="pb-3 font-medium">照明详情</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedExhibition.items.map((item: ExhibitionItem) => {
                        const lightingRecord = item.lightingRecordId
                          ? getLightingRecordById(item.lightingRecordId)
                          : null
                        const isExpanded = expandedLightingId === item.lightingRecordId

                        return (
                          <tr key={item.id} className="align-top">
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{item.artifactId}</span>
                                {item.isDuplicate && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    重复
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1 text-gray-700">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                {item.position}
                              </div>
                            </td>
                            <td className="py-3 text-gray-600 text-sm">{item.notes || "-"}</td>
                            <td className="py-3">
                              <StatusBadge
                                status={lightingRecord ? "linked" : "missing"}
                                type="lighting"
                              />
                            </td>
                            <td className="py-3">
                              {lightingRecord ? (
                                <div>
                                  <button
                                    onClick={() => toggleLightingExpand(item.lightingRecordId!)}
                                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                                  >
                                    <Lightbulb className="w-4 h-4" />
                                    <span>
                                      {lightingRecord.lightType} · {lightingRecord.intensity} lux
                                    </span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                  {isExpanded && (
                                    <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                                      <div className="flex gap-2">
                                        <span className="text-gray-500">角度:</span>
                                        <span className="text-gray-900">{lightingRecord.angle}°</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <span className="text-gray-500">备注:</span>
                                        <span className="text-gray-900">{lightingRecord.notes || "-"}</span>
                                      </div>
                                      <div className="flex gap-2">
                                        <span className="text-gray-500">创建时间:</span>
                                        <span className="text-gray-900">
                                          {format(new Date(lightingRecord.createdAt), "yyyy-MM-dd HH:mm")}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border p-12 text-center">
              <p className="text-gray-500">请从左侧选择一个展览查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

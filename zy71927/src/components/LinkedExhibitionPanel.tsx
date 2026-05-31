import { useState } from 'react'
import { format } from 'date-fns'
import { GalleryVerticalEnd, Lightbulb, Link2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import StatusBadge from './StatusBadge'
import type { RestorationRecord } from '@/types'

interface LinkedExhibitionPanelProps {
  record: RestorationRecord
  className?: string
}

export default function LinkedExhibitionPanel({ record, className }: LinkedExhibitionPanelProps) {
  const { getExhibitionById, getLightingRecordById, exhibitionChecklists, lightingRecords, linkExhibition, linkLightingRecord } = useStore()
  const [showExhibitionForm, setShowExhibitionForm] = useState(false)
  const [showLightingForm, setShowLightingForm] = useState(false)
  const [selectedExhibitionId, setSelectedExhibitionId] = useState('')
  const [selectedLightingId, setSelectedLightingId] = useState('')

  const linkedExhibition = record.exhibitionId
    ? getExhibitionById(record.exhibitionId)
    : undefined

  const linkedLighting = record.lightingRecordId
    ? getLightingRecordById(record.lightingRecordId)
    : undefined

  const isDuplicateArtifact = linkedExhibition?.items.some(
    (item) => item.artifactId === record.artifactId && item.isDuplicate
  ) || false

  const availableExhibitions = exhibitionChecklists.filter((c) =>
    c.items.some((item) => item.artifactId === record.artifactId)
  )

  const availableLighting = lightingRecords.filter(
    (l) => l.artifactId === record.artifactId
  )

  const handleLinkExhibition = () => {
    if (selectedExhibitionId) {
      linkExhibition(record.id, selectedExhibitionId, '当前用户')
      setSelectedExhibitionId('')
      setShowExhibitionForm(false)
    }
  }

  const handleLinkLighting = () => {
    if (selectedLightingId) {
      linkLightingRecord(record.id, selectedLightingId, '当前用户')
      setSelectedLightingId('')
      setShowLightingForm(false)
    }
  }

  return (
    <div id="exhibition-panel" className={cn('space-y-4', className)}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GalleryVerticalEnd className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">关联展览</h3>
          </div>
          {!linkedExhibition && (
            <button
              onClick={() => setShowExhibitionForm(!showExhibitionForm)}
              className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
            >
              <Plus className="w-4 h-4" />
              关联
            </button>
          )}
        </div>

        {showExhibitionForm && !linkedExhibition && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <select
              value={selectedExhibitionId}
              onChange={(e) => setSelectedExhibitionId(e.target.value)}
              className={cn(
                'w-full px-3 py-2 border border-gray-300 rounded-lg mb-2',
                'focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm'
              )}
            >
              <option value="">选择展览</option>
              {availableExhibitions.map((exhibition) => (
                <option key={exhibition.id} value={exhibition.id}>
                  {exhibition.exhibitionName}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleLinkExhibition}
                disabled={!selectedExhibitionId}
                className={cn(
                  'flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm',
                  'hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
                )}
              >
                确认关联
              </button>
              <button
                onClick={() => setShowExhibitionForm(false)}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {linkedExhibition ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <p className="font-medium text-gray-900">{linkedExhibition.exhibitionName}</p>
              {isDuplicateArtifact && (
                <StatusBadge status="duplicate" type="evidence" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">开始日期:</span>
                <p className="text-gray-900">{format(new Date(linkedExhibition.startDate), 'yyyy-MM-dd')}</p>
              </div>
              <div>
                <span className="text-gray-500">结束日期:</span>
                <p className="text-gray-900">{format(new Date(linkedExhibition.endDate), 'yyyy-MM-dd')}</p>
              </div>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">展品数量:</span>
              <p className="text-gray-900">{linkedExhibition.items.length} 件</p>
            </div>
            {isDuplicateArtifact && (
              <div className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200">
                该藏品在多个展览中重复出现，请确认布展安排
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <GalleryVerticalEnd className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">暂无关联展览</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-gray-900">关联灯光记录</h3>
          </div>
          {!linkedLighting && (
            <button
              onClick={() => setShowLightingForm(!showLightingForm)}
              className="flex items-center gap-1 text-sm text-yellow-600 hover:text-yellow-700"
            >
              <Plus className="w-4 h-4" />
              关联
            </button>
          )}
        </div>

        {showLightingForm && !linkedLighting && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <select
              value={selectedLightingId}
              onChange={(e) => setSelectedLightingId(e.target.value)}
              className={cn(
                'w-full px-3 py-2 border border-gray-300 rounded-lg mb-2',
                'focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none text-sm'
              )}
            >
              <option value="">选择灯光记录</option>
              {availableLighting.map((lighting) => (
                <option key={lighting.id} value={lighting.id}>
                  {lighting.lightType} - {lighting.intensity} lux
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleLinkLighting}
                disabled={!selectedLightingId}
                className={cn(
                  'flex-1 px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm',
                  'hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
                )}
              >
                确认关联
              </button>
              <button
                onClick={() => setShowLightingForm(false)}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {linkedLighting ? (
          <div className="space-y-3">
            <div>
              <p className="font-medium text-gray-900">{linkedLighting.lightType}</p>
              <p className="text-sm text-gray-500">{linkedLighting.notes}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">强度:</span>
                <p className="text-gray-900">{linkedLighting.intensity} lux</p>
              </div>
              <div>
                <span className="text-gray-500">角度:</span>
                <p className="text-gray-900">{linkedLighting.angle}°</p>
              </div>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">创建时间:</span>
              <p className="text-gray-900">{format(new Date(linkedLighting.createdAt), 'yyyy-MM-dd HH:mm')}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">暂无关联灯光记录</p>
          </div>
        )}
      </div>
    </div>
  )
}

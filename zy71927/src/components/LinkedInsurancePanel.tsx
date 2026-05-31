import { useState } from 'react'
import { format } from 'date-fns'
import { Shield, Link2, Unlink, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import StatusBadge from './StatusBadge'
import type { InsurancePolicy, RestorationRecord } from '@/types'

interface LinkedInsurancePanelProps {
  record: RestorationRecord
  className?: string
}

export default function LinkedInsurancePanel({ record, className }: LinkedInsurancePanelProps) {
  const { getInsurancePolicyById, insurancePolicies, linkInsurancePolicy, unlinkInsurancePolicy } = useStore()
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = useState('')

  const linkedPolicy = record.insurancePolicyId
    ? getInsurancePolicyById(record.insurancePolicyId)
    : undefined

  const availablePolicies = insurancePolicies.filter(
    (p) => p.artifactId === record.artifactId && !p.linkedRecordIds.includes(record.id)
  )

  const handleLink = () => {
    if (selectedPolicyId) {
      linkInsurancePolicy(record.id, selectedPolicyId, '当前用户')
      setSelectedPolicyId('')
      setShowLinkForm(false)
    }
  }

  const handleUnlink = () => {
    unlinkInsurancePolicy(record.id, '当前用户')
  }

  return (
    <div id="insurance-panel" className={cn('bg-white rounded-lg shadow-sm border border-gray-200 p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">关联保险单</h3>
        </div>
        {!linkedPolicy && (
          <button
            onClick={() => setShowLinkForm(!showLinkForm)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" />
            关联
          </button>
        )}
      </div>

      {showLinkForm && !linkedPolicy && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <select
            value={selectedPolicyId}
            onChange={(e) => setSelectedPolicyId(e.target.value)}
            className={cn(
              'w-full px-3 py-2 border border-gray-300 rounded-lg mb-2',
              'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm'
            )}
          >
            <option value="">选择保险单</option>
            {availablePolicies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.policyNumber} - {policy.coverage}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleLink}
              disabled={!selectedPolicyId}
              className={cn(
                'flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm',
                'hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
              )}
            >
              确认关联
            </button>
            <button
              onClick={() => setShowLinkForm(false)}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {linkedPolicy ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-gray-900">{linkedPolicy.policyNumber}</p>
              <p className="text-sm text-gray-500">{linkedPolicy.coverage}</p>
            </div>
            <StatusBadge status={linkedPolicy.status} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">有效期从:</span>
              <p className="text-gray-900">{format(new Date(linkedPolicy.validFrom), 'yyyy-MM-dd')}</p>
            </div>
            <div>
              <span className="text-gray-500">有效期至:</span>
              <p className="text-gray-900">{format(new Date(linkedPolicy.validTo), 'yyyy-MM-dd')}</p>
            </div>
          </div>
          {linkedPolicy.changeHistory.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">变更记录: {linkedPolicy.changeHistory.length} 条</p>
            </div>
          )}
          <button
            onClick={handleUnlink}
            className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
          >
            <Unlink className="w-4 h-4" />
            取消关联
          </button>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500">
          <Link2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">暂无关联保险单</p>
        </div>
      )}
    </div>
  )
}

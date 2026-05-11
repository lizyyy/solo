import { useState, useMemo } from 'react'
import { Plus, Search, Edit, Trash2, Download, Eye } from 'lucide-react'
import type { Campus } from '../../types'
import { StatusBadge } from '../common/StatusBadge'
import { Modal } from '../common/Modal'
import { CampusForm } from './CampusForm'
import { exportCampusesToCSV, downloadCSV } from '../../utils/export'
import { getCourses } from '../../services/dataService'

interface CampusListProps {
  campuses: Campus[]
  onRefresh: () => void
}

export function CampusList({ campuses, onRefresh }: CampusListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null)
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null)

  const filteredCampuses = useMemo(() => {
    return campuses.filter((c) => {
      if (searchTerm && !c.name.includes(searchTerm) && !c.address.includes(searchTerm)) {
        return false
      }
      if (filterStatus && c.status !== filterStatus) {
        return false
      }
      return true
    })
  }, [campuses, searchTerm, filterStatus])

  const handleEdit = (campus: Campus) => {
    setEditingCampus(campus)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingCampus(null)
  }

  const handleExport = () => {
    const csv = exportCampusesToCSV(filteredCampuses)
    downloadCSV(csv, `校区管理_${new Date().toISOString().split('T')[0]}.csv`)
  }

  const getCampusCourseCount = (campusId: string) => {
    return getCourses().filter((c) => c.campusId === campusId).length
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索校区名称或地址..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'active' | 'inactive' | '')}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="inactive">停用</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建校区
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCampuses.map((campus) => (
          <div key={campus.id} className="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{campus.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{campus.address}</p>
              </div>
              <StatusBadge status={campus.status} />
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>容量：</span>
                <span className="font-medium">{campus.capacity} 人</span>
              </div>
              <div className="flex justify-between">
                <span>每班最大志愿者：</span>
                <span className="font-medium">{campus.maxVolunteersPerClass} 人</span>
              </div>
              <div className="flex justify-between">
                <span>开设课程数：</span>
                <span className="font-medium">{getCampusCourseCount(campus.id)} 门</span>
              </div>
              <div>
                <span>运营日：</span>
                <span className="font-medium">{campus.operatingDays.join('、')}</span>
              </div>
              <div>
                <span>联系人：</span>
                <span className="font-medium">{campus.contactPerson} - {campus.contactPhone}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t">
              <button
                onClick={() => setSelectedCampus(campus)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Eye className="w-4 h-4" />
                查看
              </button>
              <button
                onClick={() => handleEdit(campus)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              >
                <Edit className="w-4 h-4" />
                编辑
              </button>
              <button
                onClick={() => {
                  const courseCount = getCampusCourseCount(campus.id)
                  if (courseCount > 0) {
                    alert(`该校区还有 ${courseCount} 门课程，请先删除或转移课程`)
                    return
                  }
                  if (confirm(`确定要删除校区「${campus.name}」吗？`)) {
                    import('../../services/dataService').then(({ deleteCampus }) => {
                      deleteCampus(campus.id)
                      onRefresh()
                    })
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                删除
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredCampuses.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg">
          暂无校区数据
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={handleCloseForm}
        title={editingCampus ? '编辑校区' : '新建校区'}
        size="lg"
      >
        <CampusForm
          campus={editingCampus}
          onClose={handleCloseForm}
          onSaved={onRefresh}
        />
      </Modal>

      <Modal
        isOpen={!!selectedCampus}
        onClose={() => setSelectedCampus(null)}
        title="校区详情"
        size="lg"
      >
        {selectedCampus && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">{selectedCampus.name}</h3>
              <p className="text-gray-600">{selectedCampus.address}</p>
              <StatusBadge status={selectedCampus.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">容量</p>
                <p className="text-2xl font-bold text-gray-800">{selectedCampus.capacity}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">每班最大志愿者</p>
                <p className="text-2xl font-bold text-gray-800">{selectedCampus.maxVolunteersPerClass}</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-700 mb-2">运营日</h4>
              <div className="flex flex-wrap gap-2">
                {selectedCampus.operatingDays.map((d) => (
                  <span key={d} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-700 mb-2">联系方式</h4>
              <p className="text-gray-600">
                {selectedCampus.contactPerson} - {selectedCampus.contactPhone}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

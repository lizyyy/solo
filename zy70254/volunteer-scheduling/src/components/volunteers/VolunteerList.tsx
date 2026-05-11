import { useState, useMemo } from 'react'
import { Plus, Search, Edit, Trash2, Eye, Download } from 'lucide-react'
import type { Volunteer, Campus, Subject } from '../../types'
import { StatusBadge } from '../common/StatusBadge'
import { Modal } from '../common/Modal'
import { VolunteerForm } from './VolunteerForm'
import { VolunteerDetail } from './VolunteerDetail'
import { SUBJECTS } from '../../utils/validation'
import { exportVolunteersToCSV, downloadCSV } from '../../utils/export'

interface VolunteerListProps {
  volunteers: Volunteer[]
  campuses: Campus[]
  onRefresh: () => void
}

export function VolunteerList({ volunteers, campuses, onRefresh }: VolunteerListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState<Subject | ''>('')
  const [filterCampus, setFilterCampus] = useState('')
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null)
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null)

  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) => {
      if (searchTerm && !v.name.includes(searchTerm) && !v.phone.includes(searchTerm)) {
        return false
      }
      if (filterSubject && !v.subjects.includes(filterSubject)) {
        return false
      }
      if (filterCampus && !v.availableCampuses.includes(filterCampus)) {
        return false
      }
      if (filterStatus && v.status !== filterStatus) {
        return false
      }
      return true
    })
  }, [volunteers, searchTerm, filterSubject, filterCampus, filterStatus])

  const handleEdit = (volunteer: Volunteer) => {
    setEditingVolunteer(volunteer)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingVolunteer(null)
  }

  const handleExport = () => {
    const csv = exportVolunteersToCSV(filteredVolunteers)
    downloadCSV(csv, `助教档案_${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索姓名或手机号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
          </div>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value as Subject | '')}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部学科</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterCampus}
            onChange={(e) => setFilterCampus(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部校区</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
            新建助教
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">助教信息</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">擅长学科</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">可服务校区</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">志愿时长</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredVolunteers.map((volunteer) => (
              <tr key={volunteer.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{volunteer.name}</div>
                  <div className="text-sm text-gray-500">{volunteer.phone}</div>
                  {volunteer.email && <div className="text-sm text-gray-400">{volunteer.email}</div>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {volunteer.subjects.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {volunteer.availableCampuses
                      .map((id) => campuses.find((c) => c.id === id)?.name || id)
                      .join('、')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    已服务 <span className="font-medium">{volunteer.totalAssignedHours}</span> 小时
                  </div>
                  <div className="text-sm text-gray-500">
                    总时长 {volunteer.volunteerHours} 小时
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={volunteer.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedVolunteer(volunteer)}
                      className="text-blue-600 hover:text-blue-900 p-1"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(volunteer)}
                      className="text-green-600 hover:text-green-900 p-1"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`确定要删除助教「${volunteer.name}」吗？`)) {
                          import('../../services/dataService').then(({ deleteVolunteer }) => {
                            deleteVolunteer(volunteer.id)
                            onRefresh()
                          })
                        }
                      }}
                      className="text-red-600 hover:text-red-900 p-1"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredVolunteers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无助教数据
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={handleCloseForm}
        title={editingVolunteer ? '编辑助教' : '新建助教'}
        size="lg"
      >
        <VolunteerForm
          volunteer={editingVolunteer}
          campuses={campuses}
          onClose={handleCloseForm}
          onSaved={onRefresh}
        />
      </Modal>

      <Modal
        isOpen={!!selectedVolunteer}
        onClose={() => setSelectedVolunteer(null)}
        title="助教详情"
        size="lg"
      >
        {selectedVolunteer && (
          <VolunteerDetail
            volunteer={selectedVolunteer}
            campuses={campuses}
          />
        )}
      </Modal>
    </div>
  )
}

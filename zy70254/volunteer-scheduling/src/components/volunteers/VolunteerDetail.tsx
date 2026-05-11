
import { Calendar, Clock, MapPin, Phone, Mail, BookOpen } from 'lucide-react'
import type { Volunteer, Campus } from '../../types'
import { getSchedules } from '../../services/dataService'
import { StatusBadge } from '../common/StatusBadge'

interface VolunteerDetailProps {
  volunteer: Volunteer
  campuses: Campus[]
}

export function VolunteerDetail({ volunteer, campuses }: VolunteerDetailProps) {
  const schedules = getSchedules().filter((s) => s.volunteerId === volunteer.id)

  const campusNames = volunteer.availableCampuses
    .map((id) => campuses.find((c) => c.id === id)?.name || id)
    .join('、')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            基本信息
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-700">
              <span className="text-sm text-gray-500 w-20">姓名：</span>
              <span className="font-medium">{volunteer.name}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 w-16">手机：</span>
              <span>{volunteer.phone}</span>
            </div>
            {volunteer.email && (
              <div className="flex items-center gap-2 text-gray-700">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 w-16">邮箱：</span>
                <span>{volunteer.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-700">
              <StatusBadge status={volunteer.status} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-600" />
            时长统计
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600">总志愿时长</p>
              <p className="text-2xl font-bold text-blue-800">{volunteer.volunteerHours}</p>
              <p className="text-xs text-blue-500">小时</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600">已分配时长</p>
              <p className="text-2xl font-bold text-green-800">{volunteer.totalAssignedHours}</p>
              <p className="text-xs text-green-500">小时</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-600" />
          擅长学科
        </h3>
        <div className="flex flex-wrap gap-2">
          {volunteer.subjects.map((s) => (
            <span key={s} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-orange-600" />
          可服务校区
        </h3>
        <p className="text-gray-700">{campusNames || '暂无配置'}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          排班记录（{schedules.length}条）
        </h3>
        {schedules.length > 0 ? (
          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
            {schedules.map((s) => (
              <div key={s.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{s.date} {s.startTime}-{s.endTime}</div>
                  <div className="text-sm text-gray-500">时长：{s.assignedHours}小时</div>
                  {s.isAbsent && (
                    <div className="text-sm text-red-500">缺席原因：{s.absenceReason}</div>
                  )}
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 py-4">暂无排班记录</p>
        )}
      </div>
    </div>
  )
}

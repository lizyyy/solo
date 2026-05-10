import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Booking, Consultant, Course, BookingStatus, statusLabels } from '../types'
import { bookingsApi, consultantsApi, coursesApi } from '../services/api'
import CreateBookingModal from '../components/CreateBookingModal'

export default function BookingList() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  const [filters, setFilters] = useState({
    consultant_id: '',
    course_id: '',
    status: ''
  })

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const [bookingsData, consultantsData, coursesData] = await Promise.all([
        bookingsApi.getAll({
          consultant_id: filters.consultant_id ? Number(filters.consultant_id) : undefined,
          course_id: filters.course_id ? Number(filters.course_id) : undefined,
          status: filters.status || undefined
        }),
        consultantsApi.getAll(),
        coursesApi.getAll()
      ])
      setBookings(bookingsData)
      setConsultants(consultantsData)
      setCourses(coursesData)
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleBookingCreated = () => {
    setShowCreateModal(false)
    loadData()
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ marginBottom: 0 }}>试听预约列表</h2>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + 新建预约
          </button>
        </div>

        <div className="filters">
          <select 
            value={filters.consultant_id} 
            onChange={(e) => handleFilterChange('consultant_id', e.target.value)}
          >
            <option value="">全部顾问</option>
            {consultants.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.department})</option>
            ))}
          </select>

          <select 
            value={filters.course_id} 
            onChange={(e) => handleFilterChange('course_id', e.target.value)}
          >
            <option value="">全部课程</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select 
            value={filters.status} 
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">全部状态</option>
            {(['booked', 'following', 'enrolled', 'no_show', 'lost'] as BookingStatus[]).map(s => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">加载中...</div>
        ) : bookings.length === 0 ? (
          <div className="empty-state">暂无预约记录</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>孩子</th>
                  <th>年龄</th>
                  <th>课程</th>
                  <th>顾问</th>
                  <th>预约时间</th>
                  <th>签到时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(booking => (
                  <tr key={booking.id}>
                    <td><strong>{booking.child_name}</strong></td>
                    <td>{booking.child_age}岁</td>
                    <td>{booking.course_name}</td>
                    <td>{booking.consultant_name}</td>
                    <td>{dayjs(booking.booking_date).format('YYYY-MM-DD HH:mm')}</td>
                    <td>
                      {booking.check_in_time 
                        ? dayjs(booking.check_in_time).format('MM-DD HH:mm')
                        : '-'
                      }
                    </td>
                    <td>
                      <span className={`status-badge ${booking.status}`}>
                        {statusLabels[booking.status]}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/bookings/${booking.id}`)}
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateBookingModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleBookingCreated}
          consultants={consultants}
          courses={courses}
        />
      )}
    </div>
  )
}

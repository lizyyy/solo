import { useState, useEffect, useCallback } from 'react'
import type { Appointment, AppointmentStatus, Counselor, Schedule, HistoryRecord, ViewType } from './types'
import { storage } from './utils'
import Sidebar from './components/Sidebar'
import AppointmentList from './components/AppointmentList'
import AppointmentDetail from './components/AppointmentDetail'
import CreateAppointment from './components/CreateAppointment'
import CounselorList from './components/CounselorList'
import ScheduleManager from './components/ScheduleManager'
import HistoryView from './components/HistoryView'
import StatsPanel from './components/StatsPanel'

type SubView = 
  | { type: 'list' }
  | { type: 'detail'; appointmentId: string }
  | { type: 'create' }

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('appointments')
  const [subView, setSubView] = useState<SubView>({ type: 'list' })
  
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [history, setHistory] = useState<HistoryRecord[]>([])

  useEffect(() => {
    setAppointments(storage.loadAppointments())
    setCounselors(storage.loadCounselors())
    setSchedules(storage.loadSchedules())
    setHistory(storage.loadHistory())
  }, [])

  const addHistoryRecord = useCallback((appointmentId: string, action: string, before: any, after: any) => {
    storage.addHistoryRecord({ appointmentId, action, before, after })
    setHistory(storage.loadHistory())
  }, [])

  const handleCreateAppointment = (appointment: Appointment, scheduleId: string) => {
    const newAppointments = [appointment, ...appointments]
    setAppointments(newAppointments)
    storage.saveAppointments(newAppointments)

    const newSchedules = schedules.map(s => 
      s.id === scheduleId ? { ...s, isBooked: true } : s
    )
    setSchedules(newSchedules)
    storage.saveSchedules(newSchedules)

    addHistoryRecord(appointment.id, '创建预约', null, { status: appointment.status })
    setSubView({ type: 'detail', appointmentId: appointment.id })
  }

  const handleStatusChange = (id: string, newStatus: AppointmentStatus) => {
    const appointment = appointments.find(a => a.id === id)
    if (!appointment) return

    const before = { status: appointment.status }
    const after = { status: newStatus }

    const newAppointments = appointments.map(a =>
      a.id === id
        ? { ...a, status: newStatus, updatedAt: new Date().toISOString() }
        : a
    )
    setAppointments(newAppointments)
    storage.saveAppointments(newAppointments)

    const actionMap: Partial<Record<AppointmentStatus, string>> = {
      confirmed: '确认预约',
      completed: '确认完成',
      no_show: '标记爽约'
    }
    addHistoryRecord(id, actionMap[newStatus] || '状态变更', before, after)
  }

  const handleReschedule = (id: string, newScheduleId: string) => {
    const appointment = appointments.find(a => a.id === id)
    if (!appointment) return

    const oldSchedule = schedules.find(s => s.id === appointment.scheduleId)
    const newSchedule = schedules.find(s => s.id === newScheduleId)

    const before = { 
      scheduleId: appointment.scheduleId,
      status: appointment.status,
      ...(oldSchedule && { date: oldSchedule.date, time: `${oldSchedule.startTime}-${oldSchedule.endTime}` })
    }
    const after = { 
      scheduleId: newScheduleId,
      status: 'rescheduled' as AppointmentStatus,
      ...(newSchedule && { date: newSchedule.date, time: `${newSchedule.startTime}-${newSchedule.endTime}` })
    }

    const newAppointments = appointments.map(a =>
      a.id === id
        ? { ...a, scheduleId: newScheduleId, status: 'rescheduled' as AppointmentStatus, updatedAt: new Date().toISOString() }
        : a
    )
    setAppointments(newAppointments)
    storage.saveAppointments(newAppointments)

    const newSchedules = schedules.map(s => {
      if (s.id === appointment.scheduleId) return { ...s, isBooked: false }
      if (s.id === newScheduleId) return { ...s, isBooked: true }
      return s
    })
    setSchedules(newSchedules)
    storage.saveSchedules(newSchedules)

    addHistoryRecord(id, '改约', before, after)
  }

  const handleCancel = (id: string) => {
    const appointment = appointments.find(a => a.id === id)
    if (!appointment) return

    const before = { status: appointment.status }
    const after = { status: 'cancelled' as AppointmentStatus }

    const newAppointments = appointments.map(a =>
      a.id === id
        ? { ...a, status: 'cancelled' as AppointmentStatus, updatedAt: new Date().toISOString() }
        : a
    )
    setAppointments(newAppointments)
    storage.saveAppointments(newAppointments)

    const newSchedules = schedules.map(s =>
      s.id === appointment.scheduleId ? { ...s, isBooked: false } : s
    )
    setSchedules(newSchedules)
    storage.saveSchedules(newSchedules)

    addHistoryRecord(id, '取消预约', before, after)
  }

  const handleEdit = (id: string, updates: Partial<Appointment>) => {
    const appointment = appointments.find(a => a.id === id)
    if (!appointment) return

    const before: any = {}
    const after: any = {}
    Object.keys(updates).forEach(key => {
      before[key] = (appointment as any)[key]
      after[key] = (updates as any)[key]
    })

    const newAppointments = appointments.map(a =>
      a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
    )
    setAppointments(newAppointments)
    storage.saveAppointments(newAppointments)

    addHistoryRecord(id, '编辑记录', before, after)
  }

  const handleAddCounselor = (counselor: Counselor) => {
    const newCounselors = [counselor, ...counselors]
    setCounselors(newCounselors)
    storage.saveCounselors(newCounselors)
  }

  const handleToggleCounselorActive = (id: string) => {
    const newCounselors = counselors.map(c =>
      c.id === id ? { ...c, isActive: !c.isActive } : c
    )
    setCounselors(newCounselors)
    storage.saveCounselors(newCounselors)
  }

  const handleAddSchedule = (schedule: Schedule) => {
    const newSchedules = [...schedules, schedule]
    setSchedules(newSchedules)
    storage.saveSchedules(newSchedules)
  }

  const handleDeleteSchedule = (id: string) => {
    const newSchedules = schedules.filter(s => s.id !== id)
    setSchedules(newSchedules)
    storage.saveSchedules(newSchedules)
  }

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view)
    if (view === 'appointments') {
      setSubView({ type: 'list' })
    }
  }

  const renderAppointmentsView = () => {
    if (subView.type === 'create') {
      return (
        <CreateAppointment
          counselors={counselors}
          schedules={schedules}
          onBack={() => setSubView({ type: 'list' })}
          onCreate={handleCreateAppointment}
        />
      )
    }

    if (subView.type === 'detail') {
      const appointment = appointments.find(a => a.id === subView.appointmentId)
      if (!appointment) {
        setSubView({ type: 'list' })
        return null
      }
      return (
        <AppointmentDetail
          appointment={appointment}
          counselors={counselors}
          schedules={schedules}
          history={history}
          onBack={() => setSubView({ type: 'list' })}
          onStatusChange={handleStatusChange}
          onReschedule={handleReschedule}
          onCancel={handleCancel}
          onEdit={handleEdit}
        />
      )
    }

    return (
      <AppointmentList
        appointments={appointments}
        counselors={counselors}
        schedules={schedules}
        onSelect={id => setSubView({ type: 'detail', appointmentId: id })}
        onCreate={() => setSubView({ type: 'create' })}
      />
    )
  }

  const renderView = () => {
    switch (currentView) {
      case 'appointments':
        return renderAppointmentsView()
      case 'counselors':
        return (
          <CounselorList
            counselors={counselors}
            schedules={schedules}
            appointments={appointments}
            onAdd={handleAddCounselor}
            onToggleActive={handleToggleCounselorActive}
          />
        )
      case 'schedule':
        return (
          <ScheduleManager
            counselors={counselors}
            schedules={schedules}
            onAdd={handleAddSchedule}
            onDelete={handleDeleteSchedule}
          />
        )
      case 'history':
        return (
          <HistoryView
            history={history}
            appointments={appointments}
            counselors={counselors}
            schedules={schedules}
          />
        )
      case 'stats':
        return (
          <StatsPanel
            appointments={appointments}
            counselors={counselors}
            schedules={schedules}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar currentView={currentView} onViewChange={handleViewChange} />
      <main className="flex-1 p-8 overflow-auto">
        {renderView()}
      </main>
    </div>
  )
}

export default App

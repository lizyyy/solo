import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import type { Vehicle, Consultant, Reservation, ChargeRecord } from '@/types'

type ExportFormat = 'xlsx' | 'csv'

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatDate(isoString: string | undefined): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function exportVehicles(vehicles: Vehicle[], format: ExportFormat): void {
  const data = vehicles.map(v => ({
    车牌号: v.licensePlate,
    品牌: v.brand,
    车型: v.model,
    电池容量: `${v.batteryCapacity}kWh`,
    当前电量: `${v.currentBattery}%`,
    充电状态: {
      charging: '充电中',
      fully_charged: '已充满',
      low_battery: '低电量',
      out_of_service: '停用',
    }[v.chargeStatus],
    里程: `${v.mileage}km`,
    是否可用: v.isAvailable ? '是' : '否',
    创建时间: formatDate(v.createdAt),
    更新时间: formatDate(v.updatedAt),
  }))

  const filename = `试驾车档案_${new Date().toISOString().slice(0, 10)}`

  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '试驾车档案')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  } else {
    const csv = Papa.unparse(data)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `${filename}.csv`)
  }
}

export function exportConsultants(consultants: Consultant[], format: ExportFormat): void {
  const data = consultants.map(c => ({
    姓名: c.name,
    电话: c.phone,
    专长: c.specialty,
    是否在职: c.isActive ? '是' : '否',
    创建时间: formatDate(c.createdAt),
    更新时间: formatDate(c.updatedAt),
  }))

  const filename = `销售顾问_${new Date().toISOString().slice(0, 10)}`

  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '销售顾问')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  } else {
    const csv = Papa.unparse(data)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `${filename}.csv`)
  }
}

export function exportReservations(
  reservations: Reservation[],
  vehicles: Vehicle[],
  consultants: Consultant[],
  format: ExportFormat
): void {
  const data = reservations.map(r => {
    const vehicle = vehicles.find(v => v.id === r.vehicleId)
    const consultant = consultants.find(c => c.id === r.consultantId)
    return {
      客户姓名: r.customerName,
      客户电话: r.customerPhone,
      试驾车: vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.licensePlate})` : '未知',
      销售顾问: consultant?.name ?? '未知',
      日期: r.date,
      开始时间: r.startTime,
      结束时间: r.endTime,
      试驾路线: r.testDriveRoute,
      状态: {
        pending: '待确认',
        confirmed: '已确认',
        in_progress: '进行中',
        completed: '已完成',
        cancelled: '已取消',
        rescheduled: '已改约',
      }[r.status],
      来源: r.source,
      有冲突: r.conflictInfo ? '是' : '否',
      备注: r.notes ?? '',
      创建时间: formatDate(r.createdAt),
      更新时间: formatDate(r.updatedAt),
    }
  })

  const filename = `预约记录_${new Date().toISOString().slice(0, 10)}`

  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '预约记录')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  } else {
    const csv = Papa.unparse(data)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `${filename}.csv`)
  }
}

export function exportChargeRecords(
  records: ChargeRecord[],
  vehicles: Vehicle[],
  format: ExportFormat
): void {
  const data = records.map(r => {
    const vehicle = vehicles.find(v => v.id === r.vehicleId)
    return {
      车辆: vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.licensePlate})` : '未知',
      开始电量: `${r.startBattery}%`,
      结束电量: r.endBattery ? `${r.endBattery}%` : '-',
      状态: {
        in_progress: '进行中',
        completed: '已完成',
        interrupted: '已中断',
      }[r.status],
      开始时间: formatDate(r.startTime),
      结束时间: formatDate(r.endTime),
    }
  })

  const filename = `充电记录_${new Date().toISOString().slice(0, 10)}`

  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '充电记录')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  } else {
    const csv = Papa.unparse(data)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `${filename}.csv`)
  }
}

export function exportDashboard(
  vehicles: Vehicle[],
  consultants: Consultant[],
  reservations: Reservation[],
  records: ChargeRecord[],
  format: ExportFormat
): void {
  const stats = {
    车辆总数: vehicles.length,
    充电中: vehicles.filter(v => v.chargeStatus === 'charging').length,
    低电量: vehicles.filter(v => v.chargeStatus === 'low_battery').length,
    已充满: vehicles.filter(v => v.chargeStatus === 'fully_charged').length,
    顾问总数: consultants.length,
    在职顾问: consultants.filter(c => c.isActive).length,
    预约总数: reservations.length,
    待确认: reservations.filter(r => r.status === 'pending').length,
    已确认: reservations.filter(r => r.status === 'confirmed').length,
    进行中: reservations.filter(r => r.status === 'in_progress').length,
    已完成: reservations.filter(r => r.status === 'completed').length,
    已取消: reservations.filter(r => r.status === 'cancelled').length,
    有冲突: reservations.filter(r => r.conflictInfo).length,
    充电记录数: records.length,
    导出时间: formatDate(new Date().toISOString()),
  }

  const filename = `调度台报表_${new Date().toISOString().slice(0, 10)}`

  if (format === 'xlsx') {
    const ws1 = XLSX.utils.json_to_sheet([stats])
    const ws2 = XLSX.utils.json_to_sheet(
      reservations.map(r => ({
        客户: r.customerName,
        电话: r.customerPhone,
        日期: r.date,
        时间: `${r.startTime}-${r.endTime}`,
        状态: {
          pending: '待确认',
          confirmed: '已确认',
          in_progress: '进行中',
          completed: '已完成',
          cancelled: '已取消',
          rescheduled: '已改约',
        }[r.status],
        有冲突: r.conflictInfo ? '是' : '否',
        来源: r.source,
      }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, '统计概览')
    XLSX.utils.book_append_sheet(wb, ws2, '预约明细')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  } else {
    const csv = Papa.unparse([stats])
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, `${filename}.csv`)
  }
}

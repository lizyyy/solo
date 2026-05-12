import { useState } from 'react'
import { Download, FileText, DollarSign, CheckCircle } from 'lucide-react'
import { useAppStore } from '../store'
import { formatDate } from '../utils'

export default function Settlement() {
  const { appointments, exportSettlementReport } = useAppStore()
  const [filter, setFilter] = useState<'all' | 'settled' | 'unsettled'>('all')

  const settledAppointments = appointments.filter(a => a.status === 'settled')
  const unsettledAppointments = appointments.filter(
    a => a.status === 'inspected' || a.status === 'in_progress'
  )

  const filteredAppointments = filter === 'settled' 
    ? settledAppointments 
    : filter === 'unsettled' 
      ? unsettledAppointments 
      : appointments.filter(a => a.status === 'settled' || a.status === 'inspected' || a.status === 'in_progress')

  const totalSettledAmount = settledAppointments.reduce(
    (sum, a) => sum + (a.settlement?.finalPrice || 0),
    0
  )

  const handleExport = () => {
    const report = exportSettlementReport()
    const csv = [
      Object.keys(report[0] || {}).join(','),
      ...report.map(row => Object.values(row).join(','))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `结算报表_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">结算管理</h1>
        <button onClick={handleExport} className="btn btn-primary flex items-center gap-2">
          <Download size={18} />
          导出结算报表
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">已结算笔数</p>
              <p className="text-2xl font-bold text-blue-600">{settledAppointments.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">待结算笔数</p>
              <p className="text-2xl font-bold text-yellow-600">{unsettledAppointments.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">已结算金额</p>
              <p className="text-2xl font-bold text-green-600">¥{totalSettledAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">平均结算价</p>
              <p className="text-2xl font-bold text-purple-600">
                ¥{settledAppointments.length > 0 
                  ? Math.round(totalSettledAmount / settledAppointments.length).toLocaleString()
                  : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-900">结算列表</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-sm ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('settled')}
              className={`px-3 py-1 rounded-lg text-sm ${
                filter === 'settled' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              已结算
            </button>
            <button
              onClick={() => setFilter('unsettled')}
              className={`px-3 py-1 rounded-lg text-sm ${
                filter === 'unsettled' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              待结算
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">预约单号</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">客户信息</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">家电信息</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">预估价格</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">实际价格</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">结算价格</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">支付方式</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">状态</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">结算时间</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                filteredAppointments.map(appointment => (
                  <tr key={appointment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-blue-600">
                      {appointment.appointmentNo}
                    </td>
                    <td className="py-3 px-4">
                      <div>{appointment.customerName}</div>
                      <div className="text-sm text-gray-500">{appointment.customerPhone}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{appointment.applianceBrand}</div>
                      <div className="text-sm text-gray-500">{appointment.applianceModel}</div>
                    </td>
                    <td className="py-3 px-4">¥{appointment.estimatedPrice}</td>
                    <td className="py-3 px-4">
                      {appointment.actualPrice ? `¥${appointment.actualPrice}` : '-'}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {appointment.settlement 
                        ? `¥${appointment.settlement.finalPrice}`
                        : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {appointment.settlement?.paymentMethod === 'cash' && '现金'}
                      {appointment.settlement?.paymentMethod === 'wechat' && '微信'}
                      {appointment.settlement?.paymentMethod === 'alipay' && '支付宝'}
                      {appointment.settlement?.paymentMethod === 'bank' && '银行卡'}
                      {!appointment.settlement?.paymentMethod && '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${
                        appointment.status === 'settled' 
                          ? 'bg-green-100 text-green-800' 
                          : appointment.status === 'inspected'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}>
                        {appointment.status === 'settled' ? '已结算' 
                          : appointment.status === 'inspected' ? '待结算'
                            : '检测中'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {appointment.settlement 
                        ? formatDate(appointment.settlement.settledAt)
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {settledAppointments.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">结算明细示例</h2>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
            <pre className="whitespace-pre-wrap text-gray-700">
{JSON.stringify(exportSettlementReport().slice(0, 2), null, 2)}
            </pre>
            <p className="text-gray-500 mt-2">
              共 {exportSettlementReport().length} 条记录，点击"导出结算报表"下载完整 CSV 文件
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { LearningReport } from '../types'
import { exportToCSV, exportToJSON, formatDate } from '../utils/helpers'

export const ReportGenerator: React.FC = () => {
  const { state, generateReport } = useApp()
  const [selectedStudentId, setSelectedStudentId] = useState(state.currentStudent)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return formatDate(d)
  })
  const [endDate, setEndDate] = useState(formatDate(new Date()))
  const [report, setReport] = useState<LearningReport | null>(null)

  const students = useMemo(() => {
    const map = new Map<string, string>()
    state.practiceRecords.forEach(p => {
      map.set(p.studentId, p.studentName)
    })
    return Array.from(map.entries())
  }, [state.practiceRecords])

  const handleGenerate = () => {
    if (!selectedStudentId) {
      alert('请选择学生')
      return
    }
    const newReport = generateReport(selectedStudentId, startDate, endDate)
    setReport(newReport)
  }

  const handleExportCSV = () => {
    if (!report) return
    
    const mistakeData = report.topMistakes.map(m => ({
      '错误原因': m.cause,
      '出现次数': m.count
    }))

    const progressData = report.progressBySection.map(p => ({
      '段落': p.section,
      '正确率(%)': p.accuracy,
      '练习次数': p.practices
    }))

    const summaryData = [{
      '学生姓名': report.studentName,
      '报告开始日期': report.startDate,
      '报告结束日期': report.endDate,
      '总练习次数': report.totalPracticeCount,
      '总练习时长(分钟)': report.totalDurationMinutes,
      '涉及段落数': report.sectionsCovered.length,
      '检测到异常数': report.anomaliesFound,
      '生成时间': report.generatedAt
    }]

    exportToCSV(summaryData, `学习报告-${report.studentName}-汇总`)
    if (mistakeData.length > 0) {
      exportToCSV(mistakeData, `学习报告-${report.studentName}-错误分布`)
    }
    if (progressData.length > 0) {
      exportToCSV(progressData, `学习报告-${report.studentName}-段落进度`)
    }
  }

  const handleExportJSON = () => {
    if (!report) return
    exportToJSON(report, `学习报告-${report.studentName}`)
  }

  const handleExportFull = () => {
    if (!report) return

    const fullData = {
      report,
      practiceRecords: state.practiceRecords.filter(p =>
        p.studentId === selectedStudentId &&
        p.practiceDate >= startDate &&
        p.practiceDate <= endDate
      ),
      comments: state.comments.filter(c =>
        c.studentId === selectedStudentId
      )
    }
    exportToJSON(fullData, `学习报告-${report.studentName}-完整数据`)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">学习报告生成</h2>

      <div className="card">
        <h3 className="font-semibold mb-4">报告参数</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label">选择学生 *</label>
            <select
              className="input"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">请选择学生</option>
              {students.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">开始日期 *</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">结束日期 *</label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-primary" onClick={handleGenerate}>
          生成学习报告
        </button>
      </div>

      {report && (
        <>
          <div className="card bg-gradient-to-br from-guqin-50 to-white">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-guqin-800">
                  {report.studentName} 的学习报告
                </h3>
                <p className="text-gray-500 mt-1">
                  报告周期: {report.startDate} 至 {report.endDate}
                </p>
                <p className="text-xs text-gray-400">
                  生成时间: {report.generatedAt}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary text-sm" onClick={handleExportCSV}>
                  📊 导出CSV
                </button>
                <button className="btn-secondary text-sm" onClick={handleExportJSON}>
                  📄 导出JSON
                </button>
                <button className="btn-primary text-sm" onClick={handleExportFull}>
                  📦 导出完整数据包
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg text-center border border-guqin-100">
                <div className="text-3xl font-bold text-guqin-600">{report.totalPracticeCount}</div>
                <div className="text-sm text-gray-500">总练习次数</div>
              </div>
              <div className="bg-white p-4 rounded-lg text-center border border-guqin-100">
                <div className="text-3xl font-bold text-guqin-600">{report.totalDurationMinutes}</div>
                <div className="text-sm text-gray-500">总练习时长(分钟)</div>
              </div>
              <div className="bg-white p-4 rounded-lg text-center border border-guqin-100">
                <div className="text-3xl font-bold text-guqin-600">{report.sectionsCovered.length}</div>
                <div className="text-sm text-gray-500">涉及段落</div>
              </div>
              <div className={`p-4 rounded-lg text-center border ${report.anomaliesFound > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className={`text-3xl font-bold ${report.anomaliesFound > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {report.anomaliesFound}
                </div>
                <div className={`text-sm ${report.anomaliesFound > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  检测到异常
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg border border-guqin-100">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <span>🏆</span> 高频错误排行
                </h4>
                {report.topMistakes.length > 0 ? (
                  <div className="space-y-3">
                    {report.topMistakes.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                            idx === 1 ? 'bg-gray-300 text-gray-700' :
                            idx === 2 ? 'bg-amber-600 text-amber-100' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {idx + 1}
                          </span>
                          <span>{m.cause}</span>
                        </div>
                        <span className="font-bold text-guqin-600">{m.count}次</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">本周期内无错误记录，非常棒！</p>
                )}
              </div>

              <div className="bg-white p-4 rounded-lg border border-guqin-100">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <span>📈</span> 各段落掌握情况
                </h4>
                {report.progressBySection.length > 0 ? (
                  <div className="space-y-3">
                    {report.progressBySection.map((p, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">
                            {p.section}
                            <span className="text-xs text-gray-400 ml-2">({p.practices}次练习)</span>
                          </span>
                          <span className={`text-sm font-bold ${
                            p.accuracy >= 90 ? 'text-green-600' :
                            p.accuracy >= 70 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {p.accuracy}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              p.accuracy >= 90 ? 'bg-green-500' :
                              p.accuracy >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${p.accuracy}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">本周期内无练习数据</p>
                )}
              </div>
            </div>

            <div className="mt-6 bg-white p-4 rounded-lg border border-guqin-100">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <span>💡</span> 学习建议
              </h4>
              <ul className="space-y-2">
                {report.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-guqin-500 mt-1">•</span>
                    <span className="text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {report.anomaliesFound > 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <span>⚠️</span> 数据异常提醒
                </h4>
                <p className="text-red-700 text-sm">
                  检测到 {report.anomaliesFound} 个数据异常，请前往"异常检测中心"查看并处理。
                  异常可能包括：指法名称冲突、段落序号错位、重复点评、引用无效指法等问题。
                </p>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">边界案例说明</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h5 className="font-medium text-yellow-800 mb-1">🔍 指法同名检测</h5>
                <p className="text-sm text-yellow-700">
                  系统检测到有两个"勾"指法（ID: f-gou-001 和 f-gou-duplicate）。
                  这种情况在表格中容易被忽略，工具会自动标记并提示合并。
                </p>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h5 className="font-medium text-yellow-800 mb-1">🔍 段落序号错位</h5>
                <p className="text-sm text-yellow-700">
                  《流水》段落序号为1、2、4、5，缺少第3段。
                  表格中如果段落多了很容易漏看，系统会自动检测序号不连续问题。
                </p>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h5 className="font-medium text-yellow-800 mb-1">🔍 重复点评检测</h5>
                <p className="text-sm text-yellow-700">
                  张三的"溪水潺潺"练习记录(p-student1-002)有两条点评，间隔仅1小时。
                  表格中容易出现重复录入，系统会自动提醒。
                </p>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h5 className="font-medium text-yellow-800 mb-1">🔍 引用无效指法</h5>
                <p className="text-sm text-yellow-700">
                  《流水》尾声段落引用了不存在的指法ID: f-INVALID-ID。
                  这种错误在纯表格中很难发现，系统会自动检测并提示。
                </p>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h5 className="font-medium text-yellow-800 mb-1">🔍 版本链断裂</h5>
                <p className="text-sm text-yellow-700">
                  《流水》段落之间的版本哈希不匹配，说明段落被修改后后续段落未同步更新。
                  这是表格完全无法追踪的功能。
                </p>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <h5 className="font-medium text-yellow-800 mb-1">🔍 来源材料追踪</h5>
                <p className="text-sm text-yellow-700">
                  每条点评都标注了来源材料位置（如"流水-引子-第3小节"），
                  点击异常可以直接追溯到具体的练习记录和点评内容。
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

const COLORS = ['#8b6548', '#a67d5a', '#b79878', '#ccb8a0', '#e0d5c5', '#70503a', '#5c4233', '#4c372c']

export const Dashboard: React.FC = () => {
  const { state } = useApp()
  const [selectedStudentId, setSelectedStudentId] = useState<string | 'all'>('all')
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d')

  const students = useMemo(() => {
    const map = new Map<string, string>()
    state.practiceRecords.forEach(p => {
      map.set(p.studentId, p.studentName)
    })
    return Array.from(map.entries())
  }, [state.practiceRecords])

  const filteredRecords = useMemo(() => {
    const now = new Date()
    let startDate: Date
    
    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0)
    }

    return state.practiceRecords.filter(p => {
      const matchesStudent = selectedStudentId === 'all' || p.studentId === selectedStudentId
      const matchesDate = new Date(p.practiceDate) >= startDate
      return matchesStudent && matchesDate
    })
  }, [state.practiceRecords, selectedStudentId, dateRange])

  const mistakeByCause = useMemo(() => {
    const countMap = new Map<string, number>()
    filteredRecords.forEach(p => {
      p.mistakes.forEach(m => {
        const count = countMap.get(m.errorCauseName) || 0
        countMap.set(m.errorCauseName, count + 1)
      })
    })
    return Array.from(countMap.entries())
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredRecords])

  const mistakeByFingering = useMemo(() => {
    const countMap = new Map<string, number>()
    filteredRecords.forEach(p => {
      p.mistakes.forEach(m => {
        const count = countMap.get(m.fingeringName) || 0
        countMap.set(m.fingeringName, count + 1)
      })
    })
    return Array.from(countMap.entries())
      .map(([fingering, count]) => ({ fingering, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [filteredRecords])

  const mistakeByCategory = useMemo(() => {
    const countMap = new Map<string, number>()
    const categoryMap = new Map(
      state.errorCauses.map(ec => [ec.name, ec.category])
    )
    
    filteredRecords.forEach(p => {
      p.mistakes.forEach(m => {
        const category = categoryMap.get(m.errorCauseName) || 'other'
        const count = countMap.get(category) || 0
        countMap.set(category, count + 1)
      })
    })

    const labels: Record<string, string> = {
      technique: '技巧',
      rhythm: '节奏',
      posture: '姿势',
      timbre: '音色',
      other: '其他'
    }

    return Array.from(countMap.entries()).map(([category, count]) => ({
      category: labels[category] || category,
      count
    }))
  }, [filteredRecords, state.errorCauses])

  const practiceTrend = useMemo(() => {
    const dayMap = new Map<string, { date: string; practices: number; duration: number; mistakes: number }>()
    
    filteredRecords.forEach(p => {
      const existing = dayMap.get(p.practiceDate) || {
        date: p.practiceDate,
        practices: 0,
        duration: 0,
        mistakes: 0
      }
      existing.practices += p.practiceCount
      existing.duration += p.durationMinutes
      existing.mistakes += p.mistakes.length
      dayMap.set(p.practiceDate, existing)
    })

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredRecords])

  const sectionProgress = useMemo(() => {
    const sectionMap = new Map<string, {
      section: string
      score: string
      practices: number
      totalMistakes: number
      totalFingerings: number
    }>()

    filteredRecords.forEach(record => {
      const section = state.sections.find(s => s.id === record.sectionId)
      if (!section) return

      const key = record.sectionId
      const existing = sectionMap.get(key) || {
        section: record.sectionName,
        score: record.scoreName,
        practices: 0,
        totalMistakes: 0,
        totalFingerings: 0
      }

      existing.practices += record.practiceCount
      existing.totalMistakes += record.mistakes.length
      existing.totalFingerings += section.fingeringSequence.length * record.practiceCount

      sectionMap.set(key, existing)
    })

    return Array.from(sectionMap.values()).map(s => ({
      ...s,
      accuracy: s.totalFingerings > 0
        ? Math.round((1 - s.totalMistakes / s.totalFingerings) * 100)
        : 100
    })).sort((a, b) => b.practices - a.practices)
  }, [filteredRecords, state.sections])

  const stats = useMemo(() => {
    const totalPractices = filteredRecords.reduce((sum, r) => sum + r.practiceCount, 0)
    const totalDuration = filteredRecords.reduce((sum, r) => sum + r.durationMinutes, 0)
    const totalMistakes = filteredRecords.reduce((sum, r) => sum + r.mistakes.length, 0)
    const totalRecords = filteredRecords.length
    const avgAccuracy = sectionProgress.length > 0
      ? Math.round(sectionProgress.reduce((sum, s) => sum + s.accuracy, 0) / sectionProgress.length)
      : 100

    return {
      totalPractices,
      totalDuration,
      totalMistakes,
      totalRecords,
      avgAccuracy,
      avgDuration: totalRecords > 0 ? Math.round(totalDuration / totalRecords) : 0
    }
  }, [filteredRecords, sectionProgress])

  const getSeverityCount = (severity: string) => {
    return filteredRecords.reduce((sum, r) => 
      sum + r.mistakes.filter(m => m.severity === severity).length, 0
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">学习分析看板</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">学生：</span>
            <select
              className="input"
              style={{ width: 'auto' }}
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="all">全部学生</option>
              {students.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">时间：</span>
            {(['7d', '30d', 'all'] as const).map(r => (
              <button
                key={r}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  dateRange === r
                    ? 'bg-guqin-600 text-white'
                    : 'bg-guqin-100 text-guqin-700 hover:bg-guqin-200'
                }`}
                onClick={() => setDateRange(r)}
              >
                {r === '7d' ? '7天' : r === '30d' ? '30天' : '全部'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-guqin-600">{stats.totalRecords}</div>
          <div className="text-sm text-gray-500">练习记录</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-guqin-600">{stats.totalPractices}</div>
          <div className="text-sm text-gray-500">总练习次数</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-guqin-600">{stats.totalDuration}</div>
          <div className="text-sm text-gray-500">总时长(分钟)</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-guqin-600">{stats.avgDuration}</div>
          <div className="text-sm text-gray-500">平均时长</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-red-600">{stats.totalMistakes}</div>
          <div className="text-sm text-gray-500">错误总数</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600">{stats.avgAccuracy}%</div>
          <div className="text-sm text-gray-500">平均正确率</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-4">错误原因分布</h3>
          {mistakeByCause.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mistakeByCause} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="cause" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b6548" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">暂无数据</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">错误类型占比</h3>
          {mistakeByCategory.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mistakeByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {mistakeByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">暂无数据</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">指法错误排行</h3>
          {mistakeByFingering.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mistakeByFingering}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fingering" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#a67d5a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">暂无数据</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">练习趋势</h3>
          {practiceTrend.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={practiceTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="practices" stroke="#8b6548" name="练习次数" />
                  <Line yAxisId="left" type="monotone" dataKey="mistakes" stroke="#c0392b" name="错误数" />
                  <Line yAxisId="right" type="monotone" dataKey="duration" stroke="#27ae60" name="时长" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">暂无数据</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-4">错误严重程度</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">严重错误</span>
                <span className="text-sm text-red-600 font-bold">{getSeverityCount('critical')}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-red-500 h-3 rounded-full transition-all"
                  style={{ width: `${stats.totalMistakes > 0 ? (getSeverityCount('critical') / stats.totalMistakes) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">警告错误</span>
                <span className="text-sm text-yellow-600 font-bold">{getSeverityCount('warning')}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-yellow-500 h-3 rounded-full transition-all"
                  style={{ width: `${stats.totalMistakes > 0 ? (getSeverityCount('warning') / stats.totalMistakes) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">提示性问题</span>
                <span className="text-sm text-blue-600 font-bold">{getSeverityCount('info')}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${stats.totalMistakes > 0 ? (getSeverityCount('info') / stats.totalMistakes) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">各段落掌握情况</h3>
          {sectionProgress.length > 0 ? (
            <div className="space-y-3">
              {sectionProgress.map(s => (
                <div key={s.section}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">
                      {s.score} - {s.section}
                      <span className="text-xs text-gray-500 ml-2">({s.practices}次练习)</span>
                    </span>
                    <span className={`text-sm font-bold ${s.accuracy >= 90 ? 'text-green-600' : s.accuracy >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {s.accuracy}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${s.accuracy >= 90 ? 'bg-green-500' : s.accuracy >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${s.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">暂无数据</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">练习历史记录</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-3 px-4">学生</th>
                <th className="text-left py-3 px-4">曲谱</th>
                <th className="text-left py-3 px-4">段落</th>
                <th className="text-left py-3 px-4">日期</th>
                <th className="text-left py-3 px-4">练习次数</th>
                <th className="text-left py-3 px-4">时长</th>
                <th className="text-left py-3 px-4">错误数</th>
                <th className="text-left py-3 px-4">自我评估</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredRecords].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(record => (
                <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{record.studentName}</td>
                  <td className="py-3 px-4">{record.scoreName}</td>
                  <td className="py-3 px-4">{record.sectionName}</td>
                  <td className="py-3 px-4">{record.practiceDate}</td>
                  <td className="py-3 px-4">{record.practiceCount}</td>
                  <td className="py-3 px-4">{record.durationMinutes}分钟</td>
                  <td className="py-3 px-4">
                    {record.mistakes.length > 0 ? (
                      <span className={`badge ${record.mistakes.some(m => m.severity === 'critical') ? 'badge-critical' : 'badge-warning'}`}>
                        {record.mistakes.length}
                      </span>
                    ) : (
                      <span className="badge badge-success">0</span>
                    )}
                  </td>
                  <td className="py-3 px-4 max-w-[200px] truncate" title={record.selfAssessment}>
                    {record.selfAssessment || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRecords.length === 0 && (
          <p className="text-center text-gray-500 py-8">暂无练习记录</p>
        )}
      </div>
    </div>
  )
}

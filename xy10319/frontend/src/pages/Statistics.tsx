import { useState, useEffect } from 'react'
import { Statistics as StatisticsType } from '../types'
import { statisticsApi } from '../services/api'

export default function Statistics() {
  const [stats, setStats] = useState<StatisticsType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const data = await statisticsApi.get()
      setStats(data)
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stats) {
    return <div className="card"><div className="empty-state">加载中...</div></div>
  }

  const { overview, consultant_stats, course_stats } = stats

  return (
    <div>
      <div className="card">
        <h2>整体转化概览</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="value">{overview.total_bookings}</div>
            <div className="label">总预约数</div>
          </div>
          <div className="stat-card">
            <div className="value" style={{ color: '#4caf50' }}>{overview.enrolled_count}</div>
            <div className="label">已报名数</div>
          </div>
          <div className="stat-card">
            <div className="value" style={{ color: '#ff9800' }}>{overview.following_count}</div>
            <div className="label">跟进中</div>
          </div>
          <div className="stat-card">
            <div className="value" style={{ color: '#f44336' }}>{overview.no_show_count}</div>
            <div className="label">未到课</div>
          </div>
          <div className="stat-card">
            <div className="value" style={{ color: '#9e9e9e' }}>{overview.lost_count}</div>
            <div className="label">已流失</div>
          </div>
          <div className="stat-card">
            <div className="value" style={{ color: '#667eea' }}>{overview.reactivated_count}</div>
            <div className="label">重新激活</div>
          </div>
        </div>
        
        <div className="card" style={{ marginTop: '20px', marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>整体转化率</span>
            <span style={{ fontSize: '28px', fontWeight: 700, color: '#667eea' }}>
              {overview.conversion_rate}%
            </span>
          </div>
          <div className="progress-bar" style={{ marginTop: '15px' }}>
            <div 
              className="fill" 
              style={{ width: `${Math.min(overview.conversion_rate, 100)}%` }}
            />
          </div>
          <div style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
            {overview.enrolled_count} / {overview.total_bookings} 个预约成功转化为正式报名
          </div>
        </div>
      </div>

      <div className="card">
        <h2>顾问跟进质量分析</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="stat-table">
            <thead>
              <tr>
                <th>顾问</th>
                <th>部门</th>
                <th>总预约</th>
                <th>已报名</th>
                <th>转化率</th>
                <th>跟进次数</th>
                <th>平均满意度</th>
                <th>流失数</th>
                <th>未到课</th>
              </tr>
            </thead>
            <tbody>
              {consultant_stats.map(stat => {
                const conversionRate = stat.total_bookings > 0 
                  ? ((stat.enrolled_count / stat.total_bookings) * 100).toFixed(1)
                  : '0'
                return (
                  <tr key={stat.id}>
                    <td><strong>{stat.name}</strong></td>
                    <td>{stat.department || '-'}</td>
                    <td>{stat.total_bookings}</td>
                    <td style={{ color: '#4caf50', fontWeight: 600 }}>{stat.enrolled_count}</td>
                    <td>
                      <span style={{ 
                        color: Number(conversionRate) >= 50 ? '#4caf50' : 
                               Number(conversionRate) >= 30 ? '#ff9800' : '#f44336',
                        fontWeight: 600
                      }}>
                        {conversionRate}%
                      </span>
                    </td>
                    <td>{stat.follow_up_count}</td>
                    <td>
                      {stat.avg_satisfaction 
                        ? `${stat.avg_satisfaction.toFixed(1)} ★`
                        : '-'
                      }
                    </td>
                    <td style={{ color: '#9e9e9e' }}>{stat.lost_count}</td>
                    <td style={{ color: '#f44336' }}>{stat.no_show_count}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {consultant_stats.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div className="alert alert-info">
              <strong>分析提示：</strong>
              <ul style={{ marginTop: '10px', marginLeft: '20px' }}>
                <li>转化率 = 已报名数 ÷ 总预约数 × 100%</li>
                <li>跟进次数反映顾问的积极程度</li>
                <li>平均满意度反映家长对课程和服务的评价</li>
                <li>未到课率高可能意味着预约质量或提醒机制需要优化</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>课程转化分析</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="stat-table">
            <thead>
              <tr>
                <th>课程名称</th>
                <th>适用年龄</th>
                <th>总预约</th>
                <th>已报名</th>
                <th>转化率</th>
              </tr>
            </thead>
            <tbody>
              {course_stats.map(stat => {
                const conversionRate = stat.total_bookings > 0 
                  ? ((stat.enrolled_count / stat.total_bookings) * 100).toFixed(1)
                  : '0'
                return (
                  <tr key={stat.id}>
                    <td><strong>{stat.name}</strong></td>
                    <td>{stat.age_range}</td>
                    <td>{stat.total_bookings}</td>
                    <td style={{ color: '#4caf50', fontWeight: 600 }}>{stat.enrolled_count}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{conversionRate}%</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>关键业务规则说明</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
          <div style={{ padding: '15px', background: '#e8f5e9', borderRadius: '8px' }}>
            <div style={{ fontWeight: 600, color: '#2e7d32', marginBottom: '8px' }}>✓ 优惠名额防重复锁定</div>
            <div style={{ fontSize: '13px', color: '#555' }}>
              报名时后端会校验优惠是否已被其他预约使用，确保同一优惠不会被重复锁定。
            </div>
          </div>
          <div style={{ padding: '15px', background: '#fff8e1', borderRadius: '8px' }}>
            <div style={{ fontWeight: 600, color: '#f57f17', marginBottom: '8px' }}>✓ 未到课不能报名</div>
            <div style={{ fontSize: '13px', color: '#555' }}>
              只有完成签到的预约才能进行正式报名，确保试听课程的质量和有效性。
            </div>
          </div>
          <div style={{ padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
            <div style={{ fontWeight: 600, color: '#1565c0', marginBottom: '8px' }}>✓ 流失历史追踪</div>
            <div style={{ fontSize: '13px', color: '#555' }}>
              标记流失的线索会记录流失原因，重新激活时保留历史记录，便于分析和改进。
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

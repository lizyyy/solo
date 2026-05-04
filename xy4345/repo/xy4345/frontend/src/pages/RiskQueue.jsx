import React, { useState, useEffect } from 'react'

function RiskQueue() {
  const [risks, setRisks] = useState([])
  const [selectedRisk, setSelectedRisk] = useState(null)
  const [filter, setFilter] = useState('all')
  const [reviewComment, setReviewComment] = useState('')
  const [statusChange, setStatusChange] = useState('')
  const [programs, setPrograms] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [risksRes, programsRes] = await Promise.all([
        fetch('/api/risks'),
        fetch('/api/programs')
      ])
      
      if (risksRes.ok) setRisks(await risksRes.json())
      if (programsRes.ok) setPrograms(await programsRes.json())
    } catch (error) {
      console.error('Failed to fetch data:', error)
    }
  }

  const filteredRisks = filter === 'all' 
    ? risks 
    : risks.filter(r => r.status === filter)

  const getRiskTypeLabel = (type) => {
    const labels = {
      'expired_music': '音乐过期',
      'expiring_soon': '即将过期',
      'no_authorization': '缺少授权',
      'ad_too_long': '广告超时',
      'duplicate_claim': '重复声明'
    }
    return labels[type] || type
  }

  const getRiskTypeIcon = (type) => {
    const icons = {
      'expired_music': '⏰',
      'expiring_soon': '📅',
      'no_authorization': '❓',
      'ad_too_long': '⏱️',
      'duplicate_claim': '🔄'
    }
    return icons[type] || '⚠️'
  }

  const getProgramName = (programId) => {
    const program = programs.find(p => p.id === programId)
    return program ? program.name : 'Unknown'
  }

  const handleAddReview = async () => {
    if (!selectedRisk || !reviewComment.trim()) return

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          risk_id: selectedRisk.id,
          reviewer: '剪辑师',
          comment: reviewComment,
          status_change: statusChange || null
        })
      })

      if (response.ok) {
        setReviewComment('')
        setStatusChange('')
        fetchData()
        
        const updatedRisk = risks.find(r => r.id === selectedRisk.id)
        if (updatedRisk) {
          const riskRes = await fetch(`/api/risks/${selectedRisk.id}`)
          if (riskRes.ok) {
            setSelectedRisk(await riskRes.json())
          }
        }
      }
    } catch (error) {
      console.error('Failed to add review:', error)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">风险队列</h3>
            <div className="flex gap-2">
              {['all', 'pending', 'reviewing', 'resolved', 'dismissed'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    filter === f
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? '全部' : 
                   f === 'pending' ? '待处理' :
                   f === 'reviewing' ? '处理中' :
                   f === 'resolved' ? '已解决' : '已忽略'}
                </button>
              ))}
            </div>
          </div>

          {filteredRisks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暂无风险记录</p>
          ) : (
            <div className="space-y-3">
              {filteredRisks.map((risk) => (
                <div
                  key={risk.id}
                  onClick={() => {
                    setSelectedRisk(risk)
                    fetch(`/api/risks/${risk.id}`)
                      .then(res => res.ok ? res.json() : null)
                      .then(data => data && setSelectedRisk(data))
                  }}
                  className={`p-4 rounded-lg cursor-pointer transition-colors ${
                    selectedRisk?.id === risk.id
                      ? 'bg-primary-50 border-2 border-primary-200'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getRiskTypeIcon(risk.risk_type)}</span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge badge-${risk.severity}`}>
                            {risk.severity === 'high' ? '高风险' : risk.severity === 'medium' ? '中风险' : '低风险'}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {getRiskTypeLabel(risk.risk_type)}
                          </span>
                          <span className="text-sm text-gray-400">
                            | {getProgramName(risk.program_id)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{risk.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          检测时间: {risk.detected_at}
                        </p>
                      </div>
                    </div>
                    <span className={`badge badge-${risk.status}`}>
                      {risk.status === 'pending' ? '待处理' :
                       risk.status === 'reviewing' ? '处理中' :
                       risk.status === 'resolved' ? '已解决' : '已忽略'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-1">
        {selectedRisk ? (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">风险详情</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">风险类型</label>
                <p className="font-medium">{getRiskTypeLabel(selectedRisk.risk_type)}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">严重程度</label>
                <p>
                  <span className={`badge badge-${selectedRisk.severity}`}>
                    {selectedRisk.severity === 'high' ? '高' : selectedRisk.severity === 'medium' ? '中' : '低'}
                  </span>
                </p>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">当前状态</label>
                <p>
                  <span className={`badge badge-${selectedRisk.status}`}>
                    {selectedRisk.status === 'pending' ? '待处理' :
                     selectedRisk.status === 'reviewing' ? '处理中' :
                     selectedRisk.status === 'resolved' ? '已解决' : '已忽略'}
                  </span>
                </p>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">描述</label>
                <p className="text-sm text-gray-700">{selectedRisk.description}</p>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">添加复核意见</h4>
                <textarea
                  className="input mb-3"
                  rows={3}
                  placeholder="输入复核意见..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
                <div className="mb-3">
                  <label className="block text-sm text-gray-500 mb-1">更改状态（可选）</label>
                  <select
                    className="select"
                    value={statusChange}
                    onChange={(e) => setStatusChange(e.target.value)}
                  >
                    <option value="">不更改</option>
                    <option value="reviewing">标记为处理中</option>
                    <option value="resolved">标记为已解决</option>
                    <option value="dismissed">标记为已忽略</option>
                    <option value="pending">标记为待处理</option>
                  </select>
                </div>
                <button
                  onClick={handleAddReview}
                  className="btn-primary w-full"
                  disabled={!reviewComment.trim()}
                >
                  提交意见
                </button>
              </div>

              {selectedRisk.reviews && selectedRisk.reviews.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">复核历史</h4>
                  <div className="space-y-3">
                    {selectedRisk.reviews.map((review) => (
                      <div key={review.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{review.reviewer}</span>
                          <span className="text-xs text-gray-400">{review.created_at}</span>
                        </div>
                        <p className="text-sm text-gray-700">{review.comment}</p>
                        {review.status_change && (
                          <p className="text-xs text-primary-600 mt-1">
                            → 状态更改为: {review.status_change === 'reviewing' ? '处理中' :
                                          review.status_change === 'resolved' ? '已解决' :
                                          review.status_change === 'dismissed' ? '已忽略' : '待处理'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card">
            <p className="text-gray-500 text-center py-8">选择一个风险查看详情</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RiskQueue

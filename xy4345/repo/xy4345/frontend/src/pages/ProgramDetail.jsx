import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

function ProgramDetail() {
  const { id } = useParams()
  const [program, setProgram] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProgram()
  }, [id])

  const fetchProgram = async () => {
    try {
      const response = await fetch(`/api/programs/${id}`)
      if (response.ok) {
        setProgram(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch program:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMaterialTypeIcon = (type) => {
    const icons = {
      music: '🎵',
      clip: '📦',
      ad: '📢',
      guest: '👤'
    }
    return icons[type] || '📄'
  }

  const getMaterialTypeLabel = (type) => {
    const labels = {
      music: '音乐',
      clip: '素材片段',
      ad: '广告',
      guest: '嘉宾'
    }
    return labels[type] || type
  }

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

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  if (!program) {
    return (
      <div className="card text-center py-8">
        <p className="text-gray-500 mb-4">节目不存在</p>
        <Link to="/" className="btn-primary inline-block">
          返回仪表板
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">
                {program.name}
              </h2>
              <span className={`badge badge-${
                program.status === 'draft' ? 'pending' :
                program.status === 'reviewing' ? 'reviewing' : 'resolved'
              }`}>
                {program.status === 'draft' ? '草稿' :
                 program.status === 'reviewing' ? '审核中' : '已完成'}
              </span>
            </div>
            {program.episode_number && (
              <p className="text-sm text-gray-500 mt-1">
                第 {program.episode_number} 期
                {program.title && ` - ${program.title}`}
              </p>
            )}
          </div>
          <Link to="/" className="btn-secondary">
            ← 返回
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">
            📦 素材列表 ({program.materials?.length || 0})
          </h3>
          
          {!program.materials?.length ? (
            <p className="text-gray-500 text-center py-8">暂无素材</p>
          ) : (
            <div className="space-y-3">
              {program.materials.map((material) => (
                <div key={material.id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{getMaterialTypeIcon(material.type)}</span>
                      <div>
                        <h4 className="font-medium text-gray-900">{material.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {getMaterialTypeLabel(material.type)}
                          </span>
                          {material.source && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span className="text-xs text-gray-500">
                                来源: {material.source}
                              </span>
                            </>
                          )}
                          {material.duration && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span className="text-xs text-gray-500">
                                时长: {material.duration}秒
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">
            📄 授权记录 ({program.authorizations?.length || 0})
          </h3>
          
          {!program.authorizations?.length ? (
            <p className="text-gray-500 text-center py-8">暂无授权记录</p>
          ) : (
            <div className="space-y-3">
              {program.authorizations.map((auth) => (
                <div key={auth.id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{auth.holder_name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {getMaterialTypeLabel(auth.type)}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-xs text-gray-500">
                          {auth.permission_type}
                        </span>
                      </div>
                      {(auth.valid_from || auth.valid_until) && (
                        <p className="text-xs text-gray-500 mt-1">
                          有效期: {auth.valid_from || '-'} 至 {auth.valid_until || '永久'}
                        </p>
                      )}
                      {auth.notes && (
                        <p className="text-xs text-gray-600 mt-1">
                          备注: {auth.notes}
                        </p>
                      )}
                    </div>
                    <span className={`badge badge-${auth.status === 'active' ? 'resolved' : 'pending'}`}>
                      {auth.status === 'active' ? '有效' : auth.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">
          ⚠️ 相关风险 ({program.risks?.length || 0})
        </h3>
        
        {!program.risks?.length ? (
          <p className="text-gray-500 text-center py-8">暂无风险记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">风险类型</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">描述</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">严重程度</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">检测时间</th>
                </tr>
              </thead>
              <tbody>
                {program.risks.map((risk) => (
                  <tr key={risk.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-900">{getRiskTypeLabel(risk.risk_type)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{risk.description}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge badge-${risk.severity}`}>
                        {risk.severity === 'high' ? '高' : risk.severity === 'medium' ? '中' : '低'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge badge-${risk.status}`}>
                        {risk.status === 'pending' ? '待处理' :
                         risk.status === 'reviewing' ? '处理中' :
                         risk.status === 'resolved' ? '已解决' : '已忽略'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-500">{risk.detected_at}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {program.risks?.length > 0 && (
          <div className="mt-4">
            <Link to="/risks" className="btn-secondary inline-block">
              前往风险队列处理
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProgramDetail

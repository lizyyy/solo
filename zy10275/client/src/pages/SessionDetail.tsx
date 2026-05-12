import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { CourtSession, Player, SessionStatus, PlayerStatus, Member, FeeAdjustment, PlayerSettlement } from '../types'
import { api } from '../api'

interface SessionDetailProps {
  showToast: (message: string, type: 'success' | 'error') => void
}

const SessionDetail: React.FC<SessionDetailProps> = ({ showToast }) => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<CourtSession | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [newPlayer, setNewPlayer] = useState({
    memberId: '',
    memberName: '',
    memberPhone: '',
    isMember: false
  })

  const fetchSession = async () => {
    if (!id) return
    try {
      const [sessionData, membersData] = await Promise.all([
        api.getSession(id),
        api.getMembers()
      ])
      setSession(sessionData)
      setMembers(membersData)
    } catch (error) {
      showToast('加载场次详情失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSession()
  }, [id])

  const handleCheckAutoCancel = async () => {
    if (!id) return
    try {
      const result = await api.checkAutoCancel(id)
      if (result.cancelled) {
        showToast(result.reason || '场次已自动取消', 'error')
        fetchSession()
      } else {
        showToast('检查完成，无需取消', 'success')
      }
    } catch (error: any) {
      showToast(error.message || '检查失败', 'error')
    }
  }

  const handleAddPlayer = async () => {
    if (!id || !newPlayer.memberName || !newPlayer.memberPhone) {
      showToast('请填写姓名和电话', 'error')
      return
    }

    try {
      const result = await api.addPlayer(id, newPlayer)
      showToast(result.wasWaitlisted ? '已加入候补队列' : '添加成功', 'success')
      setNewPlayer({ memberId: '', memberName: '', memberPhone: '', isMember: false })
      fetchSession()
    } catch (error: any) {
      showToast(error.message || '添加失败', 'error')
    }
  }

  const handleConfirmAttendance = async (playerId: string) => {
    if (!id) return
    try {
      await api.confirmPlayer(id, playerId)
      showToast('确认到场成功', 'success')
      fetchSession()
    } catch (error: any) {
      showToast(error.message || '操作失败', 'error')
    }
  }

  const handleCancelPlayer = async (playerId: string) => {
    if (!id) return
    try {
      const result = await api.cancelPlayer(id, playerId)
      if ((result as any).promotedFromWaitlist) {
        showToast(`取消成功，候补队员 ${(result as any).promotedFromWaitlist.memberName} 已转正`, 'success')
      } else {
        showToast('取消成功', 'success')
      }
      fetchSession()
    } catch (error: any) {
      showToast(error.message || '操作失败', 'error')
    }
  }

  const handleRefund = async (playerId: string) => {
    if (!id) return
    try {
      await api.refundPlayer(id, playerId)
      showToast('退款成功', 'success')
      fetchSession()
    } catch (error: any) {
      showToast(error.message || '操作失败', 'error')
    }
  }

  const handleCancelSession = async () => {
    if (!id) return
    if (!window.confirm('确定要取消本场次吗？')) return
    try {
      await api.cancelSession(id)
      showToast('场次已取消', 'success')
      navigate('/')
    } catch (error: any) {
      showToast(error.message || '操作失败', 'error')
    }
  }

  const handleCompleteSession = async () => {
    if (!id) return
    if (!window.confirm('确定要完成并结算本场次吗？')) return
    try {
      await api.completeSession(id)
      showToast('场次已完成结算', 'success')
      fetchSession()
    } catch (error: any) {
      showToast(error.message || '操作失败', 'error')
    }
  }

  const handleSelectMember = (memberId: string) => {
    const member = members.find(m => m.id === memberId)
    if (member) {
      setNewPlayer({
        memberId: member.id,
        memberName: member.name,
        memberPhone: member.phone,
        isMember: member.isMember
      })
    } else {
      setNewPlayer({ memberId: '', memberName: '', memberPhone: '', isMember: false })
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px' }}>加载中...</div>
  }

  if (!session) {
    return <div style={{ textAlign: 'center', padding: '60px' }}>场次不存在</div>
  }

  const activePlayers = session.players.filter(p => 
    p.status === PlayerStatus.CONFIRMED
  )
  const cancelledPlayers = session.players.filter(p => 
    p.status === PlayerStatus.CANCELLED || p.status === PlayerStatus.REFUNDED
  )

  const getStatusText = (status: SessionStatus) => {
    const map: Record<SessionStatus, string> = {
      [SessionStatus.OPEN]: '报名中',
      [SessionStatus.FULL]: '已满',
      [SessionStatus.CANCELLED]: '已取消',
      [SessionStatus.COMPLETED]: '已完成'
    }
    return map[status]
  }

  const getStatusClass = (status: SessionStatus) => {
    const map: Record<SessionStatus, string> = {
      [SessionStatus.OPEN]: 'status-open',
      [SessionStatus.FULL]: 'status-full',
      [SessionStatus.CANCELLED]: 'status-cancelled',
      [SessionStatus.COMPLETED]: 'status-completed'
    }
    return map[status]
  }

  const canEdit = session.status === SessionStatus.OPEN || session.status === SessionStatus.FULL

  return (
    <div className="detail-page">
      <Link to="/" className="back-link">
        ← 返回列表
      </Link>

      <div className="detail-header">
        <div className="detail-info">
          <h2>🏸 {session.courtNumber}号场地</h2>
          <div className="session-meta">
            <span className="meta-item">📅 {session.date}</span>
            <span className="meta-item">⏰ {session.startTime} - {session.endTime}</span>
            <span className="meta-item">👥 最低 {session.minPlayers} 人</span>
            <span className="meta-item">💰 总费用 ¥{session.totalFee}</span>
          </div>
          <div className="detail-stats">
            <div className="stat-item">
              <div className="stat-value">{activePlayers.length}/{session.maxPlayers}</div>
              <div className="stat-label">已报名</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{session.waitlist.length}</div>
              <div className="stat-label">候补</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                ¥{session.referenceFeePerPerson ?? Math.round(session.totalFee / session.maxPlayers * 100) / 100}
              </div>
              <div className="stat-label">当前人均</div>
            </div>
          </div>
          {session.autoCancelIfNotEnough && !session.settlement && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#fff3cd', borderRadius: '8px', fontSize: '14px' }}>
              ⚠️ 自动取消: 距离开场不足 {session.cancelThresholdMinutes} 分钟且人数不足 {session.minPlayers} 人时自动取消
            </div>
          )}
          {session.settlement && (
            <div style={{ marginTop: '16px', padding: '16px', background: '#d4edda', borderRadius: '8px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>✅ 已完成结算</div>
              <div style={{ fontSize: '14px', color: '#555' }}>
                最终 {session.settlement.finalPlayerCount} 人，实际人均 ¥{session.settlement.actualFeePerPerson}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
          <span className={`status-badge ${getStatusClass(session.status)}`}>
            {getStatusText(session.status)}
          </span>
          {canEdit && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={handleCheckAutoCancel}>
                检查人数
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleCompleteSession}>
                完成并结算
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleCancelSession}>
                取消场次
              </button>
            </>
          )}
        </div>
      </div>

      {session.feeAdjustments && session.feeAdjustments.length > 0 && (
        <div className="players-section">
          <h3>📊 费用调整记录</h3>
          <div style={{ 
            display: 'grid', 
            gap: '8px', 
            maxHeight: '200px', 
            overflowY: 'auto',
            padding: '8px'
          }}>
            {session.feeAdjustments.map((adjustment: FeeAdjustment) => (
              <div key={adjustment.id} style={{
                padding: '10px 14px',
                background: '#f8f9fa',
                borderRadius: '6px',
                fontSize: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{adjustment.description}</span>
                  <span style={{ color: '#666', marginLeft: '8px' }}>
                    {adjustment.playerCountBefore}人 → {adjustment.playerCountAfter}人
                  </span>
                </div>
                <div style={{ fontWeight: 600, color: adjustment.feePerPersonAfter > adjustment.feePerPersonBefore ? '#dc3545' : '#28a745' }}>
                  ¥{adjustment.feePerPersonBefore} → ¥{adjustment.feePerPersonAfter}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="players-section">
        <h3>👤 已确认报名 ({activePlayers.length} 人)</h3>
        {activePlayers.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px' }}>
            <p>暂无报名人员</p>
          </div>
        ) : (
          <div className="players-grid">
            {activePlayers.map(player => (
              <div key={player.id} className="player-card">
                <div className="player-header">
                  <span className="player-name">{player.memberName}</span>
                  {player.isMember && <span className="member-badge">会员 {(player.settlement?.memberDiscount || 0.9) * 10}折</span>}
                </div>
                <div className="player-phone">{player.memberPhone}</div>
                <div className="player-fee">
                  <div>已付: ¥{player.originalPaidAmount}</div>
                  {player.totalAdjustments !== 0 && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: player.totalAdjustments > 0 ? '#dc3545' : '#28a745',
                      marginTop: '4px'
                    }}>
                      {player.totalAdjustments > 0 ? '+' : ''}调整: ¥{player.totalAdjustments}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    当前: ¥{player.currentFee}
                  </div>
                  {player.settlement && (
                    <>
                      {player.settlement.refundDue > 0 && (
                        <div style={{ fontSize: '12px', color: '#28a745', marginTop: '4px' }}>
                          💸 应退: ¥{player.settlement.refundDue}
                        </div>
                      )}
                      {player.settlement.additionalPaymentDue > 0 && (
                        <div style={{ fontSize: '12px', color: '#dc3545', marginTop: '4px' }}>
                          💳 补收: ¥{player.settlement.additionalPaymentDue}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {player.confirmedAt && (
                  <span className="confirmed-badge">✓ 已确认到场</span>
                )}
                {canEdit && !session.settlement && (
                  <div className="player-actions">
                    {!player.confirmedAt && (
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleConfirmAttendance(player.id)}
                      >
                        确认到场
                      </button>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleCancelPlayer(player.id)}
                    >
                      取消报名
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {session.waitlist.length > 0 && (
        <div className="waitlist-section">
          <h3>⏳ 候补队列 ({session.waitlist.length} 人)</h3>
          <div className="players-grid">
            {session.waitlist.map((player, index) => (
              <div key={player.id} className="player-card waitlist">
                <div className="player-header">
                  <span className="player-name">#{index + 1} {player.memberName}</span>
                  {player.isMember && <span className="member-badge">会员</span>}
                </div>
                <div className="player-phone">{player.memberPhone}</div>
                {canEdit && !session.settlement && (
                  <div className="player-actions">
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleCancelPlayer(player.id)}
                    >
                      取消候补
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {cancelledPlayers.length > 0 && (
        <div className="players-section">
          <h3>❌ 已取消 / 已退款 ({cancelledPlayers.length} 人)</h3>
          <div className="players-grid">
            {cancelledPlayers.map(player => (
              <div key={player.id} className="player-card cancelled">
                <div className="player-header">
                  <span className="player-name">{player.memberName}</span>
                </div>
                <div className="player-phone">{player.memberPhone}</div>
                <div className="player-fee">
                  {player.refundAmount ? (
                    <span style={{ color: '#28a745' }}>已退款: ¥{player.refundAmount}</span>
                  ) : (
                    <span style={{ color: '#dc3545' }}>待退款: ¥{player.currentFee}</span>
                  )}
                </div>
                {canEdit && !player.refundAmount && player.status === PlayerStatus.CANCELLED && !session.settlement && (
                  <div className="player-actions">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleRefund(player.id)}
                    >
                      确认退款
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {canEdit && !session.settlement && (
        <div className="action-area">
          <h3>➕ 添加球员</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>选择会员 (可选)</label>
              <select
                value={newPlayer.memberId}
                onChange={e => handleSelectMember(e.target.value)}
              >
                <option value="">--- 新用户 ---</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.phone}) {m.isMember ? '[会员]' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>姓名 *</label>
              <input
                type="text"
                value={newPlayer.memberName}
                onChange={e => setNewPlayer(p => ({ ...p, memberName: e.target.value }))}
                placeholder="请输入姓名"
              />
            </div>
            <div className="form-group">
              <label>电话 *</label>
              <input
                type="tel"
                value={newPlayer.memberPhone}
                onChange={e => setNewPlayer(p => ({ ...p, memberPhone: e.target.value }))}
                placeholder="请输入电话"
              />
            </div>
            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="isMember"
                checked={newPlayer.isMember}
                onChange={e => setNewPlayer(p => ({ ...p, isMember: e.target.checked }))}
              />
              <label htmlFor="isMember">会员 (享受折扣)</label>
            </div>
          </div>
          <div className="action-buttons">
            <button className="btn btn-primary" onClick={handleAddPlayer}>
              添加到拼场
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionDetail

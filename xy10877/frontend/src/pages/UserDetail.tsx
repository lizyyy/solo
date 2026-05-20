import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { userApi, syncApi, UserDetail as UserDetailType } from '../services/api';

const UserDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<UserDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncData, setSyncData] = useState<any>(null);

  useEffect(() => {
    if (userId) {
      loadUserData();
      loadSyncStatus();
    }
  }, [userId]);

  const loadUserData = async () => {
    try {
      const response = await userApi.getUserDetail(userId!);
      setData(response.data.data);
    } catch (error) {
      console.error('加载用户详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const response = await syncApi.getSyncStatus(userId!);
      setSyncData(response.data.data);
    } catch (error) {
      console.error('加载同步状态失败:', error);
    }
  };

  const handleCompensation = async (deviceId?: string) => {
    try {
      await syncApi.triggerCompensation(userId!, deviceId);
      alert('补偿成功！');
      loadSyncStatus();
      loadUserData();
    } catch (error) {
      console.error('补偿失败:', error);
      alert('补偿失败');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'app': return '📱';
      case 'web': return '🌐';
      case 'cs': return '💬';
      default: return '📱';
    }
  };

  const getEventTypeName = (type: string) => {
    switch (type) {
      case 'renewal': return '续费';
      case 'compensation': return '补偿';
      case 'expiration': return '到期';
      case 'purchase': return '购买';
      default: return type;
    }
  };

  const getBenefitName = (benefit: string) => {
    const names: Record<string, string> = {
      'premium_content': '高级内容',
      'ad_free': '无广告',
      'priority_support': '优先客服',
      'basic_content': '基础内容',
      'extended_warranty': '延长质保',
      'gift_card': '礼品卡',
      'api_access': 'API 访问',
      'team_management': '团队管理'
    };
    return names[benefit] || benefit;
  };

  if (loading || !data) {
    return <div className="loading">加载中...</div>;
  }

  const { user, events, deviceStatus } = data;

  return (
    <div>
      <div className="back-link" onClick={() => navigate('/')}>
        ← 返回用户列表
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div className="user-avatar" style={{ width: 64, height: 64, fontSize: 24 }}>
            {user.name.charAt(0)}
          </div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 600 }}>{user.name}</h2>
            <p style={{ color: '#6b7280' }}>{user.email}</p>
            <div style={{ marginTop: 8 }}>
              <span className={`plan-badge plan-${user.currentPlan}`} style={{ fontSize: 14 }}>
                {user.currentPlan.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ padding: 16, background: '#f3f4f6', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>生效时间</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{formatDate(user.validFrom)}</div>
          </div>
          <div style={{ padding: 16, background: '#f3f4f6', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>到期时间</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{formatDate(user.validUntil)}</div>
          </div>
          <div style={{ padding: 16, background: '#f3f4f6', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>当前权益</div>
            <div>
              {user.currentBenefits.length > 0 ? (
                user.currentBenefits.map((b, i) => (
                  <span key={i} className="benefit-tag">{getBenefitName(b)}</span>
                ))
              ) : (
                <span style={{ color: '#9ca3af' }}>无</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {syncData?.diffSnapshot?.hasDiff && (
        <div className="diff-section">
          <div className="diff-title">⚠ {syncData.diffSnapshot.summary}</div>
          <div className="diff-compare">
            <div className="diff-expected">
              <div className="diff-label">✓ 预期状态</div>
              <div>
                <strong>套餐：</strong>{syncData.diffSnapshot.expectedState.plan.toUpperCase()}
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>权益：</strong>
                {syncData.diffSnapshot.expectedState.benefits.map((b: string, i: number) => (
                  <span key={i} className="benefit-tag">{getBenefitName(b)}</span>
                ))}
              </div>
            </div>
            <div className="diff-actual">
              <div className="diff-label">✗ 当前状态（延迟设备）</div>
              <div>
                <strong>套餐：</strong>{syncData.diffSnapshot.delayedState.plan.toUpperCase()}
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>权益：</strong>
                {syncData.diffSnapshot.delayedState.benefits.map((b: string, i: number) => (
                  <span key={i} className="benefit-tag">{getBenefitName(b)}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <button
              className="btn btn-success"
              onClick={() => handleCompensation()}
            >
              全部设备立即补偿
            </button>
            {syncData.diffSnapshot.affectedDevices.map((device: any) => (
              <button
                key={device.deviceId}
                className="btn btn-primary"
                onClick={() => handleCompensation(device.deviceId)}
              >
                仅补偿 {device.deviceName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">设备同步状态</h2>
        <div className="device-list">
          {deviceStatus.map((device) => (
            <div key={device.id} className="device-item">
              <div className="device-info">
                <div className={`device-icon ${device.type}`}>
                  {getDeviceIcon(device.type)}
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>{device.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    最后同步: {formatDate(device.lastSync)}
                  </div>
                  {device.diff && device.diff.missingBenefits.length > 0 && (
                    <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                      缺少权益: {device.diff.missingBenefits.map(getBenefitName).join(', ')}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <span className={`sync-badge ${device.syncStatus}`}>
                  {device.syncStatus === 'synced' ? '✓ 已同步' : '⚠ 同步延迟'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">事件时间线</h2>
        <div className="event-timeline">
          {events.map((event) => (
            <div key={event.id} className={`event-item ${event.type}`}>
              <div className="event-dot"></div>
              <div className="event-content">
                <div className="event-type">{getEventTypeName(event.type)}</div>
                <div className="event-description">{event.description}</div>
                <div className="event-time">{formatDate(event.timestamp)}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                  事件ID: {event.id}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserDetail;

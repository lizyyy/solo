import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi, User } from '../services/api';

const UserList = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await userApi.getUsers();
      setUsers(response.data.data);
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="card">
        <h2 className="card-title">用户列表</h2>
        <div className="user-list">
          {users.map((user) => (
            <div
              key={user.id}
              className="user-item"
              onClick={() => navigate(`/user/${user.id}`)}
            >
              <div className="user-info">
                <div className="user-avatar">{user.name.charAt(0)}</div>
                <div className="user-details">
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                  <div style={{ marginTop: 4 }}>
                    <span className={`plan-badge plan-${user.currentPlan}`}>
                      {user.currentPlan.toUpperCase()}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>
                      有效期至: {formatDate(user.validUntil)}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <span className={`sync-badge ${user.syncStatus.status}`}>
                  {user.syncStatus.status === 'synced' ? '✓ ' : '⚠ '}
                  {user.syncStatus.message}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">样例场景说明</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ padding: 16, background: '#d1fae5', borderRadius: 8 }}>
            <h4 style={{ color: '#065f46', marginBottom: 8 }}>🟢 张三 - 正常续费</h4>
            <p style={{ fontSize: 14, color: '#065f46' }}>
              所有设备权益已同步，Premium 会员生效中
            </p>
          </div>
          <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8 }}>
            <h4 style={{ color: '#92400e', marginBottom: 8 }}>🟡 李四 - 设备离线延迟</h4>
            <p style={{ fontSize: 14, color: '#92400e' }}>
              Android 设备因离线未同步，存在权益差异，可点击「立即补偿」修复
            </p>
          </div>
          <div style={{ padding: 16, background: '#fce7f3', borderRadius: 8 }}>
            <h4 style={{ color: '#9d174d', marginBottom: 8 }}>🟣 王五 - 人工补偿</h4>
            <p style={{ fontSize: 14, color: '#9d174d' }}>
              因服务故障获得额外权益补偿，所有设备已同步
            </p>
          </div>
          <div style={{ padding: 16, background: '#f3f4f6', borderRadius: 8 }}>
            <h4 style={{ color: '#4b5563', marginBottom: 8 }}>⚪ 赵六 - 到期收回</h4>
            <p style={{ fontSize: 14, color: '#4b5563' }}>
              会员已到期，权益已自动收回，所有设备已同步
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserList;

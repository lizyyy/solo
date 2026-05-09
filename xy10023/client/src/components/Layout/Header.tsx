import { Layout, Dropdown, Avatar, Badge } from 'antd';
import { UserOutlined, BellOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/stores/auth.store';
import { useOverdueFollowUps } from '@/api/followups.api';

const { Header: AntHeader } = Layout;

export function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { data: overdueFollowUps = [] } = useOverdueFollowUps();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenu = {
    items: [
      {
        key: 'profile',
        label: `个人信息`,
        icon: <UserOutlined />,
        disabled: true,
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        label: '退出登录',
        icon: <LogoutOutlined />,
        onClick: handleLogout,
      },
    ],
  };

  return (
    <AntHeader style={{ 
      background: '#fff', 
      padding: '0 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)',
    }}>
      <div style={{ 
        fontSize: '18px', 
        fontWeight: 600,
        color: '#1890ff'
      }}>
        客服跟进管理系统
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Dropdown
          menu={{
            items: overdueFollowUps.map((item) => ({
              key: item.id,
              label: (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ fontWeight: 500 }}>
                    工单: {item.content.substring(0, 20)}...
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    承诺时间: {item.promisedDeadline}
                  </div>
                </div>
              ),
              onClick: () => navigate(`/tickets/${item.ticketId}`),
            })),
          }}
          placement="bottomRight"
        >
          <Badge count={overdueFollowUps.length} size="small">
            <BellOutlined style={{ fontSize: 20, cursor: 'pointer', color: '#666' }} />
          </Badge>
        </Dropdown>

        <Dropdown menu={userMenu} placement="bottomRight">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            cursor: 'pointer' 
          }}>
            <Avatar size={32} icon={<UserOutlined />} />
            <span style={{ fontSize: 14 }}>
              {user?.fullName || user?.username}
            </span>
          </div>
        </Dropdown>
      </div>
    </AntHeader>
  );
}

export default Header;

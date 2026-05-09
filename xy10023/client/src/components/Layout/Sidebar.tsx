import { Layout, Menu } from 'antd';
import { 
  DashboardOutlined, 
  FileTextOutlined, 
  HistoryOutlined,
  ClockCircleOutlined,
  BellOutlined,
  FileExcelOutlined 
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/stores/auth.store';
import { UserRole } from '@/types';

const { Sider } = Layout;

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR;

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
      onClick: () => navigate('/dashboard'),
    },
    {
      key: '/tickets',
      icon: <FileTextOutlined />,
      label: '工单管理',
      onClick: () => navigate('/tickets'),
    },
    {
      key: '/followups',
      icon: <HistoryOutlined />,
      label: '跟进记录',
      onClick: () => navigate('/followups'),
    },
    {
      key: '/followups/pending',
      icon: <ClockCircleOutlined />,
      label: '待跟进',
      onClick: () => navigate('/followups/pending'),
    },
    {
      key: '/followups/overdue',
      icon: <BellOutlined />,
      label: '逾期提醒',
      onClick: () => navigate('/followups/overdue'),
    },
    ...(isAdmin ? [{
      key: '/exports',
      icon: <FileExcelOutlined />,
      label: '数据导出',
      onClick: () => navigate('/exports'),
    }] : []),
  ];

  const getSelectedKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/tickets/')) {
      return ['/tickets'];
    }
    return [path];
  };

  return (
    <Sider
      width={220}
      theme="dark"
      style={{
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
      }}
    >
      <div style={{ 
        height: 64, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        margin: 16,
      }}>
        <span style={{ 
          color: '#fff', 
          fontSize: 18, 
          fontWeight: 600 
        }}>
          客服系统
        </span>
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={getSelectedKeys()}
        items={menuItems}
        style={{ border: 'none' }}
      />
    </Sider>
  );
}

export default Sidebar;

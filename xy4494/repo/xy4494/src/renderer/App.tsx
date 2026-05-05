import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout,
  Menu,
  Button,
  Modal,
  message,
  Statistic,
  Card,
  Row,
  Col,
} from 'antd';
import {
  DatabaseOutlined,
  ImportOutlined,
  ExportOutlined,
  FileSearchOutlined,
  SettingOutlined,
  PlusOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { LostItem, ItemStatus, ItemCategory, AppSettings } from '../shared/types';
import ItemsList from './pages/ItemsList';
import ItemDetail from './pages/ItemDetail';
import ImportModal from './components/ImportModal';
import ExportModal from './components/ExportModal';
import SettingsModal from './components/SettingsModal';
import Dashboard from './pages/Dashboard';

const { Header, Sider, Content } = Layout;

type PageType = 'dashboard' | 'items' | 'import' | 'export' | 'settings';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [items, setItems] = useState<LostItem[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedItem, setSelectedItem] = useState<LostItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.data.getAllItems();
      setItems(data);
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const data = await window.electronAPI.settings.get();
      setSettings(data);
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }, []);

  useEffect(() => {
    loadItems();
    loadSettings();

    const unsubImport = window.electronAPI.onMenuImport(() => {
      setShowImport(true);
    });

    const unsubExport = window.electronAPI.onMenuExport(() => {
      setShowExport(true);
    });

    return () => {
      unsubImport();
      unsubExport();
    };
  }, [loadItems, loadSettings]);

  const handleSaveItem = async (item: LostItem) => {
    try {
      const saved = await window.electronAPI.data.saveItem(item);
      await loadItems();
      message.success('保存成功');
      return saved;
    } catch (error) {
      message.error('保存失败');
      throw error;
    }
  };

  const handleDeleteItem = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条失物记录吗？此操作不可撤销。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await window.electronAPI.data.deleteItem(id);
          await loadItems();
          message.success('删除成功');
          if (selectedItem?.id === id) {
            setShowDetail(false);
            setSelectedItem(null);
          }
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleOpenDetail = (item: LostItem) => {
    setSelectedItem(item);
    setShowDetail(true);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedItem(null);
  };

  const handleCreateItem = () => {
    const now = new Date().toISOString();
    const newItem: LostItem = {
      id: '',
      itemCode: '',
      station: settings?.defaultStation || '',
      category: ItemCategory.OTHER,
      description: '',
      finderName: '',
      finderContact: '',
      foundTime: now,
      foundLocation: '',
      estimatedValue: 0,
      specialMarks: '',
      photos: [],
      lockerRecords: [],
      claimAppointments: [],
      status: ItemStatus.PENDING,
      autoJudgeResult: null,
      manualReview: null,
      createdAt: now,
      updatedAt: now,
    };
    setSelectedItem(newItem);
    setShowDetail(true);
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '统计概览',
    },
    {
      key: 'items',
      icon: <DatabaseOutlined />,
      label: '失物管理',
    },
    {
      key: 'import',
      icon: <ImportOutlined />,
      label: '数据导入',
    },
    {
      key: 'export',
      icon: <ExportOutlined />,
      label: '数据导出',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'import') {
      setShowImport(true);
    } else if (key === 'export') {
      setShowExport(true);
    } else if (key === 'settings') {
      setShowSettings(true);
    } else {
      setCurrentPage(key as PageType);
    }
  };

  const getStatusCount = (status: ItemStatus) => {
    return items.filter((i) => i.status === status).length;
  };

  const getCategoryLabel = (category: ItemCategory) => {
    const labels: Record<ItemCategory, string> = {
      [ItemCategory.ELECTRONICS]: '电子设备',
      [ItemCategory.DOCUMENTS]: '证件',
      [ItemCategory.CLOTHING]: '衣物',
      [ItemCategory.BAGS]: '箱包',
      [ItemCategory.VALUABLES]: '贵重物品',
      [ItemCategory.KEYS]: '钥匙',
      [ItemCategory.OTHER]: '其他',
    };
    return labels[category] || category;
  };

  const getStatusLabel = (status: ItemStatus) => {
    const labels: Record<ItemStatus, string> = {
      [ItemStatus.PENDING]: '待处理',
      [ItemStatus.PROCESSING]: '处理中',
      [ItemStatus.APPROVED]: '可归还',
      [ItemStatus.NEED_PROOF]: '需补充证明',
      [ItemStatus.NEED_SUPERVISOR]: '需值班长复核',
      [ItemStatus.RETURNED]: '已归还',
      [ItemStatus.CLOSED]: '已关闭',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: ItemStatus) => {
    const colors: Record<ItemStatus, string> = {
      [ItemStatus.PENDING]: 'orange',
      [ItemStatus.PROCESSING]: 'blue',
      [ItemStatus.APPROVED]: 'green',
      [ItemStatus.NEED_PROOF]: 'gold',
      [ItemStatus.NEED_SUPERVISOR]: 'red',
      [ItemStatus.RETURNED]: 'default',
      [ItemStatus.CLOSED]: 'default',
    };
    return colors[status] || 'default';
  };

  return (
    <Layout className="app-container">
      <Header className="app-header">
        <h1>🚇 地铁失物招领管理系统</h1>
        <div className="header-actions">
          {currentPage === 'items' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateItem}>
              新增失物
            </Button>
          )}
        </div>
      </Header>

      <Layout className="app-layout">
        <Sider width={220} theme="dark" className="app-sidebar">
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={handleMenuClick}
            theme="dark"
          />
        </Sider>

        <Content className="app-content">
          {currentPage === 'dashboard' && (
            <Dashboard
              items={items}
              loading={loading}
              onOpenDetail={handleOpenDetail}
              getStatusLabel={getStatusLabel}
              getCategoryLabel={getCategoryLabel}
            />
          )}

          {currentPage === 'items' && (
            <ItemsList
              items={items}
              loading={loading}
              onRefresh={loadItems}
              onOpenDetail={handleOpenDetail}
              onDelete={handleDeleteItem}
              getStatusLabel={getStatusLabel}
              getStatusColor={getStatusColor}
              getCategoryLabel={getCategoryLabel}
            />
          )}
        </Content>
      </Layout>

      {showDetail && (
        <ItemDetail
          item={selectedItem!}
          open={showDetail}
          onClose={handleCloseDetail}
          onSave={handleSaveItem}
          getCategoryLabel={getCategoryLabel}
          getStatusLabel={getStatusLabel}
          getStatusColor={getStatusColor}
        />
      )}

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={loadItems}
      />

      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        items={items}
        getStatusLabel={getStatusLabel}
      />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={async (newSettings) => {
          try {
            await window.electronAPI.settings.save(newSettings);
            setSettings(await window.electronAPI.settings.get());
            message.success('设置已保存');
          } catch (error) {
            message.error('保存设置失败');
          }
        }}
      />
    </Layout>
  );
};

export default App;

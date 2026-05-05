import React, { useEffect, useState } from 'react';
import { Layout, Menu, Spin, Button, Dropdown, Space, Modal, Input, message } from 'antd';
import {
  HomeOutlined,
  WarningOutlined,
  FolderOpenOutlined,
  ExportOutlined,
  TableOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useApp } from '../store/AppContext';
import ProjectSelector from './ProjectSelector';
import Dashboard from './Dashboard';
import RiskList from './RiskList';
import ImportPanel from './ImportPanel';
import ExportPanel from './ExportPanel';
import DataView from './DataView';

const { Header, Sider, Content } = Layout;
const { confirm } = Modal;

type MenuKey = 'dashboard' | 'risks' | 'import' | 'export' | 'data';

const MainLayout: React.FC = () => {
  const {
    currentProject,
    projects,
    loadProjects,
    selectProject,
    createProject,
    runRiskAnalysis,
    isLoading,
  } = useApp();

  const [selectedMenu, setSelectedMenu] = useState<MenuKey>('dashboard');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      message.warning('请输入项目名称');
      return;
    }

    try {
      const project = await createProject(newProjectName.trim());
      await selectProject(project);
      setIsCreatingProject(false);
      setNewProjectName('');
      message.success('项目创建成功');
    } catch (error) {
      message.error('创建项目失败');
    }
  };

  const handleRunAnalysis = async () => {
    if (!currentProject) return;
    setIsAnalyzing(true);
    try {
      await runRiskAnalysis();
      message.success('风险分析完成');
    } catch (error) {
      message.error('风险分析失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <HomeOutlined />,
      label: '仪表盘',
    },
    {
      key: 'risks',
      icon: <WarningOutlined />,
      label: '风险预警',
    },
    {
      key: 'import',
      icon: <FolderOpenOutlined />,
      label: '数据导入',
    },
    {
      key: 'export',
      icon: <ExportOutlined />,
      label: '导出功能',
    },
    {
      key: 'data',
      icon: <TableOutlined />,
      label: '数据浏览',
    },
  ];

  const renderContent = () => {
    switch (selectedMenu) {
      case 'dashboard':
        return <Dashboard />;
      case 'risks':
        return <RiskList />;
      case 'import':
        return <ImportPanel />;
      case 'export':
        return <ExportPanel />;
      case 'data':
        return <DataView />;
      default:
        return <Dashboard />;
    }
  };

  if (!currentProject) {
    return (
      <div className="main-layout">
        <ProjectSelector
          onSelectProject={selectProject}
          onCreateProject={() => setIsCreatingProject(true)}
        />
        <Modal
          title="创建新项目"
          open={isCreatingProject}
          onOk={handleCreateProject}
          onCancel={() => {
            setIsCreatingProject(false);
            setNewProjectName('');
          }}
          okText="创建"
          cancelText="取消"
        >
          <Input
            placeholder="请输入项目名称"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onPressEnter={handleCreateProject}
          />
        </Modal>
      </div>
    );
  }

  return (
    <Layout className="main-layout">
      <Header className="main-layout-header">
        <div className="header-title">
          <span>🎬</span>
          <span>服装连续性管理工具</span>
        </div>
        <div className="header-project-info">
          <Space>
            <span>当前项目: {currentProject.name}</span>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRunAnalysis}
              loading={isAnalyzing}
              size="small"
            >
              运行风险分析
            </Button>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'switch',
                    label: '切换项目',
                    icon: <FolderOpenOutlined />,
                    onClick: () => {
                      confirm({
                        title: '确认切换项目？',
                        content: '当前未保存的修改将会丢失。',
                        onOk: () => {
                          selectProject({ ...currentProject, id: '' } as any);
                        },
                      });
                    },
                  },
                  {
                    key: 'new',
                    label: '新建项目',
                    icon: <PlusOutlined />,
                    onClick: () => setIsCreatingProject(true),
                  },
                ],
              }}
            >
              <Button size="small" icon={<UserOutlined />}>
                项目
              </Button>
            </Dropdown>
          </Space>
        </div>
      </Header>
      <Layout>
        <Sider width={200} theme="light" className="sider-menu">
          <Menu
            mode="inline"
            selectedKeys={[selectedMenu]}
            items={menuItems}
            onClick={({ key }) => setSelectedMenu(key as MenuKey)}
          />
        </Sider>
        <Content className="main-layout-content">
          <div className="content-panel">{renderContent()}</div>
        </Content>
      </Layout>
      {isLoading && (
        <div className="loading-overlay">
          <Spin size="large" />
        </div>
      )}
      <Modal
        title="创建新项目"
        open={isCreatingProject}
        onOk={handleCreateProject}
        onCancel={() => {
          setIsCreatingProject(false);
          setNewProjectName('');
        }}
        okText="创建"
        cancelText="取消"
      >
        <Input
          placeholder="请输入项目名称"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onPressEnter={handleCreateProject}
        />
      </Modal>
    </Layout>
  );
};

export default MainLayout;

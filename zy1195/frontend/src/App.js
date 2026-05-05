import React, { useState, useEffect } from 'react';
import { Layout, Button, Space, message, Modal } from 'antd';
import { 
  PlusOutlined, 
  HistoryOutlined,
  DashboardOutlined 
} from '@ant-design/icons';
import ExperimentList from './components/ExperimentList';
import ExperimentConfig from './components/ExperimentConfig';
import ExperimentMonitor from './components/ExperimentMonitor';
import api from './services/api';
import wsService from './services/websocket';

const { Header, Content } = Layout;

function App() {
  const [experiments, setExperiments] = useState([]);
  const [activeExperiment, setActiveExperiment] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showMonitor, setShowMonitor] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchExperiments();
    wsService.connect();

    wsService.on('experiment:finished', (data) => {
      message.success(`实验 ${data.experimentId.slice(0, 8)} 已完成`);
      fetchExperiments();
    });

    return () => {
      wsService.disconnect();
    };
  }, []);

  const fetchExperiments = async () => {
    try {
      const res = await api.getExperiments();
      setExperiments(res.data.data || []);
    } catch (err) {
      console.error('获取实验列表失败:', err);
      message.error('获取实验列表失败');
    }
  };

  const handleCreateExperiment = (config) => {
    setShowConfigModal(true);
  };

  const handleConfigSubmit = async (config) => {
    setLoading(true);
    try {
      const res = await api.createExperiment(config);
      message.success('实验创建成功');
      setShowConfigModal(false);
      fetchExperiments();
      return res.data.data;
    } catch (err) {
      console.error('创建实验失败:', err);
      message.error(err.response?.data?.message || '创建实验失败');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleStartExperiment = async (id) => {
    try {
      message.loading({ content: '正在启动实验...', key: 'start' });
      await api.startExperiment(id);
      message.success({ content: '实验已启动', key: 'start' });
      fetchExperiments();
      
      const experiment = experiments.find(e => e.id === id);
      if (experiment) {
        setActiveExperiment({ ...experiment, status: 'running' });
        setShowMonitor(true);
        wsService.subscribe(id);
      }
    } catch (err) {
      console.error('启动实验失败:', err);
      message.error(err.response?.data?.message || '启动实验失败');
    }
  };

  const handleViewExperiment = (experiment) => {
    setActiveExperiment(experiment);
    setShowMonitor(true);
    wsService.subscribe(experiment.id);
  };

  const handleDeleteExperiment = async (id) => {
    try {
      await api.deleteExperiment(id);
      message.success('实验已删除');
      fetchExperiments();
      if (activeExperiment?.id === id) {
        setShowMonitor(false);
        setActiveExperiment(null);
      }
    } catch (err) {
      console.error('删除实验失败:', err);
      message.error('删除实验失败');
    }
  };

  const handleCloseMonitor = () => {
    if (activeExperiment) {
      wsService.unsubscribe(activeExperiment.id);
    }
    setShowMonitor(false);
    setActiveExperiment(null);
    fetchExperiments();
  };

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <Space>
          <DashboardOutlined style={{ fontSize: 24, color: 'white' }} />
          <h1>网络协议实验台</h1>
        </Space>
        <Space style={{ marginLeft: 'auto' }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleCreateExperiment}
          >
            新建实验
          </Button>
          <Button 
            icon={<HistoryOutlined />}
            onClick={fetchExperiments}
          >
            刷新
          </Button>
        </Space>
      </Header>

      <Content className="app-content">
        {showMonitor && activeExperiment ? (
          <ExperimentMonitor
            experiment={activeExperiment}
            onClose={handleCloseMonitor}
          />
        ) : (
          <ExperimentList
            experiments={experiments}
            onStart={handleStartExperiment}
            onView={handleViewExperiment}
            onDelete={handleDeleteExperiment}
            onCreate={handleCreateExperiment}
          />
        )}
      </Content>

      <Modal
        title="新建实验"
        open={showConfigModal}
        onCancel={() => setShowConfigModal(false)}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <ExperimentConfig
          onSubmit={handleConfigSubmit}
          onCancel={() => setShowConfigModal(false)}
          loading={loading}
        />
      </Modal>
    </Layout>
  );
}

export default App;

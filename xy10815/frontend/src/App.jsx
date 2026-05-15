import React, { useState } from 'react';
import { Layout, Typography } from 'antd';
import TaskList from './components/TaskList';
import TaskDetail from './components/TaskDetail';

const { Header, Content } = Layout;
const { Title } = Typography;

function App() {
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', display: 'flex', alignItems: 'center' }}>
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          异步任务状态中枢
        </Title>
      </Header>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <div style={{ background: 'white', padding: 24, borderRadius: 8 }}>
          <TaskList
            key={listRefreshKey}
            onViewDetail={setSelectedTaskId}
          />
        </div>
      </Content>
      <TaskDetail
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onRefresh={() => setListRefreshKey(k => k + 1)}
      />
    </Layout>
  );
}

export default App;

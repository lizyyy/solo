import React from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppProvider } from './store/AppContext';
import MainLayout from './components/MainLayout';
import './App.less';

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ConfigProvider>
  );
};

export default App;

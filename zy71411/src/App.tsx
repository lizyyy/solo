import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import { useContractStore, useValidationStore } from './store';
import { ConfigProvider } from 'antd';

export default function App() {
  const { fetchData, contracts, rolloverApps, payments } = useContractStore();
  const { runValidation } = useValidationStore();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (contracts.length > 0 && rolloverApps.length > 0 && payments.length > 0) {
      runValidation(contracts, rolloverApps, payments);
    }
  }, [contracts, rolloverApps, payments, runValidation]);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1E40AF',
          colorSuccess: '#059669',
          colorWarning: '#D97706',
          colorError: '#DC2626',
          colorInfo: '#0284C7',
          borderRadius: 8,
          fontFamily: "'Noto Sans SC', system-ui, sans-serif",
        },
      }}
    >
      <MainLayout>
        <Outlet />
      </MainLayout>
    </ConfigProvider>
  );
}

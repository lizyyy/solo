import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import BondDetailSidebar from '@/components/BondDetailSidebar';
import Dashboard from '@/pages/Dashboard';
import RedemptionList from '@/pages/RedemptionList';
import CustomerReminder from '@/pages/CustomerReminder';
import DisposalCenter from '@/pages/DisposalCenter';
import DataTrace from '@/pages/DataTrace';
import { useAppStore } from '@/store';

const App: React.FC = () => {
  const { refreshAllData, isRefreshing } = useAppStore();

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/redemption-list" element={<Layout><RedemptionList /></Layout>} />
        <Route path="/customer-reminder" element={<Layout><CustomerReminder /></Layout>} />
        <Route path="/disposal-center" element={<Layout><DisposalCenter /></Layout>} />
        <Route path="/data-trace" element={<Layout><DataTrace /></Layout>} />
      </Routes>

      <BondDetailSidebar />

      {isRefreshing && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full" />
            <span className="text-sm text-slate-600">正在刷新数据...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

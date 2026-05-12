import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ViolationList from './components/ViolationList';
import ImportExport from './components/ImportExport';
import Management from './components/Management';
import { initMockData } from './store/storage';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('violations');

  useEffect(() => {
    initMockData();
  }, []);

  const handleTabChange = (tab: string) => {
    if (tab === 'import' || tab === 'batches') {
      setActiveTab('import');
    } else if (tab === 'drivers' || tab === 'vehicles' || tab === 'shifts') {
      setActiveTab('drivers');
    } else {
      setActiveTab(tab);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'violations':
        return <ViolationList />;
      case 'import':
        return <ImportExport />;
      case 'drivers':
        return <Management />;
      default:
        return <ViolationList />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Layout activeTab={activeTab} onTabChange={handleTabChange}>
        {renderContent()}
      </Layout>
    </div>
  );
};

export default App;

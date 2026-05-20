import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { RenewalBatch, DeviceGroupInfo, Device } from './types';
import { api } from './api';
import BatchList from './components/BatchList';
import BatchDetail from './components/BatchDetail';
import Sidebar from './components/Sidebar';
import CreateBatchModal from './components/CreateBatchModal';

const App: React.FC = () => {
  const [batches, setBatches] = useState<RenewalBatch[]>([]);
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroupInfo[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [expiryThreshold, setExpiryThreshold] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [batchesData, groupsData, devicesData] = await Promise.all([
      api.getBatches(),
      api.getDeviceGroups(),
      api.getDevices()
    ]);
    setBatches(batchesData);
    setDeviceGroups(groupsData);
    setDevices(devicesData);
  };

  const filterBatches = () => {
    let result = batches;

    if (selectedGroups.length > 0) {
      result = result.filter(b => b.deviceGroups.some(g => selectedGroups.includes(g)));
    }

    if (expiryThreshold !== null) {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + expiryThreshold);
      
      result = result.filter(batch => {
        const batchDeviceIds = batch.records.map(r => r.deviceId);
        const batchDevices = devices.filter(d => batchDeviceIds.includes(d.id));
        return batchDevices.some(d => new Date(d.currentCertExpiry) <= thresholdDate);
      });
    }

    return result;
  };

  const filteredBatches = filterBatches();

  const handleCreateBatch = async (data: any) => {
    await api.createBatch(data);
    await loadData();
    setShowCreateModal(false);
  };

  return (
    <div className="app">
      <Sidebar
        deviceGroups={deviceGroups}
        selectedGroups={selectedGroups}
        onGroupChange={setSelectedGroups}
        expiryThreshold={expiryThreshold}
        onExpiryThresholdChange={setExpiryThreshold}
      />
      <div className="main-content">
        <Routes>
          <Route path="/" element={
            <BatchList
              batches={filteredBatches}
              onCreateBatch={() => setShowCreateModal(true)}
              onRefresh={loadData}
              activeFilters={{
                groups: selectedGroups,
                expiryDays: expiryThreshold
              }}
            />
          } />
          <Route path="/batch/:id" element={
            <BatchDetail onBack={() => navigate('/')} onRefresh={loadData} />
          } />
        </Routes>
      </div>

      {showCreateModal && (
        <CreateBatchModal
          deviceGroups={deviceGroups}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateBatch}
        />
      )}
    </div>
  );
};

export default App;
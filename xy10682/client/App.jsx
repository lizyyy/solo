import React, { useState, useEffect, useCallback } from 'react';
import Statistics from './components/Statistics';
import SearchFilter from './components/SearchFilter';
import RecordTable from './components/RecordTable';
import ReviewModal from './components/ReviewModal';
import ExportSection from './components/ExportSection';

function App() {
  const [records, setRecords] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [responsiblePersons, setResponsiblePersons] = useState([]);
  const [filters, setFilters] = useState({
    meterNo: '',
    customerName: '',
    status: '',
    responsiblePerson: '',
    startDate: '',
    endDate: ''
  });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRecords = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    const response = await fetch(`/api/records?${params}`);
    const data = await response.json();
    setRecords(data);
  }, [filters]);

  const fetchStatistics = useCallback(async () => {
    const response = await fetch('/api/statistics');
    const data = await response.json();
    setStatistics(data);
  }, []);

  const fetchResponsiblePersons = useCallback(async () => {
    const response = await fetch('/api/responsible-persons');
    const data = await response.json();
    setResponsiblePersons(data);
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchStatistics();
    fetchResponsiblePersons();
  }, [fetchRecords, fetchStatistics, fetchResponsiblePersons]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    fetchRecords();
  };

  const handleReset = () => {
    setFilters({
      meterNo: '',
      customerName: '',
      status: '',
      responsiblePerson: '',
      startDate: '',
      endDate: ''
    });
  };

  const handleReview = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
  };

  const handleSaveReview = async (reviewData) => {
    const response = await fetch(`/api/records/${selectedRecord.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewData)
    });
    const updatedRecord = await response.json();
    setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
    fetchStatistics();
    handleCloseModal();
  };

  const handleUploadPhoto = async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    
    const response = await fetch(`/api/records/${selectedRecord.id}/photos`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    setSelectedRecord(data.record);
    setRecords(prev => prev.map(r => r.id === data.record.id ? data.record : r));
  };

  return (
    <div className="app">
      <div className="header">
        <h1>水务抄表复核计费系统</h1>
        <p>统一管理水表读数、异常阈值、估抄标记与阶梯水价</p>
      </div>

      <Statistics statistics={statistics} />
      
      <SearchFilter
        filters={filters}
        responsiblePersons={responsiblePersons}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      <ExportSection filters={filters} />

      <RecordTable
        records={records}
        onReview={handleReview}
      />

      {isModalOpen && selectedRecord && (
        <ReviewModal
          record={selectedRecord}
          onClose={handleCloseModal}
          onSave={handleSaveReview}
          onUploadPhoto={handleUploadPhoto}
        />
      )}
    </div>
  );
}

export default App;

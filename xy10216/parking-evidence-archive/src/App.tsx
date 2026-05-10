import { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import CaseList from './components/CaseList';
import CaseDetail from './components/CaseDetail';
import CaseForm from './components/CaseForm';
import type { ParkingCase } from './types';
import './App.css';

function AppContent() {
  const { cases, selectedCase, setSelectedCase, addCase, updateCase } = useAppContext();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const handleAddCase = (data: Omit<ParkingCase, 'id' | 'createdAt' | 'updatedAt'>) => {
    addCase(data);
    setShowAddForm(false);
  };

  const handleEditCase = (data: Omit<ParkingCase, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (selectedCase) {
      updateCase(selectedCase.id, data);
    }
    setShowEditForm(false);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <CaseList
        cases={cases}
        selectedCase={selectedCase}
        onSelectCase={setSelectedCase}
        onAddCase={() => setShowAddForm(true)}
      />
      
      <div className="flex-1 flex flex-col">
        {selectedCase ? (
          <CaseDetail
            caseData={selectedCase}
            onEdit={() => setShowEditForm(true)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-6xl mb-4">🚗</div>
              <h2 className="text-xl font-medium mb-2">请选择案件</h2>
              <p className="text-sm">从左侧列表选择案件查看详情，或点击"新增案件"创建新记录</p>
            </div>
          </div>
        )}
      </div>

      {showAddForm && (
        <CaseForm
          onSubmit={handleAddCase}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {showEditForm && selectedCase && (
        <CaseForm
          initialData={selectedCase}
          onSubmit={handleEditCase}
          onCancel={() => setShowEditForm(false)}
          isEdit={true}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;

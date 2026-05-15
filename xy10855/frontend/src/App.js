import React, { useState } from 'react';
import TaskList from './components/TaskList';
import TaskDetail from './components/TaskDetail';
import CreateTask from './components/CreateTask';
import BatchImport from './components/BatchImport';

function App() {
  const [view, setView] = useState('list');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBatch, setShowBatch] = useState(false);

  const handleViewDetail = (taskId) => {
    setSelectedTaskId(taskId);
    setView('detail');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedTaskId(null);
  };

  const handleCreateSuccess = () => {
    setShowCreate(false);
  };

  const handleBatchSuccess = () => {
    setShowBatch(false);
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>📊 报表生成任务系统</h1>
          <p style={styles.subtitle}>Report Generator Task API</p>
        </div>
        <div style={styles.headerActions}>
          {view === 'list' && (
            <>
              <button style={styles.headerButton} onClick={() => setShowBatch(true)}>
                📥 批量导入
              </button>
              <button style={{...styles.headerButton, ...styles.primaryButton}} onClick={() => setShowCreate(true)}>
                ➕ 新建任务
              </button>
            </>
          )}
        </div>
      </header>

      <main style={styles.main}>
        {view === 'list' ? (
          <TaskList onViewDetail={handleViewDetail} />
        ) : (
          <TaskDetail taskId={selectedTaskId} onBack={handleBackToList} />
        )}
      </main>

      {showCreate && (
        <CreateTask
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {showBatch && (
        <BatchImport
          onSuccess={handleBatchSuccess}
          onCancel={() => setShowBatch(false)}
        />
      )}

      <footer style={styles.footer}>
        <p>报表生成任务 API - 基于 Node.js + Express + SQLite 构建</p>
      </footer>
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    backgroundColor: 'white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerContent: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '16px'
  },
  title: {
    margin: 0,
    fontSize: '24px',
    color: '#333'
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#999'
  },
  headerActions: {
    display: 'flex',
    gap: '12px'
  },
  headerButton: {
    padding: '10px 20px',
    border: '1px solid #d9d9d9',
    backgroundColor: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  primaryButton: {
    backgroundColor: '#1890ff',
    borderColor: '#1890ff',
    color: 'white'
  },
  main: {
    flex: 1
  },
  footer: {
    backgroundColor: 'white',
    padding: '16px',
    textAlign: 'center',
    borderTop: '1px solid #f0f0f0',
    fontSize: '12px',
    color: '#999'
  }
};

export default App;

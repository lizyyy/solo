import { useState } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { Dashboard } from './pages/Dashboard';
import { Tasks } from './pages/Tasks';
import { DeadLetters } from './pages/DeadLetters';

function AppContent() {
  const navigate = useNavigate();
  const [selectedDeadLetterTaskId, setSelectedDeadLetterTaskId] = useState(null);

  const handleViewDeadLetter = (taskId) => {
    setSelectedDeadLetterTaskId(taskId);
    navigate('/dead-letters');
  };

  return (
    <div>
      <header className="header">
        <div className="header-content">
          <h1>🔧 异步任务死信补偿台</h1>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
              仪表盘
            </NavLink>
            <NavLink to="/tasks" className={({ isActive }) => isActive ? 'active' : ''}>
              任务列表
            </NavLink>
            <NavLink to="/dead-letters" className={({ isActive }) => isActive ? 'active' : ''}>
              死信队列
            </NavLink>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route 
          path="/tasks" 
          element={<Tasks onViewDeadLetter={handleViewDeadLetter} />} 
        />
        <Route 
          path="/dead-letters" 
          element={
            <DeadLetters 
              selectedDeadLetterId={selectedDeadLetterTaskId}
              onBack={() => setSelectedDeadLetterTaskId(null)}
            />
          } 
        />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;

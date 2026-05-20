import { Routes, Route } from 'react-router-dom';
import UserList from './pages/UserList';
import UserDetail from './pages/UserDetail';

function App() {
  return (
    <div>
      <header className="header">
        <div className="container" style={{ marginBottom: 0, padding: '0 24px' }}>
          <h1>📱 订阅权益同步管理系统</h1>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<UserList />} />
          <Route path="/user/:userId" element={<UserDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

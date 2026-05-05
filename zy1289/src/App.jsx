import { NotificationProvider } from './contexts/NotificationContext';
import NotificationPage from './pages/NotificationPage';
import './App.css';

function App() {
  return (
    <NotificationProvider>
      <NotificationPage />
    </NotificationProvider>
  );
}

export default App;

import { AppProvider } from './context/AppContext';
import AppLayout from './components/AppLayout';
import './styles/index.css';

function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}

export default App;

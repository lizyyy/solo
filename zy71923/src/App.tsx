import { AppProvider, useApp } from './context/AppContext';
import Header from './components/layout/Header';
import TabContainer from './components/layout/TabContainer';
import TimelineView from './components/timeline/TimelineView';
import ScheduleView from './components/schedule/ScheduleView';
import ExhibitionView from './components/exhibition/ExhibitionView';

function AppContent() {
  const { activeTab } = useApp();

  return (
    <div className="min-h-screen bg-ivory">
      <Header />
      <TabContainer>
        {activeTab === 'timeline' && <TimelineView />}
        {activeTab === 'schedule' && <ScheduleView />}
        {activeTab === 'exhibition' && <ExhibitionView />}
      </TabContainer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

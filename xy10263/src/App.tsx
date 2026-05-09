import { Header } from './components/Header';
import { PlayerPanel } from './components/PlayerPanel';
import { CluePanel } from './components/CluePanel';
import { TimelinePanel } from './components/TimelinePanel';
import { IssuesPanel } from './components/IssuesPanel';
import { StatisticsPanel } from './components/StatisticsPanel';

function App() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      
      <main className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <PlayerPanel />
            <StatisticsPanel />
          </div>
          
          <div className="lg:col-span-5 space-y-6">
            <CluePanel />
          </div>
          
          <div className="lg:col-span-4 space-y-6">
            <TimelinePanel />
            <IssuesPanel />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

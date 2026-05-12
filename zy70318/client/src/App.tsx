import { useEffect, useState } from 'react';
import { useAppStore } from './store';
import TopologyPage from './pages/TopologyPage';
import RulesPage from './pages/RulesPage';
import DrillsPage from './pages/DrillsPage';
import ResultsPage from './pages/ResultsPage';

const PAGES = [
  { id: 'topology', label: '服务拓扑' },
  { id: 'rules', label: '降级规则' },
  { id: 'drills', label: '演练控制' },
  { id: 'results', label: '演练结果' },
];

export default function App() {
  const [page, setPage] = useState('topology');
  const fetchAll = useAppStore((s) => s.fetchAll);
  const currentDrill = useAppStore((s) => s.currentDrill);

  useEffect(() => {
    fetchAll();
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>服务降级演练台</h1>
        <span className="tag">Circuit Breaker Simulator</span>
        {currentDrill && currentDrill.status === 'running' && (
          <span className="badge badge-running">演练进行中</span>
        )}
      </header>

      <nav className="nav">
        {PAGES.map((p) => (
          <button
            key={p.id}
            className={page === p.id ? 'active' : ''}
            onClick={() => setPage(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {page === 'topology' && <TopologyPage />}
        {page === 'rules' && <RulesPage />}
        {page === 'drills' && <DrillsPage />}
        {page === 'results' && <ResultsPage />}
      </main>
    </div>
  );
}

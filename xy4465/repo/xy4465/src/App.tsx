import { useState } from 'react';
import Header from './components/Header/Header';
import DataImport from './components/DataImport/DataImport';
import RouteList from './components/RouteList/RouteList';
import RouteDetail from './components/RouteDetail/RouteDetail';
import { useAppContext } from './context/AppContext';
import './App.css';

function App() {
  const { state } = useAppContext();
  const [activeView, setActiveView] = useState<'dashboard' | 'import'>('dashboard');

  const hasData = state.data.routes.length > 0;

  return (
    <div className="app">
      <Header />
      
      <nav className="app__nav">
        <button
          className={`app__nav-btn ${activeView === 'dashboard' ? 'app__nav-btn--active' : ''}`}
          onClick={() => setActiveView('dashboard')}
        >
          📊 线路看板
        </button>
        <button
          className={`app__nav-btn ${activeView === 'import' ? 'app__nav-btn--active' : ''}`}
          onClick={() => setActiveView('import')}
        >
          📁 数据导入
        </button>
      </nav>

      <main className="app__main">
        {activeView === 'import' ? (
          <div className="app__import-container">
            <DataImport />
          </div>
        ) : (
          <>
            {!hasData ? (
              <div className="app__welcome">
                <div className="app__welcome-icon">🧗</div>
                <h2>欢迎使用攀岩馆线路复盘看板</h2>
                <p>
                  这是一个帮助您分析和复盘攀岩馆线路数据的工具。
                  您可以导入线路表、会员刷卡客流、完攀记录和伤情/投诉备注，
                  系统会自动计算每条线路的热门时段、完攀率、拥堵风险和异常提醒。
                </p>
                <div className="app__welcome-features">
                  <div className="app__welcome-feature">
                    <div className="app__welcome-feature-icon">📊</div>
                    <h4>数据分析</h4>
                    <p>自动计算完攀率、热门时段、拥堵风险</p>
                  </div>
                  <div className="app__welcome-feature">
                    <div className="app__welcome-feature-icon">📝</div>
                    <h4>教练备注</h4>
                    <p>添加人工观察、建议和难度改判</p>
                  </div>
                  <div className="app__welcome-feature">
                    <div className="app__welcome-feature-icon">📋</div>
                    <h4>复盘报告</h4>
                    <p>导出 Markdown 报告和 JSON 明细</p>
                  </div>
                  <div className="app__welcome-feature">
                    <div className="app__welcome-feature-icon">💾</div>
                    <h4>数据持久化</h4>
                    <p>所有数据自动保存到本地，刷新不丢失</p>
                  </div>
                </div>
                <button
                  className="app__welcome-btn"
                  onClick={() => setActiveView('import')}
                >
                  开始导入数据
                </button>
              </div>
            ) : (
              <div className="app__dashboard">
                <div className="app__route-list-container">
                  <RouteList />
                </div>
                {state.selectedRouteId && (
                  <div className="app__route-detail-container">
                    <RouteDetail />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="app__footer">
        <p>攀岩馆线路复盘看板 · 数据保存在本地浏览器中</p>
      </footer>
    </div>
  );
}

export default App;

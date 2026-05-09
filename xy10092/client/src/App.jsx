import React, { useState } from 'react';
import RepairList from './pages/RepairList.jsx';
import MaterialList from './pages/MaterialList.jsx';
import Reports from './pages/Reports.jsx';

function App() {
  const [activePage, setActivePage] = useState('repairs');

  const pages = [
    { id: 'repairs', name: '维修核销' },
    { id: 'materials', name: '材料管理' },
    { id: 'reports', name: '统计报告' }
  ];

  return (
    <div>
      <div className="header">
        <div className="container">
          <h1>校园维修材料核销台</h1>
          <p>宿舍维修材料领用、退料与学生确认一体化管理系统</p>
        </div>
      </div>
      
      <div className="container">
        <div className="nav">
          {pages.map(page => (
            <button
              key={page.id}
              className={activePage === page.id ? 'active' : ''}
              onClick={() => setActivePage(page.id)}
            >
              {page.name}
            </button>
          ))}
        </div>

        {activePage === 'repairs' && <RepairList />}
        {activePage === 'materials' && <MaterialList />}
        {activePage === 'reports' && <Reports />}
      </div>
    </div>
  );
}

export default App;
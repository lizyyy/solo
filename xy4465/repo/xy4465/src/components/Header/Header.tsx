import React from 'react';
import { useAppContext } from '../../context/AppContext';
import './Header.css';

const Header: React.FC = () => {
  const { state, exportMarkdownReport, exportJSON, resetAllData } = useAppContext();
  const unacknowledgedAlerts = state.data.alerts.filter((a: { acknowledged: boolean }) => !a.acknowledged).length;

  const handleExportMarkdown = () => {
    exportMarkdownReport();
  };

  const handleExportJSON = () => {
    exportJSON();
  };

  const handleReset = () => {
    if (window.confirm('确定要重置所有数据吗？此操作不可撤销。')) {
      resetAllData();
    }
  };

  return (
    <header className="header">
      <div className="header__logo">
        <h1>攀岩馆线路复盘看板</h1>
        <span className="header__subtitle">Climbing Route Dashboard</span>
      </div>
      
      <div className="header__actions">
        <button 
          className="header__badge"
          title="未处理的异常提醒"
        >
          异常提醒: {unacknowledgedAlerts}
        </button>
        
        <div className="header__export-group">
          <button 
            className="header__btn header__btn--primary"
            onClick={handleExportMarkdown}
            title="导出 Markdown 复盘报告"
          >
            导出复盘报告
          </button>
          <button 
            className="header__btn"
            onClick={handleExportJSON}
            title="导出 JSON 明细"
          >
            导出 JSON
          </button>
        </div>
        
        <button 
          className="header__btn header__btn--danger"
          onClick={handleReset}
          title="重置所有数据"
        >
          重置数据
        </button>
      </div>
    </header>
  );
};

export default Header;

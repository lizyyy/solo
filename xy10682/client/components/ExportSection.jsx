import React, { useState } from 'react';

function ExportSection({ filters }) {
  const [exportFilters, setExportFilters] = useState({
    responsiblePerson: '',
    startDate: '',
    endDate: ''
  });

  const handleExport = () => {
    const params = new URLSearchParams();
    Object.entries(exportFilters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    
    window.open(`http://localhost:5000/api/export?${params}`, '_blank');
  };

  return (
    <div className="export-section">
      <div className="filter-group">
        <label>按责任人导出</label>
        <input
          type="text"
          placeholder="输入责任人姓名"
          value={exportFilters.responsiblePerson}
          onChange={(e) => setExportFilters(prev => ({ ...prev, responsiblePerson: e.target.value }))}
        />
      </div>
      <div className="filter-group">
        <label>开始日期</label>
        <input
          type="date"
          value={exportFilters.startDate}
          onChange={(e) => setExportFilters(prev => ({ ...prev, startDate: e.target.value }))}
        />
      </div>
      <div className="filter-group">
        <label>结束日期</label>
        <input
          type="date"
          value={exportFilters.endDate}
          onChange={(e) => setExportFilters(prev => ({ ...prev, endDate: e.target.value }))}
        />
      </div>
      <button className="btn btn-success" onClick={handleExport}>
        导出Excel报告
      </button>
    </div>
  );
}

export default ExportSection;

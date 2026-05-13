import React from 'react';

function SearchFilter({ filters, responsiblePersons, onFilterChange, onSearch, onReset }) {
  return (
    <div className="search-filter">
      <div className="filter-group">
        <label>水表编号</label>
        <input
          type="text"
          placeholder="输入水表编号"
          value={filters.meterNo}
          onChange={(e) => onFilterChange('meterNo', e.target.value)}
        />
      </div>
      <div className="filter-group">
        <label>客户名称</label>
        <input
          type="text"
          placeholder="输入客户名称"
          value={filters.customerName}
          onChange={(e) => onFilterChange('customerName', e.target.value)}
        />
      </div>
      <div className="filter-group">
        <label>状态</label>
        <select
          value={filters.status}
          onChange={(e) => onFilterChange('status', e.target.value)}
        >
          <option value="">全部</option>
          <option value="pending">待复核</option>
          <option value="verified">已复核</option>
        </select>
      </div>
      <div className="filter-group">
        <label>责任人</label>
        <select
          value={filters.responsiblePerson}
          onChange={(e) => onFilterChange('responsiblePerson', e.target.value)}
        >
          <option value="">全部</option>
          {responsiblePersons.map(person => (
            <option key={person} value={person}>{person}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label>开始日期</label>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => onFilterChange('startDate', e.target.value)}
        />
      </div>
      <div className="filter-group">
        <label>结束日期</label>
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => onFilterChange('endDate', e.target.value)}
        />
      </div>
      <button className="btn btn-primary" onClick={onSearch}>
        搜索
      </button>
      <button className="btn btn-secondary" onClick={onReset}>
        重置
      </button>
    </div>
  );
}

export default SearchFilter;

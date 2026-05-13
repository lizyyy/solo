import React from 'react';

function Statistics({ statistics }) {
  return (
    <div className="statistics">
      <div className="stat-card">
        <div className="label">总记录数</div>
        <div className="value">{statistics.total || 0}</div>
      </div>
      <div className="stat-card pending">
        <div className="label">待复核</div>
        <div className="value">{statistics.pending || 0}</div>
      </div>
      <div className="stat-card verified">
        <div className="label">已复核</div>
        <div className="value">{statistics.verified || 0}</div>
      </div>
      <div className="stat-card abnormal">
        <div className="label">异常记录</div>
        <div className="value">{statistics.abnormal || 0}</div>
      </div>
      <div className="stat-card">
        <div className="label">收费差异总计</div>
        <div className="value">¥{(statistics.totalFeeDifference || 0).toFixed(2)}</div>
      </div>
    </div>
  );
}

export default Statistics;

import React from 'react';

function RecordTable({ records, onReview }) {
  return (
    <div className="record-table">
      <div className="table-header">
        <h2>复核记录列表</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>水表编号</th>
            <th>客户名称</th>
            <th>抄表日期</th>
            <th>当前读数</th>
            <th>用水量</th>
            <th>估抄</th>
            <th>异常状态</th>
            <th>异常阈值</th>
            <th>收费差异</th>
            <th>状态</th>
            <th>责任人</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map(record => (
            <tr key={record.id}>
              <td><strong>{record.meterNo}</strong></td>
              <td>{record.customerName}</td>
              <td>{record.readingDate}</td>
              <td>{record.currentReading}</td>
              <td>{record.usage}</td>
              <td>
                <span className={record.estimateFlag ? 'badge-abnormal badge' : 'badge-normal badge'}>
                  {record.estimateFlag ? '是' : '否'}
                </span>
              </td>
              <td>
                <span className={record.isAbnormal ? 'badge-abnormal badge' : 'badge-normal badge'}>
                  {record.isAbnormal ? '异常' : '正常'}
                </span>
              </td>
              <td>{record.abnormalThreshold}</td>
              <td style={{ color: record.feeDifference > 0 ? '#dc2626' : '#059669', fontWeight: 500 }}>
                ¥{record.feeDifference.toFixed(2)}
              </td>
              <td>
                <span className={`badge badge-${record.status}`}>
                  {record.status === 'pending' ? '待复核' : '已复核'}
                </span>
              </td>
              <td>{record.responsiblePerson}</td>
              <td>
                <button 
                  className="btn btn-sm btn-primary"
                  onClick={() => onReview(record)}
                >
                  复核
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RecordTable;

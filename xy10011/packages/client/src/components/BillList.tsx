import { Bill } from '../types';

interface Props {
  bills: Bill[];
  onEdit: (bill: Bill) => void;
  onDelete: (bill: Bill) => void;
}

export function BillList({ bills, onEdit, onDelete }: Props) {
  if (bills.length === 0) {
    return (
      <div className="empty-state">
        <p>暂无账单</p>
        <p className="hint">点击上方按钮添加第一个账单</p>
      </div>
    );
  }

  const total = bills.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="bill-list">
      <div className="bill-summary">
        <strong>总计:</strong> {total.toFixed(2)} 元
        <span className="count">({bills.length} 条记录)</span>
      </div>
      
      <div className="bills-container">
        {bills.map((bill) => (
          <div key={bill.id} className="bill-card">
            <div className="bill-header">
              <h4>{bill.title}</h4>
              <div className="bill-amount">{bill.amount.toFixed(2)} {bill.currency}</div>
            </div>
            
            {bill.description && (
              <p className="bill-description">{bill.description}</p>
            )}
            
            <div className="bill-participants">
              <strong>参与者:</strong>
              <ul>
                {bill.participants.map((p, i) => (
                  <li key={i}>
                    {p.userId.slice(-6)}: 付 {p.paid.toFixed(2)} / 分摊 {(p.adjustedShare ?? p.share).toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bill-meta">
              <span>版本: {bill.version}</span>
              <span>创建时间: {new Date(bill.createdAt).toLocaleString()}</span>
            </div>
            
            <div className="bill-actions">
              <button onClick={() => onEdit(bill)}>编辑</button>
              <button className="danger" onClick={() => onDelete(bill)}>删除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

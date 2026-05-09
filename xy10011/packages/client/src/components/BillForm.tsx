import { useState } from 'react';
import { Bill, Group, Participant } from '../types';

interface Props {
  bill: Bill | null;
  group: Group;
  userId: string;
  onSave: (data: any) => void;
  onCancel: () => void;
}

export function BillForm({ bill, group, userId, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(bill?.title || '');
  const [description, setDescription] = useState(bill?.description || '');
  const [amount, setAmount] = useState(bill?.amount || 0);
  const [participants, setParticipants] = useState<Participant[]>(
    bill?.participants || [{ userId, share: 0, paid: 0 }]
  );

  function addParticipant() {
    setParticipants([...participants, { userId: `user-${Date.now()}`, share: 0, paid: 0 }]);
  }

  function updateParticipant(index: number, field: keyof Participant, value: number) {
    const updated = [...participants];
    updated[index] = { ...updated[index], [field]: value };
    setParticipants(updated);
  }

  function removeParticipant(index: number) {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== index));
    }
  }

  function splitEvenly() {
    const sharePerPerson = amount / participants.length;
    setParticipants(participants.map((p) => ({
      ...p,
      share: sharePerPerson,
    })));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const totalShare = participants.reduce((sum, p) => sum + (p.adjustedShare ?? p.share), 0);
    const totalPaid = participants.reduce((sum, p) => sum + p.paid, 0);
    
    if (Math.abs(totalShare - amount) > 0.01) {
      alert(`总分摊金额 (${totalShare.toFixed(2)}) 不等于账单金额 (${amount.toFixed(2)})`);
      return;
    }
    
    if (Math.abs(totalPaid - amount) > 0.01) {
      alert(`总支付金额 (${totalPaid.toFixed(2)}) 不等于账单金额 (${amount.toFixed(2)})`);
      return;
    }

    onSave({
      title,
      description: description || undefined,
      amount,
      participants,
    });
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{bill ? '编辑账单' : '新建账单'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>标题 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="例如：聚餐费用"
            />
          </div>

          <div className="form-group">
            <label>描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选描述"
            />
          </div>

          <div className="form-group">
            <label>总金额 (元) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="form-group">
            <div className="participants-header">
              <label>参与者</label>
              <div className="participants-actions">
                <button type="button" onClick={splitEvenly}>平均分摊</button>
                <button type="button" onClick={addParticipant}>+ 添加</button>
              </div>
            </div>
            
            <div className="participants-list">
              {participants.map((p, index) => (
                <div key={index} className="participant-row">
                  <input
                    type="text"
                    value={p.userId}
                    onChange={(e) => {
                      const updated = [...participants];
                      updated[index] = { ...updated[index], userId: e.target.value };
                      setParticipants(updated);
                    }}
                    placeholder="用户标识"
                  />
                  <div className="participant-amounts">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.paid}
                      onChange={(e) => updateParticipant(index, 'paid', parseFloat(e.target.value) || 0)}
                      placeholder="支付"
                    />
                    <span>付</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.share}
                      onChange={(e) => updateParticipant(index, 'share', parseFloat(e.target.value) || 0)}
                      placeholder="分摊"
                    />
                    <span>分摊</span>
                  </div>
                  {participants.length > 1 && (
                    <button type="button" onClick={() => removeParticipant(index)} className="danger">
                      ×
                    </button>
                  )}
                </div>
                  ))}
            </div>
          </div>

          <div className="form-totals">
            <span>总支付: {participants.reduce((s, p) => s + p.paid, 0).toFixed(2)}</span>
            <span>总分摊: {participants.reduce((s, p) => s + p.share, 0).toFixed(2)}</span>
            <span>账单金额: {amount.toFixed(2)}</span>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel}>取消</button>
            <button type="submit" className="primary">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Modal } from './Modal';
import { today } from '../utils';

interface Props {
  recordId: number;
  onSubmit: (data: any) => void;
  onClose: () => void;
}

export function QCCheckForm({ onSubmit, onClose }: Props) {
  const [form, setForm] = useState({
    inspector: '',
    check_date: today(),
    check_result: '',
    defect_items: '',
    final_conclusion: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.check_result) {
      alert('请选择质检结果');
      return;
    }
    onSubmit(form);
  };

  return (
    <Modal
      title="质量检验"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit}>提交</button>
        </>
      }
      width="550px"
    >
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>检验员</label>
            <input
              className="form-control"
              value={form.inspector}
              onChange={e => setForm({ ...form, inspector: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>检验日期</label>
            <input
              type="date"
              className="form-control"
              value={form.check_date}
              onChange={e => setForm({ ...form, check_date: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label>质检结果 *</label>
          <select
            className="form-control"
            value={form.check_result}
            onChange={e => setForm({ ...form, check_result: e.target.value })}
          >
            <option value="">请选择</option>
            <option value="pass">✅ 合格 - 工单闭环</option>
            <option value="rework_required">🔄 需返工 - 再次回炉</option>
          </select>
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label>不良明细（如不合格）</label>
          <textarea
            className="form-control"
            value={form.defect_items}
            onChange={e => setForm({ ...form, defect_items: e.target.value })}
            placeholder="具体哪些项不合格"
            rows={2}
          />
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label>最终结论</label>
          <textarea
            className="form-control"
            value={form.final_conclusion}
            onChange={e => setForm({ ...form, final_conclusion: e.target.value })}
            placeholder="质检结论和后续处理建议"
            rows={2}
          />
        </div>
        {form.check_result === 'pass' && (
          <div className="alert alert-success" style={{ marginTop: 12 }}>
            提交后工单状态将自动变更为「已闭环」
          </div>
        )}
        {form.check_result === 'rework_required' && (
          <div className="alert alert-warning" style={{ marginTop: 12 }}>
            提交后工单状态将变为「返工中」，需要新增下一次返工记录
          </div>
        )}
      </form>
    </Modal>
  );
}

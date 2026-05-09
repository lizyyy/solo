import { useState } from 'react';
import { Modal } from './Modal';

interface Props {
  initialData?: any;
  onSubmit: (data: any) => void;
  onClose: () => void;
}

export function OrderFormModal({ initialData = {}, onSubmit, onClose }: Props) {
  const [form, setForm] = useState({
    order_no: initialData.order_no || '',
    product_name: '',
    batch_no: '',
    qty: '',
    defect_qty: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.order_no || !form.product_name) {
      alert('返工单号和产品名称必填');
      return;
    }
    onSubmit({
      ...form,
      qty: parseInt(form.qty, 10) || 0,
      defect_qty: parseInt(form.defect_qty, 10) || 0
    });
  };

  return (
    <Modal
      title="新建返工单"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit}>创建</button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>返工单号 *</label>
            <input
              className="form-control"
              value={form.order_no}
              onChange={e => setForm({ ...form, order_no: e.target.value })}
              placeholder="如: RW-2024-0001"
            />
          </div>
          <div className="form-group">
            <label>产品名称 *</label>
            <input
              className="form-control"
              value={form.product_name}
              onChange={e => setForm({ ...form, product_name: e.target.value })}
              placeholder="请输入产品名称"
            />
          </div>
          <div className="form-group">
            <label>批次号</label>
            <input
              className="form-control"
              value={form.batch_no}
              onChange={e => setForm({ ...form, batch_no: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>批量</label>
            <input
              type="number"
              className="form-control"
              value={form.qty}
              onChange={e => setForm({ ...form, qty: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>不良数</label>
            <input
              type="number"
              className="form-control"
              value={form.defect_qty}
              onChange={e => setForm({ ...form, defect_qty: e.target.value })}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

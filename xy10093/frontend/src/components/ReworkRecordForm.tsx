import { useState } from 'react';
import { Modal } from './Modal';
import { today } from '../utils';

interface Props {
  reworkCount: number;
  onSubmit: (data: any) => void;
  onClose: () => void;
}

const CAUSE_CATEGORIES = ['人员操作', '工艺参数', '设备工装', '原材料', '设计问题', '环境', '其他'];
const PROCESSES = ['冲压工序', '焊接工序', '组装工序', '注塑工序', '机加工序', '喷涂工序', '质检工序', '包装工序', '其他'];

export function ReworkRecordForm({ reworkCount, onSubmit, onClose }: Props) {
  const [form, setForm] = useState({
    defect_description: '',
    root_cause: '',
    cause_category: '',
    responsible_process: '',
    responsible_person: '',
    correction_action: '',
    correction_date: today()
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.defect_description) {
      alert('请填写不良描述');
      return;
    }
    onSubmit(form);
  };

  return (
    <Modal
      title={`第 ${reworkCount} 次返工记录`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit}>保存</button>
        </>
      }
      width="700px"
    >
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-title">不良与原因分析</div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>不良描述 *</label>
            <textarea
              className="form-control"
              value={form.defect_description}
              onChange={e => setForm({ ...form, defect_description: e.target.value })}
              placeholder="详细描述不良现象、位置、数量等"
              rows={3}
            />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>原因类别</label>
              <select
                className="form-control"
                value={form.cause_category}
                onChange={e => setForm({ ...form, cause_category: e.target.value })}
              >
                <option value="">请选择</option>
                {CAUSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>责任工序</label>
              <select
                className="form-control"
                value={form.responsible_process}
                onChange={e => setForm({ ...form, responsible_process: e.target.value })}
              >
                <option value="">请选择</option>
                {PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 12, marginBottom: 12 }}>
            <label>根本原因分析</label>
            <textarea
              className="form-control"
              value={form.root_cause}
              onChange={e => setForm({ ...form, root_cause: e.target.value })}
              placeholder="使用 5Why 等方法分析根本原因"
              rows={2}
            />
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">纠正措施</div>
          <div className="form-grid">
            <div className="form-group">
              <label>责任人</label>
              <input
                className="form-control"
                value={form.responsible_person}
                onChange={e => setForm({ ...form, responsible_person: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>纠正日期</label>
              <input
                type="date"
                className="form-control"
                value={form.correction_date}
                onChange={e => setForm({ ...form, correction_date: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label>纠正/预防措施</label>
            <textarea
              className="form-control"
              value={form.correction_action}
              onChange={e => setForm({ ...form, correction_action: e.target.value })}
              placeholder="描述具体的纠正措施和预防措施"
              rows={3}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

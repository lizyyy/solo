import React, { useState, useEffect } from 'react';

function CreateRepairModal({ onClose, onSuccess, onToast }) {
  const [formData, setFormData] = useState({
    studentName: '',
    studentPhone: '',
    dormBuilding: '',
    dormNumber: '',
    repairType: '水暖维修',
    description: '',
    repairDate: new Date().toISOString().split('T')[0],
    workerName: '',
    items: []
  });

  const [materials, setMaterials] = useState([]);
  const [newItem, setNewItem] = useState({
    materialId: '',
    type: 'claim',
    quantity: 1
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const response = await fetch('/api/materials');
      if (response.ok) {
        const data = await response.json();
        setMaterials(data);
      }
    } catch (error) {
      onToast('获取材料列表失败', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/repairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        onToast(error.error || '创建失败', 'error');
      }
    } catch (error) {
      onToast('创建失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    if (!newItem.materialId || !newItem.quantity) {
      onToast('请选择材料并填写数量', 'warning');
      return;
    }

    const material = materials.find(m => m.id === newItem.materialId);
    if (!material) return;

    const existingItem = formData.items.find(
      i => i.materialId === newItem.materialId && i.type === newItem.type
    );

    if (existingItem) {
      setFormData({
        ...formData,
        items: formData.items.map(i =>
          i.materialId === newItem.materialId && i.type === newItem.type
            ? { ...i, quantity: i.quantity + parseFloat(newItem.quantity) }
            : i
        )
      });
    } else {
      setFormData({
        ...formData,
        items: [
          ...formData.items,
          {
            ...newItem,
            quantity: parseFloat(newItem.quantity),
            unitPrice: material.unitPrice,
            materialName: material.name
          }
        ]
      });
    }

    setNewItem({ materialId: '', type: 'claim', quantity: 1 });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>新建维修单</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <h4 className="section-title">基本信息</h4>
            <div className="form-row">
              <div className="form-group">
                <label>学生姓名 *</label>
                <input
                  type="text"
                  required
                  value={formData.studentName}
                  onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>学生电话 *</label>
                <input
                  type="tel"
                  required
                  value={formData.studentPhone}
                  onChange={e => setFormData({ ...formData, studentPhone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>宿舍楼 *</label>
                <input
                  type="text"
                  required
                  placeholder="如：1号楼"
                  value={formData.dormBuilding}
                  onChange={e => setFormData({ ...formData, dormBuilding: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>宿舍号 *</label>
                <input
                  type="text"
                  required
                  placeholder="如：301"
                  value={formData.dormNumber}
                  onChange={e => setFormData({ ...formData, dormNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>维修类型</label>
                <select
                  value={formData.repairType}
                  onChange={e => setFormData({ ...formData, repairType: e.target.value })}
                >
                  <option value="水暖维修">水暖维修</option>
                  <option value="电器维修">电器维修</option>
                  <option value="五金维修">五金维修</option>
                  <option value="门窗维修">门窗维修</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div className="form-group">
                <label>维修日期</label>
                <input
                  type="date"
                  value={formData.repairDate}
                  onChange={e => setFormData({ ...formData, repairDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>维修人员</label>
                <input
                  type="text"
                  value={formData.workerName}
                  onChange={e => setFormData({ ...formData, workerName: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>问题描述</label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="divider" />

            <h4 className="section-title">材料明细</h4>
            
            {formData.items.length > 0 && (
              <div className="table-container" style={{ marginBottom: 20 }}>
                <table>
                  <thead>
                    <tr>
                      <th>类型</th>
                      <th>材料名称</th>
                      <th>数量</th>
                      <th>单价</th>
                      <th>金额</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <span className={`tag ${item.type === 'claim' ? 'tag-claim' : 'tag-return'}`}>
                            {item.type === 'claim' ? '领用' : '退回'}
                          </span>
                        </td>
                        <td>
                          {materials.find(m => m.id === item.materialId)?.name || item.materialName}
                        </td>
                        <td>{item.quantity}</td>
                        <td>¥{item.unitPrice}</td>
                        <td>¥{(item.quantity * item.unitPrice).toFixed(2)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => removeItem(index)}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ background: '#f5f7fa', padding: 20, borderRadius: 8 }}>
              <h5 style={{ marginBottom: 12, color: '#666' }}>添加材料</h5>
              <div className="form-row">
                <div className="form-group">
                  <label>类型</label>
                  <select
                    value={newItem.type}
                    onChange={e => setNewItem({ ...newItem, type: e.target.value })}
                  >
                    <option value="claim">领用</option>
                    <option value="return">退回</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>材料</label>
                  <select
                    value={newItem.materialId}
                    onChange={e => setNewItem({ ...newItem, materialId: e.target.value })}
                  >
                    <option value="">请选择材料</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.specification}) - ¥{m.unitPrice}/{m.unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>数量</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={newItem.quantity}
                    onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={addItem}
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '创建中...' : '创建维修单'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateRepairModal;
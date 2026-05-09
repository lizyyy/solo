import React, { useState, useEffect, useCallback } from 'react';
import Toast from '../components/Toast.jsx';

function MaterialList() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState({
    category: 'all',
    keyword: ''
  });

  const [formData, setFormData] = useState({
    name: '',
    category: '水暖',
    specification: '',
    unit: '个',
    unitPrice: '',
    stock: '',
    description: ''
  });

  const [isDragging, setIsDragging] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all' && value !== '') {
          params.append(key, value);
        }
      });
      
      const response = await fetch(`/api/materials?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMaterials(data);
      }
    } catch (error) {
      showToast('获取材料列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          unitPrice: parseFloat(formData.unitPrice) || 0,
          stock: parseFloat(formData.stock) || 0
        })
      });

      if (response.ok) {
        showToast('创建成功', 'success');
        setShowCreateModal(false);
        setFormData({
          name: '',
          category: '水暖',
          specification: '',
          unit: '个',
          unitPrice: '',
          stock: '',
          description: ''
        });
        fetchMaterials();
      } else {
        const error = await response.json();
        showToast(error.error || '创建失败', 'error');
      }
    } catch (error) {
      showToast('创建失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/export/materials');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `materials_${Date.now()}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('导出成功', 'success');
      }
    } catch (error) {
      showToast('导出失败', 'error');
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    setImportLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/import/materials', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        showToast(result.message, 'success');
        fetchMaterials();
      } else {
        const error = await response.json();
        showToast(error.error || '导入失败', 'error');
      }
    } catch (error) {
      showToast('导入失败', 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const totalValue = materials.reduce((sum, m) => sum + (m.unitPrice || 0) * (m.stock || 0), 0);

  const categoryStats = {};
  materials.forEach(m => {
    if (!categoryStats[m.category]) {
      categoryStats[m.category] = { count: 0, value: 0 };
    }
    categoryStats[m.category].count++;
    categoryStats[m.category].value += (m.unitPrice || 0) * (m.stock || 0);
  });

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="stats-grid">
        <div className="stat-card primary">
          <h3>材料种类</h3>
          <div className="value">{materials.length}</div>
        </div>
        <div className="stat-card success">
          <h3>库存总价值</h3>
          <div className="value">¥{totalValue.toFixed(2)}</div>
        </div>
        <div className="stat-card warning">
          <h3>分类数量</h3>
          <div className="value">{Object.keys(categoryStats).length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>材料管理</h2>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={handleExport}>
              导出数据
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              新增材料
            </button>
          </div>
        </div>

        <div className="search-bar">
          <div className="form-group">
            <label>分类筛选</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="all">全部分类</option>
              <option value="水暖">水暖</option>
              <option value="电器">电器</option>
              <option value="五金">五金</option>
              <option value="耗材">耗材</option>
            </select>
          </div>
          <div className="form-group">
            <label>搜索</label>
            <input
              type="text"
              placeholder="输入材料名称、规格或编号..."
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading">加载中</div>
        ) : materials.length === 0 ? (
          <div className="empty-state">
            <p>暂无材料数据</p>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              新增材料
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>编号</th>
                  <th>名称</th>
                  <th>分类</th>
                  <th>规格</th>
                  <th>单位</th>
                  <th>单价</th>
                  <th>库存</th>
                  <th>库存价值</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(material => (
                  <tr key={material.id}>
                    <td><strong>{material.id}</strong></td>
                    <td>{material.name}</td>
                    <td>
                      <span className={`tag ${
                        material.category === '水暖' ? 'tag-claim' :
                        material.category === '电器' ? 'tag-return' : 'tag-claim'
                      }`}>
                        {material.category}
                      </span>
                    </td>
                    <td>{material.specification || '-'}</td>
                    <td>{material.unit}</td>
                    <td>¥{material.unitPrice}</td>
                    <td>{material.stock}</td>
                    <td className={`amount-badge ${(material.unitPrice || 0) * (material.stock || 0) < 0 ? 'negative-amount' : ''}`}>
                      ¥{((material.unitPrice || 0) * (material.stock || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>批量导入</h2>
        </div>
        <div
          className={`file-upload ${isDragging ? 'dragover' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('materialFileInput')?.click()}
        >
          <input
            id="materialFileInput"
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          {importLoading ? (
            <div className="loading">导入中...</div>
          ) : (
            <>
              <h3 style={{ marginBottom: 8 }}>拖拽文件到此处，或点击选择文件</h3>
              <p>支持 Excel 格式（.xlsx, .xls）</p>
              <p style={{ marginTop: 16, fontSize: 12 }}>
                导入模板字段：名称、分类、规格、单位、单价、库存、描述
              </p>
            </>
          )}
        </div>
      </div>

      {Object.keys(categoryStats).length > 0 && (
        <div className="report-card">
          <h3>分类统计</h3>
          <div className="chart-bar">
            {Object.entries(categoryStats).map(([category, stats]) => {
              const maxCount = Math.max(...Object.values(categoryStats).map(s => s.count));
              const heightPercent = maxCount > 0 ? (stats.count / maxCount) * 100 : 0;
              return (
                <div key={category} className="chart-bar-item">
                  <div className="value">{stats.count}</div>
                  <div
                    className="bar"
                    style={{ height: `${Math.max(heightPercent, 10)}%` }}
                  />
                  <div className="label">{category}</div>
                  <div className="label" style={{ color: '#667eea' }}>
                    ¥{stats.value.toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>新增材料</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>材料名称 *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>分类</label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="水暖">水暖</option>
                      <option value="电器">电器</option>
                      <option value="五金">五金</option>
                      <option value="门窗">门窗</option>
                      <option value="耗材">耗材</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>规格型号</label>
                    <input
                      type="text"
                      value={formData.specification}
                      onChange={e => setFormData({ ...formData, specification: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>计量单位</label>
                    <select
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    >
                      <option value="个">个</option>
                      <option value="件">件</option>
                      <option value="米">米</option>
                      <option value="卷">卷</option>
                      <option value="支">支</option>
                      <option value="把">把</option>
                      <option value="副">副</option>
                      <option value="公斤">公斤</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>单价（元）</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unitPrice}
                      onChange={e => setFormData({ ...formData, unitPrice: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>库存数量</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.stock}
                      onChange={e => setFormData({ ...formData, stock: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>描述</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MaterialList;
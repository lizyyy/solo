import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2,
  X,
  Building2
} from 'lucide-react';
import { buildingsAPI } from '../utils/api';
import dayjs from 'dayjs';

function Buildings() {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: ''
  });

  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    try {
      setLoading(true);
      const response = await buildingsAPI.getAll();
      setBuildings(response.data);
    } catch (error) {
      console.error('加载楼栋列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingBuilding(null);
    setFormData({
      name: '',
      description: '',
      location: ''
    });
    setShowModal(true);
  };

  const openEditModal = (building) => {
    setEditingBuilding(building);
    setFormData({
      name: building.name,
      description: building.description || '',
      location: building.location || ''
    });
    setShowModal(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBuilding) {
        await buildingsAPI.update(editingBuilding.id, formData);
      } else {
        await buildingsAPI.create(formData);
      }
      
      setShowModal(false);
      loadBuildings();
    } catch (error) {
      alert(error.message || '保存失败');
    }
  };

  const handleDelete = async (building) => {
    if (building._count?.devices > 0) {
      alert(`该楼栋下还有 ${building._count.devices} 台设备，请先转移设备后再删除`);
      return;
    }
    
    if (window.confirm(`确定要删除楼栋 "${building.name}" 吗？`)) {
      try {
        await buildingsAPI.delete(building.id);
        loadBuildings();
      } catch (error) {
        alert(error.message || '删除失败');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">楼栋管理</h1>
        <button 
          onClick={openCreateModal}
          className="btn btn-primary btn-sm flex items-center gap-1"
        >
          <Plus size={16} /> 添加楼栋
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : buildings.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Building2 className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 mb-4">暂无楼栋数据</p>
            <button 
              onClick={openCreateModal}
              className="btn btn-primary btn-sm"
            >
              添加第一个楼栋
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buildings.map((building) => (
            <div key={building.id} className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Building2 className="text-primary-600" size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{building.name}</h3>
                      {building.location && (
                        <p className="text-sm text-gray-500">{building.location}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => openEditModal(building)}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(building)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      disabled={building._count?.devices > 0}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-body">
                {building.description && (
                  <p className="text-gray-600 text-sm mb-4">{building.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    设备数量: <span className="font-medium text-gray-900">{building._count?.devices || 0}</span>
                  </span>
                  <span className="text-gray-400">
                    创建于 {dayjs(building.createdAt).format('YYYY-MM-DD')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                {editingBuilding ? '编辑楼栋' : '添加楼栋'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="label">楼栋名称 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input"
                    placeholder="如：1号楼、行政楼"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">位置描述</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="如：园区东侧、靠近大门"
                    value={formData.location}
                    onChange={(e) => handleFormChange('location', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">备注</label>
                  <textarea
                    className="input h-24"
                    placeholder="补充说明信息..."
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                >
                  {editingBuilding ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Buildings;

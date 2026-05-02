import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2,
  X,
  FileTemplate,
  ListChecks,
  ChevronDown,
  ChevronUp,
  GripVertical
} from 'lucide-react';
import { templatesAPI, devicesAPI } from '../utils/api';
import dayjs from 'dayjs';

function Templates() {
  const [templates, setTemplates] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    deviceId: '',
    checkItems: []
  });
  const [newCheckItem, setNewCheckItem] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesRes, devicesRes] = await Promise.all([
        templatesAPI.getAll(),
        devicesAPI.getAll({ status: 'active' })
      ]);
      setTemplates(templatesRes.data);
      setDevices(devicesRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      deviceId: devices.length > 0 ? devices[0].id.toString() : '',
      checkItems: []
    });
    setShowModal(true);
  };

  const openEditModal = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      deviceId: template.deviceId.toString(),
      checkItems: [...(template.checkItems || [])]
    });
    setShowModal(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addCheckItem = () => {
    if (!newCheckItem.name.trim()) return;
    
    setFormData(prev => ({
      ...prev,
      checkItems: [
        ...prev.checkItems,
        {
          ...newCheckItem,
          sortOrder: prev.checkItems.length
        }
      ]
    }));
    setNewCheckItem({ name: '', description: '' });
  };

  const removeCheckItem = (index) => {
    setFormData(prev => ({
      ...prev,
      checkItems: prev.checkItems.filter((_, i) => i !== index)
    }));
  };

  const moveCheckItem = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.checkItems.length) return;
    
    setFormData(prev => {
      const items = [...prev.checkItems];
      const temp = items[index];
      items[index] = items[newIndex];
      items[newIndex] = temp;
      return { ...prev, checkItems: items };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.checkItems.length === 0) {
      alert('请至少添加一个检查项');
      return;
    }
    
    try {
      const data = {
        name: formData.name,
        deviceId: parseInt(formData.deviceId),
        checkItems: formData.checkItems.map((item, index) => ({
          name: item.name,
          description: item.description,
          sortOrder: index
        }))
      };
      
      if (editingTemplate) {
        await templatesAPI.update(editingTemplate.id, data);
      } else {
        await templatesAPI.create(data);
      }
      
      setShowModal(false);
      loadData();
    } catch (error) {
      alert(error.message || '保存失败');
    }
  };

  const handleDelete = async (template) => {
    if (window.confirm(`确定要删除模板 "${template.name}" 吗？`)) {
      try {
        await templatesAPI.delete(template.id);
        loadData();
      } catch (error) {
        alert(error.message || '删除失败');
      }
    }
  };

  const toggleExpand = (templateId) => {
    setExpandedTemplate(expandedTemplate === templateId ? null : templateId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">巡检模板</h1>
        <button 
          onClick={openCreateModal}
          className="btn btn-primary btn-sm flex items-center gap-1"
        >
          <Plus size={16} /> 创建模板
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : templates.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <FileTemplate className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 mb-2">暂无巡检模板</p>
            <p className="text-gray-400 text-sm mb-4">模板定义了设备巡检时需要检查的项目</p>
            <button 
              onClick={openCreateModal}
              className="btn btn-primary btn-sm"
            >
              创建第一个模板
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.id} className="card">
              <div 
                className="card-header cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(template.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <ListChecks className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{template.device?.building?.name}</span>
                        <span>·</span>
                        <span>{template.device?.name}</span>
                        <span>·</span>
                        <span>{template.checkItems?.length || 0} 个检查项</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openEditModal(template); }}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(template); }}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                    {expandedTemplate === template.id ? (
                      <ChevronUp className="text-gray-400" size={20} />
                    ) : (
                      <ChevronDown className="text-gray-400" size={20} />
                    )}
                  </div>
                </div>
              </div>
              
              {expandedTemplate === template.id && template.checkItems && template.checkItems.length > 0 && (
                <div className="card-body border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">检查项列表</h4>
                  <div className="space-y-2">
                    {template.checkItems.map((item, index) => (
                      <div 
                        key={item.id}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="w-6 h-6 bg-white rounded-full border-2 border-primary-200 flex items-center justify-center text-xs font-medium text-primary-600">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                    <span>创建于 {dayjs(template.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                    <span>最近更新 {dayjs(template.updatedAt).format('YYYY-MM-DD HH:mm')}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                {editingTemplate ? '编辑巡检模板' : '创建巡检模板'}
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
                  <label className="label">模板名称 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input"
                    placeholder="如：电梯月度巡检模板"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">关联设备 <span className="text-red-500">*</span></label>
                  <select
                    className="select"
                    value={formData.deviceId}
                    onChange={(e) => handleFormChange('deviceId', e.target.value)}
                    required
                  >
                    <option value="">请选择设备</option>
                    {devices.map(device => (
                      <option key={device.id} value={device.id}>
                        {device.building?.name} - {device.name} ({device.type})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="pt-2">
                  <label className="label">检查项 <span className="text-red-500">*</span></label>
                  
                  {formData.checkItems.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {formData.checkItems.map((item, index) => (
                        <div 
                          key={index}
                          className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
                        >
                          <GripVertical className="text-gray-400" size={16} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{item.name}</p>
                            {item.description && (
                              <p className="text-sm text-gray-500 truncate">{item.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveCheckItem(index, 'up')}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveCheckItem(index, 'down')}
                              disabled={index === formData.checkItems.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              <ChevronDown size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCheckItem(index)}
                              className="p-1 text-red-400 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="border border-dashed border-gray-300 rounded-lg p-4">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          className="input"
                          placeholder="检查项名称"
                          value={newCheckItem.name}
                          onChange={(e) => setNewCheckItem(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          className="input"
                          placeholder="检查标准/描述（可选）"
                          value={newCheckItem.description}
                          onChange={(e) => setNewCheckItem(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addCheckItem}
                        className="btn btn-secondary"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      提示：填写检查项后点击加号添加到列表，可调整顺序
                    </p>
                  </div>
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
                  disabled={formData.checkItems.length === 0}
                >
                  {editingTemplate ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Templates;

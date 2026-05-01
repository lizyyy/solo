import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2,
  X,
  Users,
  Phone,
  Wrench,
  Clock
} from 'lucide-react';
import { workersAPI } from '../utils/api';
import dayjs from 'dayjs';

const PREDEFINED_SKILLS = ['电梯维修', '空调维修', '电气维修', '水暖维修', '消防设备', '门禁系统'];

function Workers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSkill, setFilterSkill] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    skills: []
  });
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [customSkill, setCustomSkill] = useState('');

  useEffect(() => {
    loadWorkers();
  }, [filterSkill]);

  const loadWorkers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterSkill) params.skill = filterSkill;
      
      const response = await workersAPI.getAll(params);
      setWorkers(response.data);
    } catch (error) {
      console.error('加载师傅列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const allSkills = [...new Set(workers.flatMap(w => w.skills))];

  const openCreateModal = () => {
    setEditingWorker(null);
    setFormData({
      name: '',
      phone: '',
      skills: []
    });
    setSelectedSkills([]);
    setShowModal(true);
  };

  const openEditModal = (worker) => {
    setEditingWorker(worker);
    setFormData({
      name: worker.name,
      phone: worker.phone || '',
      skills: worker.skills
    });
    setSelectedSkills([...worker.skills]);
    setShowModal(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSkill = (skill) => {
    setSelectedSkills(prev => {
      if (prev.includes(skill)) {
        return prev.filter(s => s !== skill);
      }
      return [...prev, skill];
    });
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !selectedSkills.includes(customSkill.trim())) {
      setSelectedSkills(prev => [...prev, customSkill.trim()]);
      setCustomSkill('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedSkills.length === 0) {
      alert('请至少选择一项技能标签');
      return;
    }
    
    try {
      const data = {
        ...formData,
        skills: selectedSkills
      };
      
      if (editingWorker) {
        await workersAPI.update(editingWorker.id, data);
      } else {
        await workersAPI.create(data);
      }
      
      setShowModal(false);
      loadWorkers();
    } catch (error) {
      alert(error.message || '保存失败');
    }
  };

  const handleDelete = async (worker) => {
    if (window.confirm(`确定要删除师傅 "${worker.name}" 吗？`)) {
      try {
        await workersAPI.delete(worker.id);
        loadWorkers();
      } catch (error) {
        alert(error.message || '删除失败');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">维修师傅</h1>
        <div className="flex items-center gap-3">
          <select 
            className="select w-40"
            value={filterSkill}
            onChange={(e) => setFilterSkill(e.target.value)}
          >
            <option value="">全部技能</option>
            {allSkills.map(skill => (
              <option key={skill} value={skill}>{skill}</option>
            ))}
          </select>
          <button 
            onClick={openCreateModal}
            className="btn btn-primary btn-sm flex items-center gap-1"
          >
            <Plus size={16} /> 添加师傅
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : workers.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Users className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 mb-4">暂无维修师傅数据</p>
            <button 
              onClick={openCreateModal}
              className="btn btn-primary btn-sm"
            >
              添加第一个师傅
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => {
            const activeCount = worker._count?.repairOrders || 0;
            return (
              <div key={worker.id} className="card">
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-xl font-bold text-primary-700">
                          {worker.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{worker.name}</h3>
                        {worker.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Phone size={14} />
                            {worker.phone}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openEditModal(worker)}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(worker)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        disabled={activeCount > 0}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="card-body space-y-4">
                  <div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                      <Wrench size={14} />
                      技能标签
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {worker.skills.map((skill) => (
                        <span key={skill} className="badge bg-primary-100 text-primary-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className={activeCount > 0 ? 'text-amber-500' : 'text-gray-400'} />
                        <span className="text-sm text-gray-500">
                          当前待办: <span className={`font-medium ${activeCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                            {activeCount} 单
                          </span>
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {dayjs(worker.createdAt).format('YYYY-MM-DD')} 加入
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                {editingWorker ? '编辑师傅信息' : '添加维修师傅'}
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
                  <label className="label">师傅姓名 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">联系电话</label>
                  <input
                    type="tel"
                    className="input"
                    value={formData.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">技能标签 <span className="text-red-500">*</span></label>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {PREDEFINED_SKILLS.map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            selectedSkills.includes(skill)
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="input"
                        placeholder="添加自定义技能"
                        value={customSkill}
                        onChange={(e) => setCustomSkill(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
                      />
                      <button
                        type="button"
                        onClick={addCustomSkill}
                        className="btn btn-secondary"
                      >
                        添加
                      </button>
                    </div>

                    {selectedSkills.length > 0 && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">已选技能：</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedSkills.map((skill) => (
                            <span 
                              key={skill}
                              className="badge bg-primary-100 text-primary-700 cursor-pointer hover:bg-primary-200"
                              onClick={() => toggleSkill(skill)}
                            >
                              {skill} ×
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
                  disabled={selectedSkills.length === 0}
                >
                  {editingWorker ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Workers;

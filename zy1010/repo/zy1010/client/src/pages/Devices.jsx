import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2,
  Download,
  Upload,
  X,
  AlertCircle
} from 'lucide-react';
import { devicesAPI, buildingsAPI } from '../utils/api';
import dayjs from 'dayjs';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '停用' }
];

function Devices() {
  const [devices, setDevices] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    buildingId: '',
    type: '',
    status: ''
  });
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    buildingId: '',
    location: '',
    status: 'active'
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [importErrors, setImportErrors] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadDevices();
  }, [filters]);

  const loadData = async () => {
    try {
      const [buildingsRes, typesRes] = await Promise.all([
        buildingsAPI.getAll(),
        devicesAPI.getTypes()
      ]);
      setBuildings(buildingsRes.data);
      setDeviceTypes(typesRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  const loadDevices = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.buildingId) params.buildingId = filters.buildingId;
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      
      const response = await devicesAPI.getAll(params);
      setDevices(response.data);
    } catch (error) {
      console.error('加载设备列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const openCreateModal = () => {
    setEditingDevice(null);
    setFormData({
      name: '',
      type: '',
      buildingId: buildings.length > 0 ? buildings[0].id.toString() : '',
      location: '',
      status: 'active'
    });
    setShowModal(true);
  };

  const openEditModal = (device) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      type: device.type,
      buildingId: device.buildingId.toString(),
      location: device.location || '',
      status: device.status
    });
    setShowModal(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        buildingId: parseInt(formData.buildingId)
      };
      
      if (editingDevice) {
        await devicesAPI.update(editingDevice.id, data);
      } else {
        await devicesAPI.create(data);
      }
      
      setShowModal(false);
      loadDevices();
    } catch (error) {
      alert(error.message || '保存失败');
    }
  };

  const handleDelete = async (device) => {
    if (window.confirm(`确定要删除设备 "${device.name}" 吗？`)) {
      try {
        await devicesAPI.delete(device.id);
        loadDevices();
      } catch (error) {
        alert(error.message || '删除失败');
      }
    }
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (filters.buildingId) params.buildingId = filters.buildingId;
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      
      const response = await devicesAPI.exportCSV(params);
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `devices_${dayjs().format('YYYY-MM-DD')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || '导出失败');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportContent(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importContent.trim()) {
      alert('请先选择或粘贴 CSV 内容');
      return;
    }
    
    try {
      const response = await devicesAPI.importCSV(importContent);
      alert(response.data.message);
      setShowImportModal(false);
      setImportContent('');
      setImportErrors([]);
      loadDevices();
    } catch (error) {
      if (error.response?.data?.errors) {
        setImportErrors(error.response.data.errors);
      } else {
        alert(error.message || '导入失败');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">设备台账</h1>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary btn-sm flex items-center gap-1"
          >
            <Upload size={16} /> 导入 CSV
          </button>
          <button 
            onClick={handleExport}
            className="btn btn-secondary btn-sm flex items-center gap-1"
          >
            <Download size={16} /> 导出 CSV
          </button>
          <button 
            onClick={openCreateModal}
            className="btn btn-primary btn-sm flex items-center gap-1"
          >
            <Plus size={16} /> 添加设备
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">楼栋</label>
              <select 
                className="select"
                value={filters.buildingId}
                onChange={(e) => handleFilterChange('buildingId', e.target.value)}
              >
                <option value="">全部楼栋</option>
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">设备类型</label>
              <select 
                className="select"
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
              >
                <option value="">全部类型</option>
                {deviceTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">状态</label>
              <select 
                className="select"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={loadDevices}
                className="btn btn-secondary w-full"
              >
                <Search size={16} className="mr-1" /> 查询
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>设备名称</th>
                <th>设备类型</th>
                <th>所属楼栋</th>
                <th>位置</th>
                <th>状态</th>
                <th>上次巡检</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    暂无设备数据
                  </td>
                </tr>
              ) : (
                devices.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <Link 
                        to={`/devices/${device.id}`}
                        className="font-medium text-primary-600 hover:text-primary-700"
                      >
                        {device.name}
                      </Link>
                    </td>
                    <td>
                      <span className="badge bg-gray-100 text-gray-700">
                        {device.type}
                      </span>
                    </td>
                    <td>{device.building?.name}</td>
                    <td className="text-gray-500">{device.location || '-'}</td>
                    <td>
                      <span className={`badge ${
                        device.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {device.status === 'active' ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="text-gray-500">
                      {device.lastPatrolAt 
                        ? dayjs(device.lastPatrolAt).format('YYYY-MM-DD')
                        : '-'
                      }
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => openEditModal(device)}
                          className="p-1 text-gray-500 hover:text-primary-600"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(device)}
                          className="p-1 text-gray-500 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                {editingDevice ? '编辑设备' : '添加设备'}
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
                  <label className="label">设备名称 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">设备类型 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input"
                    placeholder="如：电梯、空调、消防"
                    value={formData.type}
                    onChange={(e) => handleFormChange('type', e.target.value)}
                    required
                    list="device-types"
                  />
                  <datalist id="device-types">
                    {deviceTypes.map(t => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="label">所属楼栋 <span className="text-red-500">*</span></label>
                  <select
                    className="select"
                    value={formData.buildingId}
                    onChange={(e) => handleFormChange('buildingId', e.target.value)}
                    required
                  >
                    <option value="">请选择楼栋</option>
                    {buildings.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">具体位置</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="如：大厅左侧、楼顶平台"
                    value={formData.location}
                    onChange={(e) => handleFormChange('location', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">状态</label>
                  <select
                    className="select"
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                  >
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
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
                  {editingDevice ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">导入设备 CSV</h2>
              <button 
                onClick={() => {
                  setShowImportModal(false);
                  setImportContent('');
                  setImportErrors([]);
                }}
                className="p-1 text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-1">
                  <AlertCircle size={16} /> 导入说明
                </h3>
                <p className="text-sm text-blue-700">
                  CSV 需包含以下列：<strong>设备名称、设备类型、所属楼栋（或楼栋ID）</strong>。
                  可选列：<strong>具体位置、状态</strong>。
                </p>
              </div>
              
              <div>
                <label className="label">选择 CSV 文件</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>
              
              <div className="text-center text-gray-500 text-sm">
                或
              </div>
              
              <div>
                <label className="label">粘贴 CSV 内容</label>
                <textarea
                  className="input h-40 font-mono text-sm"
                  placeholder="设备名称,设备类型,所属楼栋&#10;客梯-4号,电梯,1号楼"
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                />
              </div>

              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-red-800 mb-2">
                    校验错误 ({importErrors.length} 条)
                  </h3>
                  <ul className="space-y-2 max-h-40 overflow-y-auto">
                    {importErrors.map((err, idx) => (
                      <li key={idx} className="text-sm text-red-700">
                        <span className="font-medium">第 {err.row} 行：</span>
                        {err.errors.join('；')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportContent('');
                  setImportErrors([]);
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button 
                onClick={handleImport}
                className="btn btn-primary"
              >
                执行导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Devices;

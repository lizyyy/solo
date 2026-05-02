import { useState } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle, Package, Droplets, Fuel, Pill } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/store';

export default function Supplies() {
  const { supplies, sandbags, addSupply, updateSupply, fetchSupplies } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingSupply, setEditingSupply] = useState(null);
  const [formData, setFormData] = useState({
    type: 'fuel',
    name: '',
    quantity: '',
    unit: '',
    min_threshold: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        quantity: parseFloat(formData.quantity),
        min_threshold: parseFloat(formData.min_threshold)
      };

      if (editingSupply) {
        await updateSupply(editingSupply.id, submitData);
        toast.success('物资信息已更新');
      } else {
        await addSupply(submitData);
        toast.success('物资已添加');
      }
      setShowModal(false);
      setEditingSupply(null);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.error || '操作失败');
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'fuel',
      name: '',
      quantity: '',
      unit: '',
      min_threshold: ''
    });
  };

  const handleEdit = (supply) => {
    setEditingSupply(supply);
    setFormData({
      type: supply.type,
      name: supply.name,
      quantity: supply.quantity,
      unit: supply.unit || '',
      min_threshold: supply.min_threshold
    });
    setShowModal(true);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'fuel': return <Fuel className="w-5 h-5" />;
      case 'water': return <Droplets className="w-5 h-5" />;
      case 'food': return <Package className="w-5 h-5" />;
      case 'medicine': return <Pill className="w-5 h-5" />;
      default: return <Package className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'fuel': return 'bg-amber-100 text-amber-700';
      case 'water': return 'bg-blue-100 text-blue-700';
      case 'food': return 'bg-green-100 text-green-700';
      case 'medicine': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const typeNames = {
    fuel: '燃油',
    water: '饮水',
    food: '食品',
    medicine: '药品'
  };

  const groupedSupplies = supplies.reduce((acc, s) => {
    if (!acc[s.type]) acc[s.type] = [];
    acc[s.type].push(s);
    return acc;
  }, {});

  const getPercentage = (supply) => {
    if (supply.min_threshold <= 0) return 100;
    return Math.min(100, Math.round((supply.quantity / supply.min_threshold) * 100));
  };

  const isCritical = (supply) => supply.quantity <= supply.min_threshold;

  const criticalCount = supplies.filter(s => isCritical(s)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">物资管理</h1>
          <p className="text-gray-500 mt-1">管理燃油、饮水、食品和药品等应急物资</p>
        </div>
        <button 
          onClick={() => {
            setEditingSupply(null);
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加物资
        </button>
      </div>

      {criticalCount > 0 && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-danger-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-danger-800">物资告警</p>
            <p className="text-sm text-danger-600">有 {criticalCount} 项物资低于保底线，请及时补充</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(typeNames).map(([type, name]) => {
          const typeSupplies = groupedSupplies[type] || [];
          const criticalTypeCount = typeSupplies.filter(s => isCritical(s)).length;
          
          return (
            <div key={type} className="card">
              <div className="card-body">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getTypeColor(type)}`}>
                    {getTypeIcon(type)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{name}</p>
                    <p className="text-lg font-bold text-gray-900">
                      {typeSupplies.length} 项
                    </p>
                  </div>
                </div>
                {criticalTypeCount > 0 && (
                  <p className="text-xs text-danger-600 mt-2">
                    ⚠️ {criticalTypeCount} 项不足
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {Object.entries(typeNames).map(([type, typeName]) => {
        const typeSupplies = groupedSupplies[type] || [];
        if (typeSupplies.length === 0) return null;

        return (
          <div key={type} className="card">
            <div className="card-header flex items-center gap-2">
              <div className={`p-1.5 rounded ${getTypeColor(type)}`}>
                {getTypeIcon(type)}
              </div>
              <h2 className="font-semibold text-gray-900">{typeName}</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {typeSupplies.map(supply => (
                  <div 
                    key={supply.id} 
                    className={`p-4 rounded-lg border ${
                      isCritical(supply) 
                        ? 'border-danger-300 bg-danger-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{supply.name}</h3>
                        <p className="text-sm text-gray-500">
                          底线: {supply.min_threshold} {supply.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(supply)}
                          className="p-1 text-gray-400 hover:text-primary-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">
                          {supply.quantity} {supply.unit}
                        </span>
                        <span className={isCritical(supply) ? 'text-danger-600' : 'text-gray-500'}>
                          {getPercentage(supply)}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className={`progress-bar-fill ${
                            isCritical(supply) 
                              ? 'bg-danger-500' 
                              : getPercentage(supply) >= 100 
                                ? 'bg-success-500' 
                                : 'bg-warning-500'
                          }`}
                          style={{ width: `${Math.min(100, getPercentage(supply))}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isCritical(supply) ? (
                        <span className="badge badge-danger flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          不足
                        </span>
                      ) : (
                        <span className="badge badge-success flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          充足
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {sandbags.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">沙袋部署</h2>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>位置</th>
                  <th>已部署</th>
                  <th>需部署</th>
                  <th>进度</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {sandbags.map(sb => (
                  <tr key={sb.id}>
                    <td className="font-medium">{sb.location}</td>
                    <td>{sb.quantity} 个</td>
                    <td>{sb.needed} 个</td>
                    <td>
                      <div className="w-32">
                        <div className="progress-bar">
                          <div 
                            className={`progress-bar-fill ${
                              sb.quantity >= sb.needed ? 'bg-success-500' : 'bg-warning-500'
                            }`}
                            style={{ 
                              width: `${sb.needed > 0 ? Math.min(100, (sb.quantity / sb.needed) * 100) : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        sb.status === 'completed' ? 'badge-success' : 'badge-warning'
                      }`}>
                        {sb.status === 'completed' ? '已完成' : '进行中'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-lg font-semibold">
                {editingSupply ? '编辑物资' : '添加物资'}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="label">物资类型</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className="input"
                  >
                    {Object.entries(typeNames).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">物资名称 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="input"
                    placeholder="如: 发电机柴油、瓶装饮用水"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">当前数量</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={e => setFormData({...formData, quantity: e.target.value})}
                      className="input"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="label">单位</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      className="input"
                      placeholder="如: 升、瓶、包"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">保底线（最低存量）</label>
                  <input
                    type="number"
                    value={formData.min_threshold}
                    onChange={e => setFormData({...formData, min_threshold: e.target.value})}
                    className="input"
                    min="0"
                    step="0.1"
                    placeholder="低于此值将告警"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSupply ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
